// @vitest-environment jsdom
import * as React from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { apiGetAnonymousEnquiryDetails } from '../../../api/apiGetAnonymousEnquiryDetails';
import { apiGetConsentText } from '../../../api/apiGetConsentText';
import { rememberConfirmedEntryName } from './entryRoomIdentity';
import { LiveChatEntryRoom } from './LiveChatEntryRoom';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));
const shell = vi.hoisted(() => ({ props: null as any }));
vi.mock('./EntryRoomShell', () => ({
	EntryRoomShell: (props: any) => {
		shell.props = props;
		return <div>{props.children}</div>;
	}
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

beforeEach(() => {
	vi.useFakeTimers();
	vi.clearAllMocks();
	localStorage.clear();
	sessionStorage.clear();
	shell.props = null;
	room.props = null;
	rememberConfirmedEntryName(197, 'huendchen_briar_8345');
});
afterEach(() => {
	cleanup();
	vi.useRealTimers();
});

/* Gate 2 (ADR-022): once a centre has taken the conversation, its department
   (ADR-003: agency × topic) governs the sentence and every legal link on the
   page — the frame's footer included, not only the checkbox. */
it("hands the accepting centre's department to the sentence and to the frame", async () => {
	vi.mocked(apiGetAnonymousEnquiryDetails).mockResolvedValue({
		status: 'IN_PROGRESS',
		agencyId: 7,
		mainTopicId: 20,
		numAvailableConsultants: 1,
		peopleAhead: 0
	} as any);
	render(<LiveChatEntryRoom sessionId={197} topicSlug="Migration" />);
	await act(async () => {
		await vi.advanceTimersByTimeAsync(0);
	});

	expect(apiGetConsentText).toHaveBeenCalledWith(7, 20);
	expect(room.props.department).toEqual({ agencyId: 7, topicId: 20 });
	expect(shell.props.department).toEqual({ agencyId: 7, topicId: 20 });
});

it('keeps the platform documents in the frame while nobody has accepted', async () => {
	vi.mocked(apiGetAnonymousEnquiryDetails).mockResolvedValue({
		status: 'NEW',
		agencyId: 7,
		mainTopicId: 20,
		numAvailableConsultants: 1,
		peopleAhead: 0
	} as any);
	render(<LiveChatEntryRoom sessionId={197} topicSlug="Migration" />);
	await act(async () => {
		await vi.advanceTimersByTimeAsync(0);
	});

	expect(shell.props.department).toBeNull();
});
