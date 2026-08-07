// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (_key: string, fallback?: string) => fallback ?? _key
	})
}));

vi.mock('../../resources/img/icons/privacy-shield.svg', () => ({
	ReactComponent: (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />
}));

/* eslint-disable-next-line import/first -- must load after the vi.mock calls
   above, otherwise the real i18next and SVG modules are pulled in first. */
import { AnonymousConsentGate } from './AnonymousConsentGate';

afterEach(cleanup);

const renderGate = () =>
	render(
		<AnonymousConsentGate
			consentLabelHtml="<span>Ich habe die Datenschutzbestimmungen zur Kenntnis genommen.</span>"
			onAccept={vi.fn()}
		/>
	);

/**
 * ORISO-UserService#927 filed this as "the gate claims `role="dialog"`
 * `aria-modal="true"` although it renders as an inline card in the chat stream,
 * so screen readers are told the wrong thing" — and asked for both attributes
 * to be removed.
 *
 * That premise no longer holds. The gate has since become a **screen-filling
 * blocking gate**: `SessionItemComponent` renders it *instead of* the
 * conversation, and the composer is hidden while it is up. It really is a
 * modal dialog, so removing the role would make it less accessible, not more.
 *
 * What was genuinely wrong is that `aria-modal` was **unbacked**: nothing
 * named the dialog, nothing described it, and focus was never moved into it —
 * a screen-reader user landed outside a dialog they cannot leave. These tests
 * pin the behaviour that makes the claim true.
 */
describe('AnonymousConsentGate — accessibility of a blocking gate', () => {
	it('is exposed as a modal dialog, because that is what it is', () => {
		const { container } = renderGate();
		const dialog = container.querySelector('[role="dialog"]');

		expect(dialog).toBeTruthy();
		expect(dialog?.getAttribute('aria-modal')).toBe('true');
	});

	it('is named by its own heading rather than by nothing at all', () => {
		renderGate();

		expect(
			screen.getByRole('dialog', { name: 'Herzlich Willkommen' })
		).toBeTruthy();
	});

	it('is described by the consent request, so the ask is announced with it', () => {
		const { container } = renderGate();
		const describedBy = container
			.querySelector('[role="dialog"]')
			?.getAttribute('aria-describedby');

		expect(describedBy).toBeTruthy();
		expect(
			container.querySelector(`#${describedBy}`)?.textContent
		).toContain('beratende Person');
	});

	it('moves focus into the gate on mount instead of leaving it behind', () => {
		renderGate();

		expect(document.activeElement).toBe(
			document.querySelector('[role="dialog"]')
		);
	});

	it('says nothing gendered — the platform voice is neutral by reformulation', () => {
		const { container } = renderGate();
		const text = container.textContent ?? '';

		expect(text).not.toMatch(/Berater/i);
		expect(text).not.toMatch(/_innen|\*in\b|:innen/);
	});
});
