// @vitest-environment jsdom
import * as React from 'react';
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiGetConsultantAvailability } from '../../../api/apiGetConsultantAvailability';
import { apiGetAnonymousEnquiryDetails } from '../../../api/apiGetAnonymousEnquiryDetails';
import { LiveChatEntryRoom } from './LiveChatEntryRoom';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));
vi.mock('react-router-dom', () => ({
	useNavigate: () => vi.fn()
}));
vi.mock('./EntryRoomShell', () => ({
	EntryRoomShell: ({
		statusLine,
		children
	}: {
		statusLine: string;
		children: React.ReactNode;
	}) => (
		<div>
			<p data-testid="status-line">{statusLine}</p>
			{children}
		</div>
	)
}));
vi.mock('../../legalLinks/LegalLinks', () => ({
	__esModule: true,
	default: () => <span />
}));
vi.mock('lottie-react', () => ({ default: () => null }));
vi.mock('../../orbitalTrails/OrbitalTrails', () => ({
	OrbitalTrails: ({ label }: { label: string }) => <div>{label}</div>
}));
vi.mock('../../../api/apiGetConsultantAvailability', () => ({
	apiGetConsultantAvailability: vi.fn()
}));
vi.mock('../../../api/apiPutSessionData', () => ({
	apiPutSessionData: vi.fn(() => Promise.resolve())
}));
vi.mock('../../../api/apiPatchUserData', () => ({
	apiPatchUserData: vi.fn(() => Promise.resolve())
}));
vi.mock('../../../api/apiGetAnonymousEnquiryDetails', () => ({
	apiGetAnonymousEnquiryDetails: vi.fn(() => Promise.resolve({}))
}));

const flush = (ms = 0) =>
	act(async () => {
		await vi.advanceTimersByTimeAsync(ms);
	});
const details = (numAvailableConsultants: number) => ({
	peopleAhead: 1,
	numAvailableConsultants,
	status: 'ENQUIRY'
});
/* Copy of the waiting room's "nobody live" state (the sentence the ticket asks for). */
const NOBODY_HEADLINE = 'Gerade ist keine Beraterin live.';
const NOBODY_TEXT =
	'Wir behalten das im Blick und verbinden Sie, sobald jemand verfügbar ist.';
const NORMAL_HEADLINE = 'Gleich geht es los.';

/* The guest is in the waiting room with a session, and clicked "Ich warte" on
   the closed page: the room that is left must still say nobody is live. */
const waitWithNobodyLive = async () => {
	vi.mocked(apiGetConsultantAvailability).mockResolvedValue({
		available: true,
		numAvailableConsultants: 1
	});
	vi.mocked(apiGetAnonymousEnquiryDetails).mockResolvedValue(
		details(0) as never
	);
	render(
		<LiveChatEntryRoom
			invite={{
				topicId: 3,
				consultingTypeId: 1,
				redeem: () => Promise.resolve(42)
			}}
			topicSlug="U25"
		/>
	);
	await flush();
	fireEvent.click(screen.getByRole('button', { name: 'Zum Warteraum' }));
	await flush();
	/* First zero: not yet closed (one zero may be a failed lookup). */
	expect(screen.queryByText(NOBODY_HEADLINE)).toBeNull();
	await flush(4000);
	/* Second zero: the closed page, as before. */
	fireEvent.click(screen.getByRole('button', { name: 'Ich warte' }));
	await flush();
};

beforeEach(() => {
	vi.useFakeTimers();
	vi.clearAllMocks();
	sessionStorage.clear();
});
afterEach(() => {
	cleanup();
	vi.useRealTimers();
});

