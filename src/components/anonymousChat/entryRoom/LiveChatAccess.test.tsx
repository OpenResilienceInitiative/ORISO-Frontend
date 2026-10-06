// @vitest-environment jsdom
import * as React from 'react';
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiPutSessionData } from '../../../api/apiPutSessionData';
import { apiPatchUserData } from '../../../api/apiPatchUserData';
import { apiGetAnonymousEnquiryDetails } from '../../../api/apiGetAnonymousEnquiryDetails';
import { purgeAppWebStorage } from '../../../services/clientStorageHygiene';
import {
	rememberConfirmedEntryName,
	readConfirmedEntryName
} from './entryRoomIdentity';
import { LiveChatEntryRoom } from './LiveChatEntryRoom';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));
vi.mock('react-router-dom', () => ({
	useNavigate: () => vi.fn()
}));
/* The frame needs the stage, a router and the legal links; none of that is
   what this test is about. */
vi.mock('./EntryRoomShell', () => ({
	EntryRoomShell: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	)
}));
vi.mock('../../legalLinks/LegalLinks', () => ({
	__esModule: true,
	default: () => <span />
}));
/* The later stages pull in the lottie player, and jsdom has no canvas. */
vi.mock('lottie-react', () => ({ default: () => null }));
vi.mock('../../../api/apiPutSessionData', () => ({
	apiPutSessionData: vi.fn(() => Promise.resolve())
}));
vi.mock('../../../api/apiPatchUserData', () => ({
	apiPatchUserData: vi.fn(() => Promise.resolve())
}));
vi.mock('../../../api/apiGetAnonymousEnquiryDetails', () => ({
	apiGetAnonymousEnquiryDetails: vi.fn(() => Promise.resolve({}))
}));

const names = () =>
	screen.getAllByRole('radio').map((radio) => radio.textContent);
const checked = () =>
	screen
		.getAllByRole('radio')
		.filter((radio) => radio.getAttribute('aria-checked') === 'true');

beforeEach(() => {
	vi.clearAllMocks();
	sessionStorage.clear();
	localStorage.clear();
});
afterEach(cleanup);

describe('the live chat door offers a choice of names (#1341)', () => {
	it('shows four names with the first one already taken', () => {
		render(<LiveChatEntryRoom sessionId={7} />);

		const radios = screen.getAllByRole('radio');
		expect(radios).toHaveLength(4);
		expect(new Set(names()).size).toBe(4);
		expect(checked()).toHaveLength(1);
		expect(radios[0].getAttribute('aria-checked')).toBe('true');
	});

	it('hands the chosen name to the session and the account', async () => {
		render(<LiveChatEntryRoom sessionId={7} />);

		const third = screen.getAllByRole('radio')[2];
		const chosen = third.textContent;
		fireEvent.click(third);
		expect(third.getAttribute('aria-checked')).toBe('true');
		expect(checked()).toHaveLength(1);

		fireEvent.click(screen.getByTestId('registration-footer-primary'));

		await waitFor(() =>
			expect(apiPutSessionData).toHaveBeenCalledWith(7, {
				displayName: chosen
			})
		);
		expect(apiPatchUserData).toHaveBeenCalledWith({ displayName: chosen });
	});

	/* Frank, 2026-09-10: „wichtig ist, dass wir die User IDs nutzen". The door
	   shows the handle the guest meets everywhere else — animal_name_1234,
	   umlauts spelled out — and stores exactly that, so nothing is minted
	   behind their back. */
	it('offers User-IDs, not display names, and stores the one that was picked', async () => {
		render(<LiveChatEntryRoom sessionId={7} />);
		const shown = screen
			.getAllByRole('radio')
			.map((radio) => radio.textContent ?? '');
		expect(shown).toHaveLength(4);
		shown.forEach((text) => {
			expect(text).toMatch(/^[a-z0-9]+_[a-z0-9]+_\d{4}$/);
			expect(text).not.toMatch(/[äöüÄÖÜß ]/);
		});

		fireEvent.click(screen.getAllByRole('radio')[1]);
		const chosen = screen.getAllByRole('radio')[1].textContent;
		fireEvent.click(screen.getByRole('button', { name: /Zum Warteraum/i }));

		await waitFor(() =>
			expect(apiPutSessionData).toHaveBeenCalledWith(7, {
				displayName: chosen
			})
		);
	});

	it('replaces the whole set on „Neu würfeln", first one taken again', () => {
		render(<LiveChatEntryRoom sessionId={7} />);

		fireEvent.click(screen.getAllByRole('radio')[3]);
		const before = names();

		fireEvent.click(screen.getByTestId('registration-footer-secondary'));

		const after = names();
		expect(after).toHaveLength(4);
		expect(after).not.toEqual(before);
		expect(new Set(after).size).toBe(4);
		expect(checked()).toHaveLength(1);
		expect(
			screen.getAllByRole('radio')[0].getAttribute('aria-checked')
		).toBe('true');
	});
});

