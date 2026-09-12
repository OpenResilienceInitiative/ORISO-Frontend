// @vitest-environment jsdom
import * as React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
	useTranslation: () => {
		const catalogue: Record<string, string> = {
			'erstantwort.saveCredentials.userNameLabel': 'Anmeldename',
			'erstantwort.saveCredentials.copy': 'Kopieren',
			'erstantwort.saveCredentials.copied': 'Anmeldename kopiert.',
			'erstantwort.saveCredentials.copyFailed':
				'Kopieren hat nicht geklappt. Bitte markieren Sie den Anmeldenamen und kopieren Sie ihn von Hand.',
			'erstantwort.saveCredentials.sharedDevice':
				'Wenn andere dieses Gerät mitbenutzen, speichern Sie den Anmeldenamen besser nicht hier, sondern notieren Sie ihn an einem sicheren Ort.',
			'erstantwort.saveCredentials.setPassword': 'Passwort jetzt setzen'
		};
		return {
			t: (key: string) => catalogue[key] ?? key
		};
	}
}));

const navigate = vi.fn();
vi.mock('react-router-dom', () => ({
	useNavigate: () => navigate
}));

/* eslint-disable-next-line import/first -- must load after the vi.mock calls. */
import { SaveCredentialsCard } from './SaveCredentialsCard';

afterEach(cleanup);
beforeEach(() => {
	navigate.mockReset();
	Object.assign(navigator, {
		clipboard: { writeText: vi.fn().mockResolvedValue(undefined) }
	});
});

const renderCard = (
	props: Partial<React.ComponentProps<typeof SaveCredentialsCard>> = {}
) => render(<SaveCredentialsCard userName="katze_mika_1234" {...props} />);

/**
 * ORISO-Frontend#825. Three properties here are not cosmetic — each one is a
 * decision recorded in ADR-018 that a later refactor could quietly undo.
 */
describe('SaveCredentialsCard', () => {
	it('shows the login name so the person can actually keep it', () => {
		renderCard();

		expect(screen.getByDisplayValue('katze_mika_1234')).toBeTruthy();
	});

	it('offers no file download anywhere', () => {
		/* ADR-018: a zugangsdaten.txt in the download folder is a lasting trace
		   on a device somebody else may use. There must be no way to produce one. */
		const { container } = renderCard();

		expect(container.querySelector('a[download]')).toBeNull();
		expect(container.querySelector('a[href^="blob:"]')).toBeNull();
		expect(container.querySelector('a[href^="data:"]')).toBeNull();
		expect(container.textContent).not.toMatch(/herunterladen|download/i);
	});

	it('warns about shared devices', () => {
		renderCard();

		expect(
			screen.getByText(/andere dieses Gerät mitbenutzen/i)
		).toBeTruthy();
	});

	it('never claims to show the password, because the app cannot', () => {
		/* The generated password is hashed in Keycloak and gone from the browser
		   after the post-registration redirect. A "show password" affordance here
		   would be a promise the app cannot keep. */
		const { container } = renderCard();

		expect(container.querySelector('input[type="password"]')).toBeNull();
		expect(container.textContent).not.toMatch(/Passwort anzeigen/i);
	});

	it('copies the login name to the clipboard on request', async () => {
		renderCard();

		await act(async () => {
			screen.getByRole('button', { name: /kopieren/i }).click();
		});

		expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
			'katze_mika_1234'
		);
		expect(screen.getByText('Anmeldename kopiert.')).toBeTruthy();
	});

	it('does not claim a successful copy when the clipboard write rejects', async () => {
		/* The card used to announce "Anmeldename kopiert" the instant the button
		   was pressed. On this card that is the difference between keeping and
		   losing the account: the person is told their only handle back in is
		   safely copied when nothing was copied at all. */
		(
			navigator.clipboard.writeText as ReturnType<typeof vi.fn>
		).mockRejectedValue(new Error('denied'));
		renderCard();

		await act(async () => {
			screen.getByRole('button', { name: /kopieren/i }).click();
		});

		expect(screen.queryByText('Anmeldename kopiert.')).toBeNull();
		expect(screen.getByText(/Kopieren hat nicht geklappt/i)).toBeTruthy();
	});

	it('does not claim a successful copy when there is no clipboard at all', async () => {
		// Insecure context, an embedded webview, Firefox without permission.
		Object.assign(navigator, { clipboard: undefined });
		renderCard();

		await act(async () => {
			screen.getByRole('button', { name: /kopieren/i }).click();
		});

		expect(screen.queryByText('Anmeldename kopiert.')).toBeNull();
	});

	it('routes "set a password now" to the existing profile security settings', () => {
		renderCard();

		screen.getByRole('button', { name: /Passwort jetzt setzen/i }).click();

		expect(navigate).toHaveBeenCalledWith(
			'/profile/einstellungen/sicherheit'
		);
	});

	it('marks the login name field so a password manager can pick it up', () => {
		/* The browser save prompt is the mechanism — the Credential Management API
		   is Chromium-only and must not be it. A correctly named and autocompleted
		   username field is what lets Safari and Firefox associate the credential
		   when the person later sets a password. */
		renderCard();

		const field = screen.getByDisplayValue('katze_mika_1234');
		expect(field.getAttribute('name')).toBe('username');
		expect(field.getAttribute('autocomplete')).toBe('username');
		expect(field.getAttribute('readonly')).not.toBeNull();
	});

	it('renders nothing without a login name rather than an empty box', () => {
		const { container } = render(<SaveCredentialsCard userName="" />);

		expect(container.textContent).toBe('');
	});
});