describe('LiveChatEntryRoom — "Ich warte" with a session (#1270)', () => {
	it('says nobody is live right now instead of the plain "Gleich geht es los."', async () => {
		await waitWithNobodyLive();

		expect(screen.getByText(NOBODY_HEADLINE)).toBeTruthy();
		expect(screen.getByText(NOBODY_TEXT)).toBeTruthy();
		expect(screen.queryByText(NORMAL_HEADLINE)).toBeNull();
		expect(screen.getByTestId('status-line').textContent).toBe(
			'Gerade ist niemand live'
		);
		/* The first card must not claim the counsellors are merely busy
		   (the carousel renders the key; `t` is the identity here). */
		expect(screen.queryByText('liveChat.entry.steps.wait.text')).toBeNull();
		expect(
			screen.getByText('liveChat.entry.steps.wait.textNobodyLive')
		).toBeTruthy();
	});

	it('goes back to the normal waiting room by itself when somebody is live again', async () => {
		await waitWithNobodyLive();
		expect(screen.getByText(NOBODY_HEADLINE)).toBeTruthy();

		vi.mocked(apiGetAnonymousEnquiryDetails).mockResolvedValue(
			details(1) as never
		);
		await flush(4000);

		expect(screen.queryByText(NOBODY_HEADLINE)).toBeNull();
		expect(screen.queryByText(NOBODY_TEXT)).toBeNull();
		expect(screen.getByText(NORMAL_HEADLINE)).toBeTruthy();
	});

	it('keeps watching: the state comes back when the count drops to zero again', async () => {
		await waitWithNobodyLive();
		vi.mocked(apiGetAnonymousEnquiryDetails).mockResolvedValue(
			details(1) as never
		);
		await flush(4000);
		expect(screen.getByText(NORMAL_HEADLINE)).toBeTruthy();

		vi.mocked(apiGetAnonymousEnquiryDetails).mockResolvedValue(
			details(0) as never
		);
		/* One zero is not enough ... */
		await flush(4000);
		expect(screen.queryByText(NOBODY_HEADLINE)).toBeNull();
		/* ... a confirmed one is. The closed page comes first; waiting again. */
		await flush(4000);
		fireEvent.click(screen.getByRole('button', { name: 'Ich warte' }));
		await flush();
		expect(screen.getByText(NOBODY_HEADLINE)).toBeTruthy();
	});

	it('does not show the state while the availability is merely unknown', async () => {
		vi.mocked(apiGetConsultantAvailability).mockResolvedValue({
			available: true,
			numAvailableConsultants: 1
		});
		vi.mocked(apiGetAnonymousEnquiryDetails).mockResolvedValue({} as never);
		render(
			<LiveChatEntryRoom
				invite={{
					topicId: 3,
					consultingTypeId: 1,
					redeem: () => Promise.resolve(42)
				}}
				topicSlug="U25"
			/>
		);
		await flush();
		fireEvent.click(screen.getByRole('button', { name: 'Zum Warteraum' }));
		await flush(4000 * 3);

		expect(screen.queryByText(NOBODY_HEADLINE)).toBeNull();
		expect(screen.getByText(NORMAL_HEADLINE)).toBeTruthy();
	});
});

describe('LiveChatEntryRoom — a hanging poll in the waiting room (#1270)', () => {
	/* Every poll stays unanswered until the test resolves it. */
	const deferredPolls = () => {
		const pending: Array<(value: never) => void> = [];
		vi.mocked(apiGetAnonymousEnquiryDetails).mockImplementation(
			() =>
				new Promise((resolve) => {
					pending.push(resolve as (value: never) => void);
				})
		);
		return pending;
	};
	const enterWaitingRoom = async () => {
		vi.mocked(apiGetConsultantAvailability).mockResolvedValue({
			available: true,
			numAvailableConsultants: 1
		});
		render(
			<LiveChatEntryRoom
				invite={{
					topicId: 3,
					consultingTypeId: 1,
					redeem: () => Promise.resolve(42)
				}}
				topicSlug="U25"
			/>
		);
		await flush();
		fireEvent.click(screen.getByRole('button', { name: 'Zum Warteraum' }));
		await flush();
	};

	it('aborts a poll that hangs for 15 s and asks again on the next tick', async () => {
		const pending = deferredPolls();
		await enterWaitingRoom();
		expect(pending).toHaveLength(1);

		await flush(12000);
		expect(pending).toHaveLength(1);

		await flush(3000);
		const signal = vi.mocked(apiGetAnonymousEnquiryDetails).mock
			.calls[0][1] as AbortSignal | undefined;
		expect(signal?.aborted).toBe(true);

		await flush(1000);
		expect(pending).toHaveLength(2);
	});

	it('keeps the last known state: the late answer of an abandoned poll is ignored', async () => {
		const pending = deferredPolls();
		await enterWaitingRoom();
		await flush(16000);
		expect(pending).toHaveLength(2);

		await act(async () => {
			pending[1](details(1) as never);
		});
		/* Two zeros in a row would confirm "nobody is live" - the abandoned
		   request's zero must not be one of them. */
		await act(async () => {
			pending[0](details(0) as never);
		});
		await flush(4000);
		await act(async () => {
			pending[2](details(0) as never);
		});
		await flush();

		expect(screen.queryByText(NOBODY_HEADLINE)).toBeNull();
		expect(screen.getByText(NORMAL_HEADLINE)).toBeTruthy();
	});
});
