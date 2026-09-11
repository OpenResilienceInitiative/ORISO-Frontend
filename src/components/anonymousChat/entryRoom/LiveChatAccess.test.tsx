// @vitest-environment jsdom
import * as React from 'react';
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiPutSessionData } from '../../../api/apiPutSessionData';
import { apiPatchUserData } from '../../../api/apiPatchUserData';
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
