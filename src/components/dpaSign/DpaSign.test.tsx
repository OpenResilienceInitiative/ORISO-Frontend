// @vitest-environment jsdom
import * as React from 'react';
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	apiConfirmDpaSignature,
	apiGetDpaSignPreview,
	DPA_SIGN_ERRORS
} from '../../api/apiDpaSignature';
import { DpaSign } from './DpaSign';

// The page never uses the ambient language: it renders through
// `getFixedT(<Sprache select>)`. The mock's ambient language is deliberately
// NOT German so any regression back to the global `t` shows up as `ru:`-less
// output where a fixed prefix is asserted.
const getFixedT = vi.fn(
	(lng: string) => (key: string, fallback?: string) =>
		lng === 'de' ? (fallback ?? key) : `${lng}:${key}`
);

// Stable like the real i18next singleton — a fresh object per render would
// re-trigger every effect that lists `t`/`i18n` in its dependencies.
const i18nMock = {
	language: 'ru',
	loadLanguages: () => Promise.resolve(),
	getFixedT
};

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => `ambient:${key}`,
		i18n: i18nMock
	})
}));

vi.mock('../../api/apiDpaSignature', () => ({
	DPA_SIGN_ERRORS: {
		INVALID_OR_EXPIRED_TOKEN: 'DPA_SIGN_INVALID_OR_EXPIRED_TOKEN',
		INVALID_REQUEST: 'DPA_SIGN_INVALID_REQUEST',
		FAILED: 'DPA_SIGN_FAILED'
	},
	apiGetDpaSignPreview: vi.fn(),
	apiConfirmDpaSignature: vi.fn()
}));

const previewMock = vi.mocked(apiGetDpaSignPreview);
const confirmMock = vi.mocked(apiConfirmDpaSignature);

const renderPage = () =>
	render(
		<MemoryRouter initialEntries={['/dpa-sign/valid-token']}>
			<Routes>
				<Route path="/dpa-sign/:token" element={<DpaSign />} />
			</Routes>
		</MemoryRouter>
	);

