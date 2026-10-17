// @vitest-environment jsdom
import * as React from 'react';
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TenantContext } from '../../../globalState/provider/TenantProvider';
import { TenantDataInterface } from '../../../globalState/interfaces';

const playClosingAnimation = vi.fn(async () => ({ played: true }));
vi.mock('./playClosingAnimation', () => ({
	playClosingAnimation: (options: unknown) => playClosingAnimation(options)
}));

const { useClosingAnimation } = await import('./useClosingAnimation');

const screenIs = (query: { desktop: boolean; reducedMotion: boolean }) => {
	window.matchMedia = ((q: string) => ({
		matches: q.includes('prefers-reduced-motion')
			? query.reducedMotion
			: q.includes('min-width: 1200px')
				? query.desktop
				: false,
		media: q,
		addEventListener: () => undefined,
		removeEventListener: () => undefined,
		addListener: () => undefined,
		removeListener: () => undefined,
		dispatchEvent: () => false,
		onchange: null
	})) as typeof window.matchMedia;
};

const withTenant = (theming?: Record<string, unknown>) =>
	function Wrapper({ children }: { children: React.ReactNode }) {
		const tenant = theming
			? ({ theming } as unknown as TenantDataInterface)
			: undefined;
		return (
			<TenantContext.Provider
				value={{
					tenant,
					setTenant: () => undefined,
					updateTenantSettings: () => undefined
				}}
			>
				{children}
			</TenantContext.Provider>
		);
	};

const pressed = async (
	theming?: Record<string, unknown>,
	focal: 'messageField' | 'call' = 'messageField'
) => {
	const { result } = renderHook(() => useClosingAnimation(), {
		wrapper: withTenant(theming)
	});
	await result.current.play({
		focal,
		onCovered: () => undefined
	});
	return playClosingAnimation.mock.calls.at(-1)?.[0] as unknown as {
		variant: string;
		reducedMotion: boolean;
		focal: string;
	};
};

/**
 * ORISO-Frontend#1737. One hook answers, for every waiting room, which design
 * plays and whether it plays at all.
 */
describe('useClosingAnimation', () => {
	beforeEach(() => playClosingAnimation.mockClear());
	afterEach(() => vi.restoreAllMocks());

	const theming = {
		closingAnimationDesktop: 'CIRCLE_ZOOM',
		closingAnimationMobile: 'SLIDE_REVEAL'
	};

	it("plays the tenant's desktop design on a desktop width", async () => {
		screenIs({ desktop: true, reducedMotion: false });
		expect((await pressed(theming)).variant).toBe('circleZoom');
	});

	it("plays the tenant's mobile design on anything narrower", async () => {
		screenIs({ desktop: false, reducedMotion: false });
		expect((await pressed(theming)).variant).toBe('slideReveal');
	});

	it('plays the platform default when no tenant is known', async () => {
		screenIs({ desktop: true, reducedMotion: false });
		expect((await pressed(undefined)).variant).toBe('curtain');
	});

	it("hands the room's focal point on untouched", async () => {
		screenIs({ desktop: true, reducedMotion: false });
		expect((await pressed(theming, 'call')).focal).toBe('call');
		expect((await pressed(theming, 'messageField')).focal).toBe(
			'messageField'
		);
	});

	it('tells the engine to skip when the person asked for less motion', async () => {
		screenIs({ desktop: true, reducedMotion: true });
		expect((await pressed(theming)).reducedMotion).toBe(true);
	});

	it('does not skip for a person who did not ask', async () => {
		screenIs({ desktop: true, reducedMotion: false });
		expect((await pressed(theming)).reducedMotion).toBe(false);
	});
});
