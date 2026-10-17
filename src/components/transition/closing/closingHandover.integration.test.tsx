// @vitest-environment jsdom
import * as React from 'react';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { HandoverGateButton } from '../../app/registrationLoader/HandoverGateButton';
import { TenantContext } from '../../../globalState/provider/TenantProvider';
import { TenantDataInterface } from '../../../globalState/interfaces';
import { transitionMotion } from '../transitionMotion';
import { CLOSING_HANDOVER_KEY } from './closingHandover';
import { resumeClosingAnimation } from './playClosingAnimation';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));

const ROOT = '[data-closing-animation]';

const installAnimate = () => {
	const animate = vi.fn(() => ({
		finish: vi.fn(),
		finished: Promise.resolve()
	}));
	(Element.prototype as unknown as { animate: unknown }).animate = animate;
	(document.documentElement as unknown as { animate: unknown }).animate =
		animate;
};

const tenant = {
	id: 1,
	name: 'Handover story',
	theming: {
		closingAnimationDesktop: 'CURTAIN',
		closingAnimationMobile: 'SLIDE_REVEAL'
	}
} as unknown as TenantDataInterface;

const gate = () =>
	document.querySelector<HTMLButtonElement>(
		'[data-cy="handover-gate-button"]'
	)!;

const viewportIs = (desktop: boolean) => {
	window.matchMedia = vi.fn(
		(query: string) =>
			({
				matches: desktop && query.includes('min-width'),
				media: query
			}) as MediaQueryList
	) as unknown as typeof window.matchMedia;
};

/**
 * ORISO-Frontend#1737, both halves through the real gate button. The live-chat
 * room saves the consent and then replaces the whole page, so its `onEnter`
 * never settles. The cover must survive that: the old document leaves a note
 * when it goes, and the next document plays the reveal in the design the
 * tenant chose for the screen the person pressed on.
 */
describe('a waiting room that replaces the page', () => {
	beforeEach(() => {
		vi.useFakeTimers({
			toFake: [
				'setTimeout',
				'clearTimeout',
				'Date',
				'requestAnimationFrame'
			]
		});
		installAnimate();
	});
	afterEach(() => {
		cleanup();
		vi.restoreAllMocks();
		vi.useRealTimers();
		delete (Element.prototype as unknown as { animate?: unknown }).animate;
		delete (document.documentElement as unknown as { animate?: unknown })
			.animate;
		delete (window as unknown as { matchMedia?: unknown }).matchMedia;
		document.body.innerHTML = '';
		window.sessionStorage.clear();
	});

	const pressAndReplaceThePage = async () => {
		render(
			<TenantContext.Provider
				value={{
					tenant,
					setTenant: () => undefined,
					updateTenantSettings: () => undefined
				}}
			>
				<HandoverGateButton
					state="ready"
					closing="messageField"
					// The page is being replaced: this never settles.
					onEnter={() => new Promise<void>(() => undefined)}
				/>
			</TenantContext.Provider>
		);
		vi.spyOn(gate(), 'getBoundingClientRect').mockReturnValue({
			left: 412,
			top: 600,
			width: 200,
			height: 60,
			right: 612,
			bottom: 660,
			x: 412,
			y: 600,
			toJSON: () => ({})
		});
		fireEvent.click(gate());
		await act(async () => {
			await vi.advanceTimersByTimeAsync(400);
		});
		expect(
			document.querySelector(ROOT)?.getAttribute('data-closing-phase')
		).toBe('covered');
		window.dispatchEvent(new Event('pagehide'));
	};

	it.each([
		['a wide screen', true, 'curtain'],
		['a phone', false, 'slideReveal']
	] as const)(
		'hands the design for %s to the next document, which covers its page with it',
		async (_name, desktop, variant) => {
			viewportIs(desktop);
			await pressAndReplaceThePage();

			const note = JSON.parse(
				window.sessionStorage.getItem(CLOSING_HANDOVER_KEY) ?? 'null'
			);
			expect(note).toMatchObject({
				variant,
				focal: 'messageField',
				origin: {
					x: 512 / window.innerWidth,
					y: 630 / window.innerHeight
				}
			});

			// The old document is gone; the next one starts.
			document.body.innerHTML = '';
			void resumeClosingAnimation();
			const resumed = document.querySelector(ROOT);
			expect(resumed?.getAttribute('data-closing-animation')).toBe(
				variant
			);
			expect(resumed?.getAttribute('data-closing-phase')).toBe('covered');

			await act(async () => {
				await vi.advanceTimersByTimeAsync(
					transitionMotion.closing.handoverFocalWaitMs + 1500
				);
			});
			expect(document.querySelector(ROOT)).toBeNull();
		}
	);
});