describe('DpaSign', () => {
	beforeEach(() => {
		previewMock.mockResolvedValue({
			tenantName: 'Träger Nord',
			dpaVersion: '2026-07-20T12:30:00',
			content:
				'{"de":"<h2>Vereinbarung</h2><p>Dieser konkrete Vertragstext ist verbindlich.</p>","en":"<h2>Agreement</h2><p>This exact contract applies.</p>"}',
			expiresAt: '2026-08-03T12:30:00'
		});
		confirmMock.mockResolvedValue({ status: 'SIGNED' });
	});

	afterEach(() => {
		cleanup();
		vi.clearAllMocks();
	});

	it('shows the exact contract and version before the signer confirmation form', async () => {
		renderPage();

		expect(
			await screen.findByText(
				'Dieser konkrete Vertragstext ist verbindlich.'
			)
		).toBeDefined();
		// Named twice on purpose: above the contract, and again at the
		// confirmation act that binds it.
		expect(screen.getAllByText('Träger Nord').length).toBe(2);
		expect(
			screen.getByRole('heading', {
				name: 'Vertragsunterlagen unterzeichnen'
			})
		).toBeDefined();
		expect(
			screen.getByRole('heading', { name: 'Vertragsunterlagen' })
		).toBeDefined();
		expect(
			screen.getByRole('heading', {
				name: 'Bestätigung der vertretungsberechtigten Person'
			})
		).toBeDefined();
		expect(
			screen.getByText(
				/Ich habe die oben angezeigten Vertragsunterlagen gelesen/
			)
		).toBeDefined();
		expect(previewMock).toHaveBeenCalledWith('valid-token');
	});

	it('confirms only after the visible contract and explicit checkbox', async () => {
		renderPage();
		await screen.findByText(
			'Dieser konkrete Vertragstext ist verbindlich.'
		);

		fireEvent.change(screen.getByLabelText('Name *'), {
			target: { value: 'Marge Simpson' }
		});
		fireEvent.change(screen.getByLabelText('Position *'), {
			target: { value: 'Geschäftsführerin' }
		});
		fireEvent.change(screen.getByLabelText('E-Mail *'), {
			target: { value: 'marge.simpson@dreambau.com' }
		});
		fireEvent.change(screen.getByLabelText('Anmerkung (optional)'), {
			target: { value: 'Vertretung laut Handelsregister' }
		});
		fireEvent.click(
			screen.getByRole('checkbox', {
				name: /Ich habe die oben angezeigten Vertragsunterlagen gelesen/
			})
		);
		fireEvent.click(
			screen.getByRole('button', { name: 'Verbindlich bestätigen' })
		);

		await waitFor(() =>
			expect(confirmMock).toHaveBeenCalledWith(
				'valid-token',
				expect.objectContaining({
					signerName: 'Marge Simpson',
					signerEmail: 'marge.simpson@dreambau.com',
					accepted: true
				})
			)
		);
		expect(
			await screen.findByText(
				'Die Bestätigung der Vertragsunterlagen wurde gespeichert.'
			)
		).toBeDefined();
	});

	it('names the Träger the signature binds instead of asking for it again', async () => {
		renderPage();
		await screen.findByText(
			'Dieser konkrete Vertragstext ist verbindlich.'
		);

		// The link is scoped to exactly one Träger, so the organisation is
		// stated — not retyped into a field that could contradict it.
		expect(screen.queryByLabelText('Organisation *')).toBeNull();
		expect(
			screen.getByText(/Sie unterzeichnen im Namen von/)
		).toBeDefined();
		expect(screen.getAllByText('Träger Nord').length).toBeGreaterThan(1);
	});

	it('signs with the optional note left empty', async () => {
		renderPage();
		await screen.findByText(
			'Dieser konkrete Vertragstext ist verbindlich.'
		);

		fireEvent.change(screen.getByLabelText('Name *'), {
			target: { value: 'Marge Simpson' }
		});
		fireEvent.change(screen.getByLabelText('Position *'), {
			target: { value: 'Geschäftsführerin' }
		});
		fireEvent.change(screen.getByLabelText('E-Mail *'), {
			target: { value: 'marge.simpson@dreambau.com' }
		});
		fireEvent.click(
			screen.getByRole('checkbox', {
				name: /Ich habe die oben angezeigten Vertragsunterlagen gelesen/
			})
		);
		fireEvent.click(
			screen.getByRole('button', { name: 'Verbindlich bestätigen' })
		);

		await waitFor(() =>
			expect(confirmMock).toHaveBeenCalledWith(
				'valid-token',
				expect.objectContaining({ signerOrganisation: '' })
			)
		);
		expect(
			await screen.findByText(
				'Die Bestätigung der Vertragsunterlagen wurde gespeichert.'
			)
		).toBeDefined();
	});

	it('renders its chrome in the selected signature language, not the ambient app locale', async () => {
		// Regression: on pre-dev the public page came up entirely in Russian
		// for a German browser (stale `locale` in localStorage / navigator
		// order) while the Sprache select said "Deutsch". The chrome must
		// follow the select — German on first load, and switch with it.
		renderPage();
		await screen.findByText(
			'Dieser konkrete Vertragstext ist verbindlich.'
		);

		// First load: fixed to the select's default 'de', ambient 'ru' ignored.
		expect(getFixedT).toHaveBeenCalledWith('de');
		expect(
			screen.getByRole('heading', {
				name: 'Vertragsunterlagen unterzeichnen'
			})
		).toBeDefined();
		expect(screen.queryByText(/^ambient:/)).toBeNull();

		// Switching the signature language re-renders the chrome with it.
		fireEvent.mouseDown(screen.getByLabelText('Sprache *'));
		fireEvent.click(await screen.findByRole('option', { name: 'English' }));
		expect(
			await screen.findByRole('heading', { name: 'en:dpaSign.title' })
		).toBeDefined();
	});

	it('does not render a confirmation form for an invalid or expired token', async () => {
		previewMock.mockRejectedValue(
			new Error(DPA_SIGN_ERRORS.INVALID_OR_EXPIRED_TOKEN)
		);
		renderPage();

		expect(
			await screen.findByText(
				'Dieser Signaturlink ist ungültig, abgelaufen oder wurde bereits verwendet.'
			)
		).toBeDefined();
		expect(screen.queryByLabelText('Name *')).toBeNull();
		expect(confirmMock).not.toHaveBeenCalled();
	});
});
