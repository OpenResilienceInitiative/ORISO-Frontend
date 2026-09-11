// @vitest-environment jsdom

import * as React from 'react';
import { render } from '@testing-library/react';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	ANIMATION_LOOPS,
	ANIMATION_SPEED,
	CheckAnimation,
	EmailSentAnimation
} from './AnimatedIllustration';

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

// Paths stay relative to the repo root, matching what `grep -rl src/` printed
// and the cwd-relative readFileSync further down.
const scriptFilesUnder = (dir: string): string[] =>
	readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const entryPath = path.join(dir, entry.name);
		return entry.isDirectory()
			? scriptFilesUnder(entryPath)
			: /\.(?:js|jsx|ts|tsx)$/.test(entry.name)
				? [entryPath]
				: [];
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

describe('animation playback policy', () => {
	it('is the only component that talks to lottie-react', () => {
		// Two players with two speeds is what this consolidation removed; a new
		// direct import would let them drift apart again.
		//
		// Searched in-process rather than by shelling out to grep: execSync
		// blocks the worker's event loop, and vitest's testTimeout is itself a
		// JS timer, so it cannot fire while that loop is blocked. A stalled
		// child process here could not be timed out by the test runner and ran
		// to GitHub's 6 h job ceiling instead.
		const hits = scriptFilesUnder('src').filter(
			(file) =>
				!file.endsWith('.test.tsx') &&
				readFileSync(file, 'utf8').includes("from 'lottie-react'")
		);

		expect(hits).toEqual([
			'src/components/animatedIllustration/AnimatedIllustration.tsx'
		]);
	});

	it('pins one speed and no looping for the whole product', () => {
		expect(ANIMATION_SPEED).toBe(0.5);
		expect(ANIMATION_LOOPS).toBe(false);
	});

	it('never lets a caller override playback', () => {
		const source = readFileSync(
			'src/components/animatedIllustration/AnimatedIllustration.tsx',
			'utf8'
		);
		const props = source.slice(
			source.indexOf('interface AnimatedIllustrationProps'),
			source.indexOf('export const AnimatedIllustration')
		);

		expect(props).not.toMatch(/\bspeed\b/);
		expect(props).not.toMatch(/\bloop\b/);
	});
});
