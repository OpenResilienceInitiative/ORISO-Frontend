// @vitest-environment jsdom

import * as React from 'react';
import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EmptyStateAnimation } from './EmptyStateAnimation';
import { EmptyState } from './EmptyState';
import archiveAnimation from '../../resources/animations/emptyStates/archive.json';

const { fakeLottieInstance } = vi.hoisted(() => ({
	fakeLottieInstance: {
		setSpeed: vi.fn(),
		goToAndStop: vi.fn(),
		getDuration: vi.fn().mockReturnValue(120)
	}
}));

vi.mock('lottie-react', () => {
	const MockLottie = ({
		autoplay,
		lottieRef,
		onDOMLoaded
	}: {
		autoplay: boolean;
		lottieRef: React.MutableRefObject<unknown>;
		onDOMLoaded?: () => void;
	}) => {
		React.useEffect(() => {
			lottieRef.current = fakeLottieInstance;
			onDOMLoaded?.();
			// eslint-disable-next-line react-hooks/exhaustive-deps
		}, []);

		return <div data-lottie="true" data-autoplay={String(autoplay)} />;
	};

	return { default: MockLottie };
});

const stubReducedMotion = (matches: boolean) =>
	vi.stubGlobal(
		'matchMedia',
		vi.fn().mockReturnValue({
			matches,
			media: '(prefers-reduced-motion: reduce)',
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			addListener: vi.fn(),
			removeListener: vi.fn()
		} as unknown as MediaQueryList)
	);

describe('EmptyStateAnimation', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('autoplays the animation when no motion preference is set', () => {
		stubReducedMotion(false);
		const { container } = render(
			<EmptyStateAnimation
				animationData={archiveAnimation}
				variant="archive"
			/>
		);

		const lottie = container.querySelector('[data-lottie="true"]');
		expect(lottie?.getAttribute('data-autoplay')).toBe('true');
		expect(fakeLottieInstance.setSpeed).toHaveBeenCalledWith(0.5);
		expect(fakeLottieInstance.goToAndStop).not.toHaveBeenCalled();
		expect(
			container
				.querySelector('[data-cy="empty-state-animation"]')
				?.getAttribute('data-reduced-motion')
		).toBe('false');
	});

	it('renders the final frame statically when the user prefers reduced motion', () => {
		stubReducedMotion(true);
		const { container } = render(
			<EmptyStateAnimation
				animationData={archiveAnimation}
				variant="archive"
			/>
		);

		const lottie = container.querySelector('[data-lottie="true"]');
		expect(lottie?.getAttribute('data-autoplay')).toBe('false');
		// 120 frames reported by the fake instance -> static jump to frame 119
		expect(fakeLottieInstance.goToAndStop).toHaveBeenCalledWith(119, true);

		const wrapper = container.querySelector(
			'[data-cy="empty-state-animation"]'
		);
		expect(wrapper?.getAttribute('data-reduced-motion')).toBe('true');
		expect(wrapper?.getAttribute('data-complete')).toBe('true');
	});
});

describe('EmptyState', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('propagates reduced motion to its animation', () => {
		stubReducedMotion(true);
		const { container } = render(
			<EmptyState headline="Nothing here yet" variant="archive" />
		);

		expect(
			container
				.querySelector('[data-cy="empty-state-animation"]')
				?.getAttribute('data-reduced-motion')
		).toBe('true');
		expect(
			container
				.querySelector('[data-lottie="true"]')
				?.getAttribute('data-autoplay')
		).toBe('false');
	});
});
