// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Registration } from './Registration';
import {
	AppConfigContext,
	LocaleContext,
	NotificationsContext,
	RegistrationContext,
	TenantContext
} from '../../globalState';
import { GlobalComponentContext } from '../../globalState/provider/GlobalComponentContext';
import { registrationMd3 } from './registrationDesign/registrationDesign';

/**
 * Lottie touches a canvas 2d context at module load and jsdom has none. The
 * stage is mocked away below anyway; this only keeps the import graph loadable.
 */
vi.mock('lottie-react', () => ({ default: () => null }));

/**
 * The registration screen is wrapped in the full stage chrome (hero panel,
 * legal links, locale switch, info drawer), none of which can influence a
 * `position: fixed` bar. Replacing it with a passthrough keeps this test about
 * the footer instead of about six more providers.
 */
vi.mock('../../components/stageLayout/StageLayout', () => ({
	StageLayout: ({ children }: { children: React.ReactNode }) => (
		<div data-testid="stage-layout">{children}</div>
	)
}));

/**
 * # What this file is for
 *
 * The registration footer — the bar that sits at the bottom of every step —
 * was built inline inside `Registration.tsx` and is being replaced by the
 * shared `RegistrationFooter` component. This test describes the bar by the
 * properties a user can perceive, never by which component produced them, so
 * the *same* assertions run against the inline version and against the
 * component. Green before the swap and green after it is the proof that the
 * two are equivalent.
 *
 * It therefore deliberately does not assert: the element's tag, its emotion
 * class, `data-cy="registration-footer"` (which only the new component has),
 * or how the inner content is centred.
 *
 * ## Why the CSS is resolved by hand
 *
 * jsdom's `getComputedStyle` walks `@media` rules only when the media text
 * contains the word `screen`, and MUI's breakpoint values are emitted as
 * `@media (min-width:1200px)`. So every responsive value — and `width` is one
 * of them, because MUI puts even the `xs` value in `@media (min-width:0px)` —
 * is invisible to `getComputedStyle` here. jsdom also drops declarations its
 * CSS parser does not know (`backdrop-filter`) and does not expand the
 * `border-top` shorthand. `declarationsFor()` below reads the stylesheet text
 * instead and evaluates the breakpoints against a stated viewport width, which
 * is what lets the width assertion say something about both sides of the
 * breakpoint.
 */

interface CssBlock {
	/** The `@media` condition this block sits under, `null` at the top level. */
	media: string | null;
	selector: string;
	body: string;
}

/** Flattens a stylesheet into style blocks, descending into `@media` only. */
const collectBlocks = (
	css: string,
	media: string | null,
	into: CssBlock[]
): void => {
	let cursor = 0;
	while (cursor < css.length) {
		const open = css.indexOf('{', cursor);
		if (open === -1) {
			return;
		}
		const prelude = css.slice(cursor, open).trim();
		let depth = 1;
		let end = open + 1;
		while (end < css.length && depth > 0) {
			if (css[end] === '{') {
				depth += 1;
			} else if (css[end] === '}') {
				depth -= 1;
			}
			end += 1;
		}
		const body = css.slice(open + 1, end - 1);
		if (prelude.startsWith('@media')) {
			collectBlocks(body, prelude.slice('@media'.length).trim(), into);
		} else if (!prelude.startsWith('@')) {
			// `@keyframes`, `@supports`, `@container` are not needed here and
			// their bodies would only add noise.
			into.push({ media, selector: prelude, body });
		}
		cursor = end;
	}
};

const mediaApplies = (media: string | null, viewportWidth: number): boolean => {
	if (media === null) {
		return true;
	}
	// A user-preference query is not a viewport question; the reduced-motion
	// block must not be folded into the normal reading of the bar.
	if (/prefers-|print|hover|pointer/.test(media)) {
		return false;
	}
	const min = media.match(/min-width:\s*([\d.]+)px/);
	const max = media.match(/max-width:\s*([\d.]+)px/);
	if (min && viewportWidth < Number(min[1])) {
		return false;
	}
	if (max && viewportWidth > Number(max[1])) {
		return false;
	}
	return true;
};

const splitDeclarations = (body: string): [string, string][] =>
	body
		.split(';')
		.map((part) => part.trim())
		.filter(Boolean)
		.map((part) => {
			const colon = part.indexOf(':');
			return [
				part.slice(0, colon).trim(),
				part.slice(colon + 1).trim()
			] as [string, string];
		})
		.filter(([property]) => property.length > 0);

/**
 * Every style block addressing `element` directly, in source order. Blocks are
 * matched by the element's own classes, which is all emotion and MUI ever
 * produce for an `sx` prop.
 */
const blocksFor = (element: Element): CssBlock[] => {
	const css = Array.from(document.querySelectorAll('style'))
		.map((node) => node.textContent ?? '')
		.join('\n');
	const blocks: CssBlock[] = [];
	collectBlocks(css, null, blocks);

	const own = new Set(Array.from(element.classList, (name) => `.${name}`));
	return blocks.filter((block) =>
		block.selector
			.split(',')
			.some((selector) => own.has(selector.trim()))
	);
};

/** Every declaration that applies to `element` at `viewportWidth`, cascaded. */
const declarationsFor = (
	element: Element,
	viewportWidth: number
): Record<string, string> => {
	const resolved: Record<string, string> = {};
	blocksFor(element)
		.filter((block) => mediaApplies(block.media, viewportWidth))
		.forEach((block) => {
			splitDeclarations(block.body).forEach(([property, value]) => {
				resolved[property] = value;
			});
		});
	return resolved;
};

