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
		expect(apiGetConsultantAvailability).toHaveBeenCalledWith(
			3,
			1,
			expect.any(AbortSignal)
		);
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

	/* The last positive sample can be seconds old. Right before an account and
	   a queue entry are created, ask once more. */
	it('asks once more on continue, and does not redeem when nobody is live any more', async () => {
		vi.mocked(apiGetConsultantAvailability).mockResolvedValue(live(1));
		renderInvite();
		await flush();
		expect(nameCards().length).toBeGreaterThan(0);

		vi.mocked(apiGetConsultantAvailability).mockResolvedValue(live(0));
		fireEvent.click(screen.getByRole('button', { name: 'Zum Warteraum' }));
		await flush(1000);

		expect(redeem).not.toHaveBeenCalled();
		expect(closedHeadline()).not.toBeNull();
	});

	/* One zero may be the server's own failed lookup: at the door too, it
	   takes a second zero to turn somebody away. */
	it('does not turn the guest away on a single zero at the door', async () => {
		vi.mocked(apiGetConsultantAvailability).mockResolvedValue(live(1));
		renderInvite();
		await flush();

		vi.mocked(apiGetConsultantAvailability)
			.mockResolvedValueOnce(live(0))
			.mockResolvedValue(live(1));
		fireEvent.click(screen.getByRole('button', { name: 'Zum Warteraum' }));
		await flush(1000);

		expect(closedHeadline()).toBeNull();
		expect(redeem).toHaveBeenCalledTimes(1);
	});

	it('still redeems on continue when that last look cannot be answered', async () => {
		vi.mocked(apiGetConsultantAvailability).mockResolvedValue(live(1));
		renderInvite();
		await flush();

		vi.mocked(apiGetConsultantAvailability).mockRejectedValue(
			new Error('timeout')
		);
		fireEvent.click(screen.getByRole('button', { name: 'Zum Warteraum' }));
		await flush();

		expect(redeem).toHaveBeenCalledTimes(1);
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

	/* A rejected request says nothing about who is live — the waiting room's
	   poll has always ignored rejections. Only an answered zero counts. */
	it('keeps looking through failed lookups, never calling them closed', async () => {
		vi.mocked(apiGetConsultantAvailability).mockRejectedValue(
			new Error('offline')
		);
		renderInvite();
		await flush(1000);
		await flush(4000);
		expect(closedHeadline()).toBeNull();
		expect(screen.getByTestId('orbital-trails')).toBeTruthy();

		vi.mocked(apiGetConsultantAvailability).mockResolvedValue(live(1));
		await flush(4000);
		expect(nameCards().length).toBeGreaterThan(0);
	});

	/* The endpoint's contract: a rejection is unknown and must not block the
	   person. An outage that persists therefore opens the door as it did before
	   the pre-check — the waiting room's own poll takes over from there. */
	it('opens the names after repeated failed lookups instead of spinning forever', async () => {
		vi.mocked(apiGetConsultantAvailability).mockRejectedValue(
			new Error('503')
		);
		renderInvite();
		await flush(4000);
		expect(nameCards()).toHaveLength(0);

		await flush(8000);
		expect(nameCards().length).toBeGreaterThan(0);
		expect(closedHeadline()).toBeNull();
		expect(redeem).not.toHaveBeenCalled();
	});

	/* A server that accepts the connection and never answers would otherwise
	   hold each sample for fetchData's 30 s default — about a minute and a
	   half on the loader before the fallback. Each sample is bounded instead. */
	it('bounds each sample, so a silent server still opens the names within half a minute', async () => {
		vi.mocked(apiGetConsultantAvailability).mockImplementation(
			(_topic, _type, signal) =>
				new Promise((_resolve, reject) =>
					signal?.addEventListener('abort', () =>
						reject(new Error('aborted'))
					)
				)
		);
		renderInvite();
		await flush(25_000);

		expect(nameCards().length).toBeGreaterThan(0);
	});

	/* An answer without the number says nothing about who is live. */
	it('treats an answer without a count as unknown, not as zero', async () => {
		vi.mocked(apiGetConsultantAvailability).mockResolvedValue({} as never);
		renderInvite();
		await flush(1000);
		await flush(4000);

		expect(closedHeadline()).toBeNull();
	});

	/* After "Ich warte" the closed view is dismissed; if the outage fallback
	   then offers names and the door confirms nobody is live, the guest must be
	   told so — not see the button merely re-enable. */
	it('shows closed again when the door confirms it after "Ich warte"', async () => {
		vi.mocked(apiGetConsultantAvailability).mockResolvedValue(live(0));
		renderInvite();
		await flush(1000);
		fireEvent.click(screen.getByRole('button', { name: 'Ich warte' }));

		vi.mocked(apiGetConsultantAvailability).mockRejectedValue(
			new Error('503')
		);
		await flush(4000 * 3);
		expect(nameCards().length).toBeGreaterThan(0);

		vi.mocked(apiGetConsultantAvailability).mockResolvedValue(live(0));
		fireEvent.click(screen.getByRole('button', { name: 'Zum Warteraum' }));
		await flush(1000);

		expect(redeem).not.toHaveBeenCalled();
		expect(closedHeadline()).not.toBeNull();
	});

	it('does not let a failure between two zeros stand in for the second look', async () => {
		vi.mocked(apiGetConsultantAvailability)
			.mockResolvedValueOnce(live(0))
			.mockRejectedValueOnce(new Error('timeout'))
			.mockResolvedValue(live(0));
		renderInvite();
		await flush(1000);
		expect(closedHeadline()).toBeNull();

		await flush(4000);
		expect(closedHeadline()).not.toBeNull();
	});

	it('leaves a session the guest already has alone (#1404)', async () => {
		render(<LiveChatEntryRoom sessionId={41} topicSlug="U25" />);
		await flush();

		expect(apiGetConsultantAvailability).not.toHaveBeenCalled();
		expect(nameCards().length).toBeGreaterThan(0);
	});
});
