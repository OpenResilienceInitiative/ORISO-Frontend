// @vitest-environment jsdom

import * as React from 'react';
import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CheckAnimation, EmailSentAnimation } from './AnimatedIllustration';

vi.mock('lottie-react', () => ({
	default: ({ animationData }: { animationData: Record<string, any> }) => (
		<div
			data-lottie="true"
			data-colors={JSON.stringify(collectColors(animationData))}
		/>
	)
}));

vi.mock('../../resources/img/illustrations/check.svg', () => ({
	ReactComponent: (props: React.SVGProps<SVGSVGElement>) => (
		<svg data-testid="check-fallback" {...props} />
	)
}));
vi.mock('../../resources/img/illustrations/envelope-check.svg', () => ({
	ReactComponent: (props: React.SVGProps<SVGSVGElement>) => (
		<svg data-testid="email-sent-fallback" {...props} />
	)
}));

const toHex = (channels: number[]) =>
	`#${channels
		.slice(0, 3)
		.map((channel) =>
			Math.round(channel * 255)
				.toString(16)
				.padStart(2, '0')
		)
		.join('')}`;

function collectColors(value: unknown, found = new Set<string>()) {
	if (Array.isArray(value)) {
		value.forEach((item) => collectColors(item, found));
		return [...found];
	}

	if (value && typeof value === 'object') {
		Object.entries(value as Record<string, unknown>).forEach(
			([key, item]) => {
				const candidate = (item as { k?: unknown })?.k;

				if (
					(key === 'c' || key === 'v') &&
					Array.isArray(candidate) &&
					candidate.length === 4 &&
					candidate.every((channel) => typeof channel === 'number')
				) {
					found.add(toHex(candidate as number[]));
				}

				collectColors(item, found);
			}
		);
	}

	return [...found];
}

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

describe('AnimatedIllustration', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('recolours the source turquoise to the brand role before playing', () => {
		stubReducedMotion(false);
		const { container } = render(<CheckAnimation />);

		const colors = JSON.parse(
			container
				.querySelector('[data-lottie="true"]')
				?.getAttribute('data-colors') ?? '[]'
		);

		// jsdom resolves no custom properties, so the component falls back to
		// the literals the tokens carry.
		expect(colors).toContain('#a5000a');
		expect(colors).toContain('#444748');
		expect(colors).not.toContain('#33cccc');
	});

	it('renders the static illustration when the user prefers reduced motion', () => {
		stubReducedMotion(true);
		const { container, queryByTestId } = render(<CheckAnimation />);

		expect(queryByTestId('check-fallback')).toBeTruthy();
		expect(container.querySelector('[data-lottie="true"]')).toBeNull();
	});

	it('uses the e-mail animation and its own fallback for the sent state', () => {
		stubReducedMotion(true);
		const { queryByTestId } = render(<EmailSentAnimation />);

		expect(queryByTestId('email-sent-fallback')).toBeTruthy();
	});

	it('recolours the e-mail animation the same way as the check animation', () => {
		stubReducedMotion(false);
		const { container } = render(<EmailSentAnimation />);

		const colors = JSON.parse(
			container
				.querySelector('[data-lottie="true"]')
				?.getAttribute('data-colors') ?? '[]'
		);

		expect(colors).toContain('#a5000a');
		expect(colors).toContain('#444748');
		expect(colors).not.toContain('#33cccc');
	});
});
