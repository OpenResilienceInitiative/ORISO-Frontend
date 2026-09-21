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
import { apiPutSessionData } from '../../../api/apiPutSessionData';
import { LiveChatEntryRoom } from './LiveChatEntryRoom';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));
vi.mock('react-router-dom', () => ({
	useNavigate: () => vi.fn()
}));
vi.mock('./EntryRoomShell', () => ({
	EntryRoomShell: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	)
}));
vi.mock('../../legalLinks/LegalLinks', () => ({
	__esModule: true,
	default: () => <span />
}));
vi.mock('lottie-react', () => ({ default: () => null }));
/* jsdom has no canvas. */
vi.mock('../../orbitalTrails/OrbitalTrails', () => ({
	OrbitalTrails: ({
		label,
		variant
	}: {
		label: string;
		variant?: string;
	}) => (
		<div data-testid="orbital-trails" data-variant={variant}>
			{label}
		</div>
	)
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

const live = (n: number) => ({ available: n > 0, numAvailableConsultants: n });
const flush = (ms = 0) =>
	act(async () => {
		await vi.advanceTimersByTimeAsync(ms);
	});
const nameCards = () => screen.queryAllByRole('radio');
const closedHeadline = () =>
	screen.queryByText('Der Live-Chat ist gerade geschlossen.');

let redeem: ReturnType<typeof vi.fn<() => Promise<number>>>;
const renderInvite = () =>
	render(
		<LiveChatEntryRoom
			invite={{ topicId: 3, consultingTypeId: 1, redeem }}
			topicSlug="U25"
		/>
	);

beforeEach(() => {
	vi.useFakeTimers();
	vi.clearAllMocks();
	sessionStorage.clear();
	redeem = vi.fn(() => Promise.resolve(42));
});
afterEach(() => {
	cleanup();
	vi.useRealTimers();
});

describe('LiveChatEntryRoom — who is live, before anything is created', () => {
	it('asks who is live first, with the loader, and creates nothing', async () => {
		vi.mocked(apiGetConsultantAvailability).mockReturnValue(
			new Promise(() => undefined)
		);
		renderInvite();
		await flush();

		expect(screen.getByTestId('orbital-trails').textContent).toMatch(
			/wer gerade live ist/
		);
		/* One orbit, not the grid of four (Frank, 2026-09-21). */
		expect(
			screen.getByTestId('orbital-trails').getAttribute('data-variant')
		).toBe('single');
		expect(apiGetConsultantAvailability).toHaveBeenCalledWith(3, 1);
		expect(nameCards()).toHaveLength(0);
		expect(redeem).not.toHaveBeenCalled();
	});

	it('offers the names when someone is live, and redeems only on continue', async () => {
		vi.mocked(apiGetConsultantAvailability).mockResolvedValue(live(1));
		renderInvite();
		await flush();

		expect(nameCards().length).toBeGreaterThan(0);
		expect(redeem).not.toHaveBeenCalled();

		const chosen = nameCards()[0].textContent;
		fireEvent.click(screen.getByRole('button', { name: 'Zum Warteraum' }));
		await flush();

		expect(redeem).toHaveBeenCalledTimes(1);
		expect(apiPutSessionData).toHaveBeenCalledWith(42, {
			displayName: expect.any(String)
		});
		expect(chosen).toContain(
			vi.mocked(apiPutSessionData).mock.calls[0][1].displayName
		);
		expect(apiGetAnonymousEnquiryDetails).toHaveBeenCalledWith(42);
	});

	it('shows closed straight away — after a quick second look, not after a name', async () => {
		vi.mocked(apiGetConsultantAvailability).mockResolvedValue(live(0));
		renderInvite();
		await flush();

		/* One zero may be a failed lookup the server reported as nobody. */
		expect(closedHeadline()).toBeNull();
		await flush(1000);

		expect(closedHeadline()).not.toBeNull();
		expect(apiGetConsultantAvailability).toHaveBeenCalledTimes(2);
		expect(nameCards()).toHaveLength(0);
		expect(redeem).not.toHaveBeenCalled();
		expect(screen.getByRole('button', { name: 'Ich warte' })).toBeTruthy();
	});

	it('steps from closed to the names the moment someone comes online', async () => {
		vi.mocked(apiGetConsultantAvailability).mockResolvedValue(live(0));
		renderInvite();
		await flush(1000);
		expect(closedHeadline()).not.toBeNull();

		vi.mocked(apiGetConsultantAvailability).mockResolvedValue(live(1));
		await flush(4000);

		expect(closedHeadline()).toBeNull();
		expect(nameCards().length).toBeGreaterThan(0);
		expect(redeem).not.toHaveBeenCalled();
	});

	it('keeps waiting quietly after "Ich warte", and still steps on', async () => {
		vi.mocked(apiGetConsultantAvailability).mockResolvedValue(live(0));
		renderInvite();
		await flush(1000);

		fireEvent.click(screen.getByRole('button', { name: 'Ich warte' }));
		await flush();
		expect(closedHeadline()).toBeNull();
		expect(screen.getByTestId('orbital-trails')).toBeTruthy();

		vi.mocked(apiGetConsultantAvailability).mockResolvedValue(live(2));
		await flush(4000);
		expect(nameCards().length).toBeGreaterThan(0);
	});

	it('treats a failed lookup as unknown: closed, and keeps asking', async () => {
		vi.mocked(apiGetConsultantAvailability).mockRejectedValue(
			new Error('offline')
		);
		renderInvite();
		await flush(1000);
		expect(closedHeadline()).not.toBeNull();

		vi.mocked(apiGetConsultantAvailability).mockResolvedValue(live(1));
		await flush(4000);
		expect(nameCards().length).toBeGreaterThan(0);
	});

	it('leaves a session the guest already has alone (#1404)', async () => {
		render(<LiveChatEntryRoom sessionId={41} topicSlug="U25" />);
		await flush();

		expect(apiGetConsultantAvailability).not.toHaveBeenCalled();
		expect(nameCards().length).toBeGreaterThan(0);
	});
});