const PHONE = 375;
const DESKTOP = 1440;

const Step = () => <div data-testid="step-body" />;

const availableSteps = [
	{ name: 'topic-selection', component: Step },
	{ name: 'zipcode', component: Step },
	{ name: 'account-data', component: Step }
];

const renderRegistration = () =>
	render(
		<AppConfigContext.Provider value={{} as any}>
			<GlobalComponentContext.Provider
				value={{ Stage: () => <div /> } as any}
			>
				<NotificationsContext.Provider
					value={{ addNotification: () => undefined } as any}
				>
					<TenantContext.Provider value={{ tenant: null } as any}>
						<LocaleContext.Provider value={{ locale: 'de' } as any}>
							<RegistrationContext.Provider
								value={
									{
										disabledNextButton: false,
										setDisabledNextButton: () => undefined,
										updateRegistrationData: () =>
											undefined,
										registrationData: {},
										availableSteps,
										registrationConsultingType: null
									} as any
								}
							>
								<MemoryRouter
									initialEntries={['/registration/zipcode']}
								>
									<Routes>
										<Route
											path="/registration/:step"
											element={<Registration />}
										/>
									</Routes>
								</MemoryRouter>
							</RegistrationContext.Provider>
						</LocaleContext.Provider>
					</TenantContext.Provider>
				</NotificationsContext.Provider>
			</GlobalComponentContext.Provider>
		</AppConfigContext.Provider>
	);

/**
 * The bar found the way a user finds it: start at the navigation and walk up
 * until something is pinned to the viewport. No knowledge of which component
 * drew it, which is the whole point.
 */
const findFixedFooter = (): HTMLElement => {
	const nav = document.querySelector('[data-cy="registration-step-nav"]');
	expect(nav, 'registration step navigation is rendered').toBeTruthy();
	let candidate = (nav as HTMLElement).parentElement;
	while (candidate && window.getComputedStyle(candidate).position !== 'fixed') {
		candidate = candidate.parentElement;
	}
	expect(
		candidate,
		'the navigation sits inside a viewport-pinned bar'
	).toBeTruthy();
	return candidate as HTMLElement;
};

describe('registration footer — contract', () => {
	beforeEach(() => {
		sessionStorage.clear();
		renderRegistration();
	});

	afterEach(() => {
		cleanup();
	});

	it('is in the document and pinned to the bottom edge of the viewport', () => {
		const footer = findFixedFooter();
		const style = declarationsFor(footer, DESKTOP);

		expect(footer.isConnected).toBe(true);
		expect(style['position']).toBe('fixed');
		expect(style['bottom']).toBe('0');
		expect(style['right']).toBe('0');
		// Above the step content, below the modal layer.
		expect(style['z-index']).toBe('65');
	});

	it('carries the hairline on top and the translucent surface', () => {
		const style = declarationsFor(findFixedFooter(), DESKTOP);

		expect(style['border-top']).toBe(
			`1px solid ${registrationMd3.outlineVariant}`
		);
		expect(style['background-color']).toBe('rgba(255, 255, 255, 0.94)');
		expect(style['backdrop-filter']).toBe('blur(8px)');
	});

	it('holds the navigation actions', () => {
		const footer = findFixedFooter();

		const nav = footer.querySelector('[data-cy="registration-step-nav"]');
		expect(nav, 'the compact step navigation lives in the bar').toBeTruthy();
		expect(nav?.querySelector('[data-cy="registration-back"]')).toBeTruthy();
		expect(nav?.querySelector('[data-cy="registration-next"]')).toBeTruthy();

		// The wide layout has its own primary action next to the picks.
		expect(
			footer.querySelector('[data-cy="button-next"]'),
			'the wide-layout primary action lives in the bar'
		).toBeTruthy();
	});

	it('follows the stage split: full width below the breakpoint, the content column above it', () => {
		const footer = findFixedFooter();

		expect(declarationsFor(footer, PHONE)['width']).toBe('100vw');
		expect(declarationsFor(footer, DESKTOP)['width']).toBe('60vw');
	});

	it('keeps its height above the breakpoint and pads for the home indicator below it', () => {
		const footer = findFixedFooter();

		expect(declarationsFor(footer, DESKTOP)['min-height']).toBe('96px');
		expect(declarationsFor(footer, PHONE)['padding-bottom']).toContain(
			'env(safe-area-inset-bottom)'
		);
	});

	it('rises into place when the step appears, and holds still for reduced motion', () => {
		const footer = findFixedFooter();
		const style = declarationsFor(footer, DESKTOP);

		expect(style['animation']).toContain('registrationFooterEnter');

		const css = Array.from(document.querySelectorAll('style'))
			.map((node) => node.textContent ?? '')
			.join('\n');
		expect(css).toContain('@keyframes registrationFooterEnter');

		const reducedMotion = blocksFor(footer).filter((block) =>
			(block.media ?? '').includes('prefers-reduced-motion')
		);
		expect(
			reducedMotion.length,
			'the bar answers the reduced-motion preference'
		).toBeGreaterThan(0);
		expect(
			reducedMotion.some((block) =>
				splitDeclarations(block.body).some(
					([property, value]) =>
						property.endsWith('animation') && value === 'none'
				)
			),
			'reduced motion switches the entrance off'
		).toBe(true);
	});
});
