// @vitest-environment jsdom
import * as React from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiGetAnonymousEnquiryDetails } from '../../../api/apiGetAnonymousEnquiryDetails';
import { apiPatchUserData } from '../../../api/apiPatchUserData';
import { rememberConfirmedEntryName } from './entryRoomIdentity';
import { LiveChatEntryRoom } from './LiveChatEntryRoom';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));
vi.mock('./EntryRoomShell', () => ({
	EntryRoomShell: (props: any) => <div>{props.children}</div>
}));
const room = vi.hoisted(() => ({ props: null as any }));
vi.mock('./LiveChatWaitingRoom', () => ({
	LiveChatWaitingRoom: (props: any) => {
		room.props = props;
		return <div data-testid="waiting-room" />;
	}
}));
vi.mock('../../legalLinks/LegalLinks', () => ({
	__esModule: true,
	default: () => <span />
}));
vi.mock('lottie-react', () => ({ default: () => null }));
vi.mock('../../../api/apiGetAnonymousEnquiryDetails', () => ({
	apiGetAnonymousEnquiryDetails: vi.fn()
}));
vi.mock('../../../api/apiGetConsentText', () => ({
	apiGetConsentText: vi.fn(() =>
		Promise.resolve({
			status: 'ok',
			consentText: { sentence: 'Bei uns {{legal_links}}.', versionId: 5 }
		})
	)
}));
vi.mock('../../../api/apiPatchUserData', () => ({
	apiPatchUserData: vi.fn(() => Promise.resolve())
}));
vi.mock('../../../api/apiPutSessionConsent', () => ({
	apiPutSessionConsent: vi.fn(() => Promise.resolve())
}));

const flush = (ms = 0) =>
	act(async () => {
		await vi.advanceTimersByTimeAsync(ms);
	});

beforeEach(() => {
	vi.useFakeTimers();
	vi.clearAllMocks();
	localStorage.clear();
	sessionStorage.clear();
	room.props = null;
	rememberConfirmedEntryName(197, 'huendchen_briar_8345');
	vi.stubGlobal('location', { href: 'https://oriso.example/entry' });
	vi.mocked(apiGetAnonymousEnquiryDetails).mockResolvedValue({
		status: 'IN_PROGRESS',
		agencyId: 7,
		mainTopicId: 20,
		numAvailableConsultants: 1,
		peopleAhead: 0
	} as any);
});
afterEach(() => {
	cleanup();
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

/**
 * ORISO-Frontend#1737. Starting the chat replaces the whole page, so the
 * closing animation cannot open onto it from here. It keeps its cover on until
 * the page is replaced, instead of opening onto the waiting room again.
 */
describe('LiveChatEntryRoom — starting the chat while the screen closes', () => {
	const start = async () => {
		render(<LiveChatEntryRoom sessionId={197} topicSlug="Migration" />);
		await flush();
		let over = false;
		const wait = room.props.onAccept() as Promise<unknown>;
		wait.then(() => {
			over = true;
		});
		await flush(50);
		return () => over;
	};

	it('leaves for the chat and keeps the cover on until the page is replaced', async () => {
		const isOver = await start();

		expect(apiPatchUserData).toHaveBeenCalledTimes(1);
		expect(window.location.href).not.toBe('https://oriso.example/entry');
		expect(isOver(), 'the page is on its way, the cover stays').toBe(false);
	});

	it('gives the screen back when the start failed, so the person can try again', async () => {
		vi.mocked(apiPatchUserData).mockRejectedValueOnce(new Error('offline'));
		const isOver = await start();

		expect(window.location.href).toBe('https://oriso.example/entry');
		expect(isOver()).toBe(true);
		expect(room.props.busy).toBe(false);
	});
});
