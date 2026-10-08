// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Spinner } from './Spinner';

describe('Spinner compatibility', () => {
	beforeEach(() => {
		vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
			null
		);
	});

	afterEach(() => {
		cleanup();
		vi.restoreAllMocks();
	});

	it('keeps the brand orbital palette when isDark is omitted', () => {
		const { container } = render(<Spinner className="theme-loader" />);

		expect(container.querySelector('.orbitalTrails--brand')).not.toBeNull();
		expect(screen.getAllByRole('status')).toHaveLength(1);
		expect(
			screen.getByRole('status').classList.contains('theme-loader')
		).toBe(true);
	});

	it('uses the neutral dark-foreground palette when isDark is requested', () => {
		const { container } = render(<Spinner isDark />);

		expect(
			container.querySelector('.orbitalTrails--neutral')
		).not.toBeNull();
		expect(screen.getAllByRole('status')).toHaveLength(1);
	});
});
