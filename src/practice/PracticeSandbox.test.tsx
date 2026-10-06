// @vitest-environment jsdom
import * as React from 'react';
import { StrictMode, useContext } from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PracticeSandbox, usePracticeSandbox } from './PracticeSandbox';
import { practiceCounsellorFixture } from './fixtures/practiceCounsellorFixture';
import { endpoints } from '../resources/scripts/endpoints';
import { MatrixClientContext } from '../globalState/context/MatrixClientContext';
import {
	getMatrixClientService,
	setMatrixClientServiceRef
} from '../services/matrixClientRegistry';
import {
	isRestorableSessionPath,
	rememberLastOpenSession
} from '../utils/lastOpenSession';
import {
	PRACTICE_ENQUIRY_SESSION_ID,
	PRACTICE_MAIN_ROOM_ID,
	PRACTICE_TOPIC_ID
} from './fixtures/practiceIdentifiers';
import { TopicsContext } from '../globalState/provider/TopicsProvider';
import { FakeMatrixService } from './fakeMatrix/FakeMatrixService';
import {
	SessionsDataContext,
	SET_SESSIONS
} from '../globalState/provider/SessionsDataProvider';

const realService = { real: true } as any;
const counsellor = practiceCounsellorFixture();
const enquiryFeed = `${endpoints.consultantEnquiriesBase}registered?count=15&filter=all&offset=0`;
let baseFetch: ReturnType<typeof vi.fn>;
let pageFetch: typeof window.fetch;

beforeEach(() => {
	baseFetch = vi.fn(async () => new Response('real', { status: 200 }));
	pageFetch = vi.fn(async () => new Response('page', { status: 200 }));
	window.fetch = pageFetch;
	setMatrixClientServiceRef(realService);
	(window as any).__activeSessionContext = { real: true };
});
afterEach(async () => {
	cleanup();
	await settle();
	setMatrixClientServiceRef(null);
	delete (window as any).__activeSessionContext;
	vi.restoreAllMocks();
});

/** Uninstall waits one macrotask so the practice tree's own cleanups drain. */
const settle = () =>
	act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));

const sandbox = (children: React.ReactNode = null) => (
	<PracticeSandbox counsellor={counsellor} baseFetch={baseFetch as any}>
		{children}
	</PracticeSandbox>
);

