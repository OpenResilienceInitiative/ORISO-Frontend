// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
	useTranslation: () => {
		const catalogue: Record<string, string> = {
			'anonymousConsent.headline': 'Herzlich Willkommen',
			'anonymousConsent.description':
				'Danach kann eine beratende Person einen Chat mit Ihnen beginnen.',
			'anonymousChat.consent.reject': 'Ich stimme nicht zu',
			'anonymousChat.consent.accept': 'Ich bin einverstanden',
			'anonymousChat.consent.mustAcceptToContinue':
				'Um fortzufahren müssen Sie unseren Datenschutzbestimmungen zustimmen.'
		};
		return {
			t: (key: string) => catalogue[key] ?? key
		};
	}
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
		const { container } = renderGate();
		const dialog = container.querySelector('[role="dialog"]');

		/* Inside the dialog, not necessarily *on* it — the focus trap may settle
		   on the container or on its first control depending on the engine. What
		   matters is that focus is not left behind outside it. */
		expect(dialog?.contains(document.activeElement)).toBe(true);
	});

	/* Containment itself is not asserted here: jsdom does not move focus on Tab,
	   so a simulated Tab would pass against a dialog that leaks in a real
	   browser — a test that proves nothing while looking reassuring. The
	   behavioural proof runs in Chromium, Firefox and WebKit in
	   `playwright/consent-gate-focus.crossbrowser.spec.ts`. */

	it('keeps the reject button named although it renders as a bare ✕', () => {
		/* The design (CAR02 2183-14718) asks for an icon-only reject button, and
		   the labelled version was what pushed the action row out of the card at
		   375px (#892). Dropping the visible label is only safe as long as the
		   accessible name survives it — an unnamed button is announced as
		   "button", which is no choice at all next to "Ich bin einverstanden". */
		renderGate();
		const reject = screen.getByRole('button', {
			name: 'Ich stimme nicht zu'
		});

		expect(reject.textContent).toBe('');
	});

	it('says nothing gendered — the platform voice is neutral by reformulation', () => {
		const { container } = renderGate();
		const text = container.textContent ?? '';

		expect(text).not.toMatch(/Berater/i);
		expect(text).not.toMatch(/_innen|\*in\b|:innen/);
	});
});
