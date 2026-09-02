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

vi.mock('react-i18next', () => {
	const catalogue: Record<string, string> = {
		'dpaSign.title': 'AVV unterzeichnen',
		'dpaSign.subtitle':
			'Bitte lesen Sie die Vereinbarung vollständig und bestätigen Sie anschließend die Angaben zur unterzeichnenden Person.',
		'dpaSign.loadingContract': 'Vereinbarung wird geladen...',
		'dpaSign.contractHeading': 'Auftragsverarbeitungsvereinbarung',
		'dpaSign.version': 'Vertragsversion',
		'dpaSign.signerHeading':
			'Bestätigung der vertretungsberechtigten Person',
		'dpaSign.signerName': 'Name',
		'dpaSign.signerPosition': 'Position',
		'dpaSign.signerEmail': 'E-Mail',
		'dpaSign.signerNote': 'Anmerkung (optional)',
		'dpaSign.language': 'Sprache',
		'dpaSign.signingFor': 'Sie unterzeichnen im Namen von:',
		'dpaSign.accept':
			'Ich habe die oben angezeigte Vereinbarung gelesen und bestätige sie verbindlich.',
		'dpaSign.submit': 'Verbindlich bestätigen',
		'dpaSign.submitting': 'Speichern...',
		'dpaSign.success': 'Die AVV-Bestätigung wurde gespeichert.',
		'dpaSign.error.missingToken': 'Der Signaturlink ist unvollständig.',
		'dpaSign.error.previewRequired':
			'Die Vereinbarung muss vollständig geladen sein, bevor Sie sie bestätigen können.',
		'dpaSign.error.acceptRequired':
			'Bitte bestätigen Sie die Vereinbarung.',
		'dpaSign.error.generic':
			'Die Signatur konnte gerade nicht gespeichert werden.',
		'dpaSign.error.invalidToken':
			'Dieser Signaturlink ist ungültig, abgelaufen oder wurde bereits verwendet.',
		'dpaSign.error.invalidRequest':
			'Die Angaben konnten nicht gespeichert werden. Bitte prüfen Sie das Formular.'
	};
	const t = (key: string) => catalogue[key] ?? key;
	return {
		useTranslation: () => ({
			t,
			i18n: { language: 'de' }
		})
	};
});

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
				name: 'Auftragsverarbeitungsvereinbarung'
			})
		).toBeDefined();
		expect(
			screen.getByRole('heading', {
				name: 'Bestätigung der vertretungsberechtigten Person'
			})
		).toBeDefined();
		expect(
			screen.getByText(
				/Ich habe die oben angezeigte Vereinbarung gelesen/
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
				name: /Ich habe die oben angezeigte Vereinbarung gelesen/
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
			await screen.findByText('Die AVV-Bestätigung wurde gespeichert.')
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
				name: /Ich habe die oben angezeigte Vereinbarung gelesen/
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
			await screen.findByText('Die AVV-Bestätigung wurde gespeichert.')
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