describe('PracticeSandbox', () => {
	it('answers practice endpoints from memory and passes everything else to the base fetch', async () => {
		render(sandbox());

		const practice = await window.fetch(new Request(enquiryFeed));
		const other = await window.fetch(new Request(endpoints.userData));

		expect((await practice.json()).sessions[0].session.id).toBe(
			PRACTICE_ENQUIRY_SESSION_ID
		);
		expect(await other.text()).toBe('real');
		expect(baseFetch).toHaveBeenCalledTimes(1);
		expect(pageFetch).not.toHaveBeenCalled();
	});

	it('patches fetch during render so the first child effect already reaches the fake', async () => {
		const seen: number[] = [];
		const Child = () => {
			React.useEffect(() => {
				void window
					.fetch(new Request(enquiryFeed))
					.then((response) => seen.push(response.status));
			}, []);
			return null;
		};

		render(sandbox(<Child />));
		await act(async () => undefined);

		expect(seen).toEqual([200]);
		expect(baseFetch).not.toHaveBeenCalled();
	});

	it('provides the fake Matrix service to context and registry and restores the real one on exit', async () => {
		let fromContext: unknown;
		const Probe = () => {
			fromContext = useContext(MatrixClientContext)?.matrixClientService;
			return null;
		};

		const view = render(sandbox(<Probe />));

		expect(fromContext).toBeInstanceOf(FakeMatrixService);
		expect(getMatrixClientService()).toBe(fromContext);
		view.unmount();
		await settle();
		expect(getMatrixClientService()).toBe(realService);
		expect(window.fetch).toBe(pageFetch);
	});

	it('stays installed through StrictMode effect replays and uninstalls once on exit', async () => {
		const view = render(<StrictMode>{sandbox()}</StrictMode>);
		await settle();

		expect(window.fetch).not.toBe(pageFetch);
		expect(getMatrixClientService()).toBeInstanceOf(FakeMatrixService);

		view.unmount();
		await settle();

		expect(window.fetch).toBe(pageFetch);
		expect(getMatrixClientService()).toBe(realService);
	});

	it('keeps practice cleanup requests away from the network while unmounting', async () => {
		const activeView = () =>
			window.fetch(
				new Request(`${endpoints.eventNotifications}/active-view`, {
					method: 'PATCH',
					body: JSON.stringify({
						roomId: PRACTICE_MAIN_ROOM_ID,
						active: false
					})
				})
			);
		let cleanupRequest: Promise<Response> | undefined;
		const Child = () => {
			React.useEffect(
				() => () => {
					cleanupRequest = activeView();
				},
				[]
			);
			return null;
		};

		const view = render(sandbox(<Child />));
		view.unmount();

		expect((await cleanupRequest)?.status).toBe(204);
		expect(baseFetch).not.toHaveBeenCalled();
	});

	it('hides the practice session from window.__activeSessionContext and restores the real one', async () => {
		const view = render(sandbox());

		(window as any).__activeSessionContext = { practice: true };
		expect((window as any).__activeSessionContext).toEqual({ real: true });

		view.unmount();
		await settle();
		expect((window as any).__activeSessionContext).toEqual({ real: true });
		(window as any).__activeSessionContext = { next: true };
		expect((window as any).__activeSessionContext).toEqual({ next: true });
	});

	it('never touches browser storage', async () => {
		const setItem = vi.spyOn(Storage.prototype, 'setItem');
		const removeItem = vi.spyOn(Storage.prototype, 'removeItem');
		const clear = vi.spyOn(Storage.prototype, 'clear');
		const openDb = vi.fn();
		vi.stubGlobal('indexedDB', { open: openDb });

		const view = render(sandbox());
		await window.fetch(new Request(enquiryFeed));
		view.unmount();
		await settle();

		expect(setItem).not.toHaveBeenCalled();
		expect(removeItem).not.toHaveBeenCalled();
		expect(clear).not.toHaveBeenCalled();
		expect(openDb).not.toHaveBeenCalled();
		vi.unstubAllGlobals();
	});

	it('never remembers a practice session as the last open session', () => {
		const setItem = vi.spyOn(Storage.prototype, 'setItem');
		const practicePaths = [
			`/sessions/consultant/sessionView/${PRACTICE_MAIN_ROOM_ID}/${PRACTICE_ENQUIRY_SESSION_ID}`,
			`/sessions/consultant/sessionView/session/${PRACTICE_ENQUIRY_SESSION_ID}`
		];

		practicePaths.forEach((path) => {
			expect(isRestorableSessionPath(path)).toBe(false);
			rememberLastOpenSession(counsellor.userId, path);
		});

		expect(setItem).not.toHaveBeenCalled();
	});

	it('keeps practice list data out of the app-level sessions store', () => {
		const outer = { sessions: [{ real: true }], dispatch: vi.fn() };
		let inner: any;
		const Probe = () => {
			inner = useContext(SessionsDataContext);
			return null;
		};
		render(
			<SessionsDataContext.Provider value={outer as any}>
				{sandbox(<Probe />)}
			</SessionsDataContext.Provider>
		);

		act(() =>
			inner.dispatch({
				type: SET_SESSIONS,
				sessions: [{ session: { id: PRACTICE_ENQUIRY_SESSION_ID } }]
			})
		);

		expect(inner.sessions).toEqual([
			{ session: { id: PRACTICE_ENQUIRY_SESSION_ID } }
		]);
		expect(outer.dispatch).not.toHaveBeenCalled();
	});

	it('shows the practice view only the practice topic', () => {
		let topics: any;
		const Probe = () => {
			topics = useContext(TopicsContext)?.topics;
			return null;
		};
		render(
			<TopicsContext.Provider
				value={{
					topics: [{ id: 7, name: 'Real' }] as any,
					refreshTopics() {}
				}}
			>
				{sandbox(<Probe />)}
			</TopicsContext.Provider>
		);

		expect(topics.map(({ id }) => id)).toEqual([PRACTICE_TOPIC_ID]);
	});

	it('restarts from fresh fixtures', async () => {
		let restart: () => void = () => undefined;
		const Probe = () => {
			restart = usePracticeSandbox().restart;
			return null;
		};
		render(sandbox(<Probe />));
		await window.fetch(
			new Request(
				`${endpoints.sessionBase}/new/${PRACTICE_ENQUIRY_SESSION_ID}`,
				{ method: 'PUT' }
			)
		);
		expect((await window.fetch(new Request(enquiryFeed))).status).toBe(204);

		act(() => restart());

		expect((await window.fetch(new Request(enquiryFeed))).status).toBe(200);
	});
});
