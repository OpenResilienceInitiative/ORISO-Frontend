// @vitest-environment oriso-jsdom
import * as React from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));

const { HandoverCarousel } = await import('./HandoverCarousel');

/**
 * Frank, 2026-10-15: the live-chat cards have the right desktop proportion,
 * every other waiting room had the phone one. The size is now the carousel's
 * own, so there is nothing left for a room to forget.
 */
describe('HandoverCarousel card size', () => {
	afterEach(cleanup);

	it('is the live-chat size with no per-room parameter', () => {
		const { container } = render(<HandoverCarousel />);
		const card = container.querySelector('[data-cy="handover-card-write"]');
		expect(card).not.toBeNull();
		const css = [...document.querySelectorAll('style')]
			.map((node) => node.textContent)
			.join('');
		// The card's emotion class carries both breakpoint widths, in rem and
		// clamp() — never a fixed px width (Frank, 2026-11-13).
		expect(css).toContain('width:18.75rem');
		expect(css).toMatch(/width:clamp\(12rem,/);
		expect(css).not.toMatch(/width:(300|372)px/);
	});
});
