// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { LegalLinkModal } from './LegalLinkModal';
import { useLegalLinkContent } from './useLegalLinkContent';

vi.mock('./useLegalLinkContent', async () => ({
	...(await vi.importActual<typeof import('./useLegalLinkContent')>(
		'./useLegalLinkContent'
	)),
	useLegalLinkContent: vi.fn()
}));

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, fallback?: string) => fallback ?? key,
		i18n: { language: 'de' }
	})
}));

const mockedContent = vi.mocked(useLegalLinkContent);

const renderModal = () =>
	render(
		<LegalLinkModal
			title="Datenschutz"
			rawLabel="privacy"
			url="https://traeger.example/datenschutz"
			onClose={() => undefined}
		/>
	);

describe('LegalLinkModal', () => {
	// Kein automatisches Aufräumen in dieser Suite-Konfiguration — sonst finden die
	// Abfragen die Knoten der vorherigen Darstellung mit.
	afterEach(() => {
		cleanup();
		vi.clearAllMocks();
	});

	it('shows the text the operator authored', () => {
		mockedContent.mockReturnValue({
			kind: 'privacy',
			content: '<p>Vom Träger gepflegter Datenschutztext.</p>'
		});

		renderModal();

		expect(
			screen.getByText('Vom Träger gepflegter Datenschutztext.')
		).toBeTruthy();
	});

	/**
	 * The regression this file exists for: the modal used to carry a hardcoded English
	 * consent agreement naming an operator that does not exist, shown to help-seekers in
	 * the session views whenever no legal text was configured. A legal text must never be
	 * invented by the client — it comes from the tenant's legal text objects (ADR-014,
	 * ADR-021) or it is absent, and then we say so.
	 */
	it('never invents a legal text when none is configured', () => {
		mockedContent.mockReturnValue({ kind: 'privacy', content: null });

		const { container } = renderModal();
		const text = container.textContent ?? '';

		expect(text).not.toMatch(/CONSENT AGREEMENT/i);
		expect(text).not.toMatch(/Sunflower/i);
		expect(text).not.toMatch(/WeCare Remote/i);
		// Unsubstituted template markers must never reach a reader either.
		expect(text).not.toMatch(/\{\{[A-Z ]+\}\}/);
	});

	it('says that no text is configured and offers the configured address instead', () => {
		mockedContent.mockReturnValue({ kind: 'privacy', content: null });

		renderModal();

		expect(screen.getByTestId('legal-missing')).toBeTruthy();
		const link = screen.getByRole('link');
		expect(link.getAttribute('href')).toBe(
			'https://traeger.example/datenschutz'
		);
		expect(link.getAttribute('rel')).toContain('noopener');
	});

	it('omits the address when the deployment configured none', () => {
		mockedContent.mockReturnValue({ kind: 'privacy', content: null });

		render(
			<LegalLinkModal
				title="Datenschutz"
				rawLabel="privacy"
				url=""
				onClose={() => undefined}
			/>
		);

		expect(screen.getByTestId('legal-missing')).toBeTruthy();
		expect(screen.queryByRole('link')).toBeNull();
	});

	/**
	 * Platform scope: the login screen has no tenant yet, so the modal must
	 * ignore any carrier-authored text a tenant later configures and render the
	 * translated platform note instead, with the full binding document linked.
	 */
	it('renders the platform note and full-text link when scope is platform', () => {
		mockedContent.mockReturnValue({
			kind: 'privacy',
			content: '<p>Vom Träger gepflegter Datenschutztext.</p>'
		});

		render(
			<LegalLinkModal
				title="Datenschutz"
				rawLabel="privacy"
				url="https://platform.example/datenschutz"
				scope="platform"
				onClose={() => undefined}
			/>
		);

		expect(screen.getByTestId('legal-platform')).toBeTruthy();
		expect(screen.queryByTestId('legal-missing')).toBeNull();
		expect(
			screen.queryByText('Vom Träger gepflegter Datenschutztext.')
		).toBeNull();

		const link = screen.getByRole('link');
		expect(link.getAttribute('href')).toBe(
			'https://platform.example/datenschutz'
		);
		expect(link.getAttribute('rel')).toContain('noopener');
	});
});