describe('the live chat waiting-room availability (#1400)', () => {
	it('ignores older zero responses after a newer available response', async () => {
		vi.useFakeTimers();
		type Details = Awaited<
			ReturnType<typeof apiGetAnonymousEnquiryDetails>
		>;
		const responses: Array<(details: Details) => void> = [];
		vi.mocked(apiGetAnonymousEnquiryDetails).mockImplementation(
			() => new Promise((resolve) => responses.push(resolve))
		);
		try {
			render(<LiveChatEntryRoom sessionId={7} />);
			await act(async () => {
				fireEvent.click(
					screen.getByTestId('registration-footer-primary')
				);
			});
			await act(async () => {
				vi.advanceTimersByTime(8000);
			});
			expect(responses).toHaveLength(3);
			await act(async () => {
				responses[2]({ numAvailableConsultants: 1, status: 'NEW' });
			});
			for (const resolve of responses.slice(0, 2)) {
				await act(async () => {
					resolve({ numAvailableConsultants: 0, status: 'NEW' });
				});
				expect(
					screen.queryByText('Der Live-Chat ist gerade geschlossen.')
				).toBeNull();
			}
		} finally {
			cleanup();
			vi.useRealTimers();
		}
	});

	it('stays open when a zero sample is followed by an available consultant', async () => {
		vi.useFakeTimers();
		vi.mocked(apiGetAnonymousEnquiryDetails)
			.mockResolvedValueOnce({
				numAvailableConsultants: 0,
				peopleAhead: 0,
				status: 'NEW'
			})
			.mockResolvedValue({
				numAvailableConsultants: 1,
				peopleAhead: 0,
				status: 'NEW'
			});

		try {
			render(<LiveChatEntryRoom sessionId={7} />);
			fireEvent.click(screen.getByTestId('registration-footer-primary'));

			await act(async () => {
				await Promise.resolve();
				await Promise.resolve();
				await Promise.resolve();
			});
			expect(apiGetAnonymousEnquiryDetails).toHaveBeenCalledTimes(1);
			expect(
				screen.queryByText('Der Live-Chat ist gerade geschlossen.')
			).toBeNull();

			await act(async () => {
				vi.advanceTimersByTime(4000);
				await Promise.resolve();
			});

			expect(apiGetAnonymousEnquiryDetails).toHaveBeenCalledTimes(2);
			expect(
				screen.queryByText('Der Live-Chat ist gerade geschlossen.')
			).toBeNull();
		} finally {
			vi.useRealTimers();
		}
	});

	it('shows the closed screen after two consecutive zero samples', async () => {
		vi.useFakeTimers();
		vi.mocked(apiGetAnonymousEnquiryDetails).mockResolvedValue({
			numAvailableConsultants: 0,
			peopleAhead: 0,
			status: 'NEW'
		});

		try {
			render(<LiveChatEntryRoom sessionId={7} />);
			fireEvent.click(screen.getByTestId('registration-footer-primary'));

			await act(async () => {
				await Promise.resolve();
				await Promise.resolve();
				await Promise.resolve();
			});
			expect(apiGetAnonymousEnquiryDetails).toHaveBeenCalledTimes(1);
			expect(
				screen.queryByText('Der Live-Chat ist gerade geschlossen.')
			).toBeNull();

			await act(async () => {
				vi.advanceTimersByTime(4000);
				await Promise.resolve();
			});

			expect(apiGetAnonymousEnquiryDetails).toHaveBeenCalledTimes(2);
			expect(
				screen.queryByText('Der Live-Chat ist gerade geschlossen.')
			).not.toBeNull();
			vi.mocked(apiGetAnonymousEnquiryDetails).mockResolvedValue({
				numAvailableConsultants: 1,
				status: 'NEW'
			});
			await act(async () => {
				vi.advanceTimersByTime(4000);
			});
			expect(
				screen.queryByText('Der Live-Chat ist gerade geschlossen.')
			).toBeNull();
		} finally {
			vi.useRealTimers();
		}
	});
});

