// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LegalLinkModal, getInternalPath } from './LegalLinkModal';
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

		expect(
			screen.getByText(/dieser Hinweis gilt für die Plattform selbst/i)
		).toBeTruthy();

		const link = screen.getByRole('link');
		expect(link.getAttribute('href')).toBe(
			'https://platform.example/datenschutz'
		);
		expect(link.getAttribute('target')).toBe('_blank');
		const rel = link.getAttribute('rel') ?? '';
		expect(rel).toContain('noopener');
		expect(rel).toContain('noreferrer');
	});

	/**
	 * The complaint this dialog exists for: `/impressum` and `/datenschutz` are
	 * routes of THIS app, and the configured legal URL points at them by default.
	 * Opening them with `target="_blank"` boots the whole SPA a second time in a
	 * new tab — "something completely new gets loaded" — which is precisely what
	 * moving the text into a dialog was meant to stop. A same-origin target must
	 * therefore be a router navigation, not a new tab.
	 */
	it('navigates in-app instead of opening a tab when the full text is a route of this app', () => {
		mockedContent.mockReturnValue({ kind: 'privacy', content: null });

		render(
			<MemoryRouter>
				<LegalLinkModal
					title="Datenschutz"
					rawLabel="privacy"
					url={`${window.location.origin}/datenschutz`}
					scope="platform"
					onClose={() => undefined}
				/>
			</MemoryRouter>
		);

		const link = screen.getByRole('link');
		expect(link.getAttribute('href')).toBe('/datenschutz');
		expect(link.getAttribute('target')).toBeNull();
	});

	it('closes the dialog when the in-app navigation is taken', () => {
		mockedContent.mockReturnValue({ kind: 'privacy', content: null });
		const onClose = vi.fn();

		render(
			<MemoryRouter>
				<LegalLinkModal
					title="Datenschutz"
					rawLabel="privacy"
					url={`${window.location.origin}/datenschutz`}
					scope="platform"
					onClose={onClose}
				/>
			</MemoryRouter>
		);

		fireEvent.click(screen.getByRole('link'));
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it('offers both the dismissing and the confirming action', () => {
		mockedContent.mockReturnValue({ kind: 'privacy', content: null });

		renderModal();

		expect(screen.getByTestId('legal-modal-back')).toBeTruthy();
		expect(screen.getByTestId('legal-modal-confirm')).toBeTruthy();
	});
});

describe('getInternalPath', () => {
	it('keeps path, query and hash of a same-origin URL', () => {
		expect(
			getInternalPath(`${window.location.origin}/impressum?a=1#top`)
		).toBe('/impressum?a=1#top');
	});

	it('returns null for a different origin', () => {
		expect(getInternalPath('https://traeger.example/impressum')).toBeNull();
	});

	/**
	 * Same-origin is not enough. A deployment may point the legal URL at a
	 * same-origin document that is not a route — the router has none for it and
	 * would funnel the reader into the authenticated catch-all instead of the
	 * document.
	 */
	it('returns null for a same-origin path that is not a legal route', () => {
		expect(
			getInternalPath(`${window.location.origin}/documents/privacy.pdf`)
		).toBeNull();
		expect(
			getInternalPath(`${window.location.origin}/impressum/extra`)
		).toBeNull();
	});

	/**
	 * `routePathNames` records intent; the router records reality. The terms
	 * route is commented out in `initApp.tsx`, so `/nutzungsbedingungen` is an
	 * unknown path and routing to it would land the reader on the authenticated
	 * catch-all. Flip this test in the same change that re-enables the route.
	 */
	it('returns null for a legal path whose route is not registered', () => {
		expect(
			getInternalPath(`${window.location.origin}/nutzungsbedingungen`)
		).toBeNull();
	});

	it('tolerates a trailing slash on a legal route', () => {
		expect(getInternalPath(`${window.location.origin}/impressum/`)).toBe(
			'/impressum'
		);
	});

	/** A protocol-relative or userinfo-disguised host is a foreign origin. */
	it('returns null for a URL that only looks same-origin', () => {
		expect(getInternalPath('//evil.example/impressum')).toBeNull();
		expect(
			getInternalPath(
				`https://${window.location.host}@evil.example/impressum`
			)
		).toBeNull();
	});

	/** A malformed address is handed to the browser, never fed to the router. */
	it('returns null for a URL it cannot parse', () => {
		expect(getInternalPath('http://[::1')).toBeNull();
	});
});
