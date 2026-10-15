// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

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
		// The card's emotion class carries both breakpoint widths.
		expect(css).toContain('width:300px');
		expect(css).toContain('width:372px');
	});

	it('takes no card width from the caller', () => {
		// @ts-expect-error the prop is gone on purpose
		const props: React.ComponentProps<typeof HandoverCarousel> = {
			cardWidth: { xs: 250, sm: 264 }
		};
		expect(props).toBeDefined();
	});
});