describe('resuming a confirmed live-chat identity (#1404)', () => {
	it.each([false, true])(
		'returns to waiting without rewriting the name (new tab: %s)',
		async (newTab) => {
			vi.mocked(apiGetAnonymousEnquiryDetails).mockResolvedValue({
				status: 'NEW',
				numAvailableConsultants: 1,
				peopleAhead: 0
			});
			const first = render(<LiveChatEntryRoom sessionId={17} />);
			fireEvent.click(screen.getAllByRole('radio')[1]);
			const chosen = screen.getAllByRole('radio')[1].textContent;
			fireEvent.click(
				screen.getByRole('button', { name: /Zum Warteraum/i })
			);
			await waitFor(() =>
				expect(screen.queryAllByRole('radio')).toHaveLength(0)
			);
			first.unmount();
			if (newTab) sessionStorage.clear();
			vi.clearAllMocks();
			render(<LiveChatEntryRoom sessionId={17} />);
			await waitFor(() =>
				expect(apiGetAnonymousEnquiryDetails).toHaveBeenCalledWith(17)
			);
			expect(screen.queryAllByRole('radio')).toHaveLength(0);
			expect(apiPutSessionData).not.toHaveBeenCalled();
			expect(apiPatchUserData).not.toHaveBeenCalled();
			expect(sessionStorage.getItem('anonymous-pseudonym-name-17')).toBe(
				chosen
			);
		}
	);

	it('does not reuse another session name', () => {
		sessionStorage.setItem(
			'anonymous-pseudonym-name-17',
			'katze_mika_1234'
		);
		render(<LiveChatEntryRoom sessionId={18} />);
		expect(screen.getAllByRole('radio')).toHaveLength(4);
	});
});

describe('confirmed identity boundaries', () => {
	it('clears the confirmed identity on logout', () => {
		rememberConfirmedEntryName(17, 'katze_mika_1234');
		purgeAppWebStorage();
		expect(readConfirmedEntryName(17)).toBeNull();
	});
	it('does not transfer confirmation when the session changes', () => {
		rememberConfirmedEntryName(17, 'katze_mika_1234');
		const view = render(<LiveChatEntryRoom sessionId={17} />);
		view.rerender(<LiveChatEntryRoom sessionId={18} />);
		expect(screen.getAllByRole('radio')).toHaveLength(4);
		expect(readConfirmedEntryName(18)).toBeNull();
	});
	it('makes an existing tab confirmation available on reopening', () => {
		sessionStorage.setItem(
			'anonymous-pseudonym-name-17',
			'katze_mika_1234'
		);
		const view = render(<LiveChatEntryRoom sessionId={17} />);
		view.unmount();
		sessionStorage.clear();
		expect(readConfirmedEntryName(17)).toBe('katze_mika_1234');
	});
});
