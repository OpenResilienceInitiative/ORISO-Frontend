// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (_key: string, fallback?: string) => fallback ?? _key
	})
}));

/* eslint-disable-next-line import/first -- must load after the vi.mock call
   above, otherwise the real i18next module is pulled in first. */
import { AnonymousConsentGate } from './AnonymousConsentGate';

afterEach(() => {
	cleanup();
	delete (window as unknown as Record<string, unknown>).__consentGateXss;
});

/**
 * ADR-022 names this the *blocking dependency* for Gate 2: the sentence the
 * gate renders stops being frontend i18n and becomes a Träger-authored field
 * of the Beratungsstelle's data-protection policy (ADR-021 decision 4). The
 * old `dangerouslySetInnerHTML` had no sanitizer at all, so the moment that
 * text arrives from the backend, whoever can edit a legal text in the Admin
 * can execute script in the one dialog a help-seeker cannot get past.
 *
 * These tests pin both halves of the requirement — the payload dies, the link
 * lives. A sanitizer that also ate the anchor would be worse than none: a
 * consent sentence without a reachable policy is not a valid consent.
 */
describe('AnonymousConsentGate — Träger-authored HTML is sanitized', () => {
	const HOSTILE_LABEL = [
		'Ich habe die ',
		'<a href="https://beispiel-traeger.de/datenschutz" target="_blank" rel="noreferrer">',
		'Datenschutzbestimmungen',
		'</a>',
		' zur Kenntnis genommen.',
		'<script>window.__consentGateXss = "script";</script>',
		'<img src="https://beispiel-traeger.de/x.png" ',
		'onerror="window.__consentGateXss = \'onerror\'">',
		'<a href="javascript:window.__consentGateXss = \'href\'">tap me</a>'
	].join('');

	const renderHostileGate = () =>
		render(
			<AnonymousConsentGate
				consentLabelHtml={HOSTILE_LABEL}
				onAccept={vi.fn()}
			/>
		);

	it('strips a <script> payload instead of mounting it', () => {
		const { container } = renderHostileGate();

		expect(container.querySelector('script')).toBeNull();
		expect(container.innerHTML).not.toContain('__consentGateXss');
		expect(
			(window as unknown as Record<string, unknown>).__consentGateXss
		).toBeUndefined();
	});

	it('strips inline event handlers such as onerror', () => {
		const { container } = renderHostileGate();

		container.querySelectorAll('*').forEach((element) => {
			element.getAttributeNames().forEach((attribute) => {
				expect(attribute.toLowerCase().startsWith('on')).toBe(false);
			});
		});
		expect(container.innerHTML).not.toContain('onerror');
	});

	it('strips a javascript: URL while keeping the legitimate policy link', () => {
		const { container } = renderHostileGate();

		const hrefs = Array.from(container.querySelectorAll('a')).map(
			(anchor) => anchor.getAttribute('href')
		);
		expect(
			/* eslint-disable-next-line no-script-url -- asserting the scheme is absent, not producing one. */
			hrefs.some((href) => (href || '').startsWith('javascript:'))
		).toBe(false);

		const policyLink = screen.getByRole('link', {
			name: 'Datenschutzbestimmungen'
		});
		expect(policyLink.getAttribute('href')).toBe(
			'https://beispiel-traeger.de/datenschutz'
		);
		expect(policyLink.getAttribute('target')).toBe('_blank');
		expect(policyLink.getAttribute('rel')).toBe('noreferrer');
	});

	it('keeps the surrounding sentence readable', () => {
		renderHostileGate();

		expect(screen.getByText(/zur Kenntnis genommen\./)).toBeDefined();
	});
});
