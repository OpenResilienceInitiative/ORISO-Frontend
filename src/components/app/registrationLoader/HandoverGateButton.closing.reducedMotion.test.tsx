// @vitest-environment oriso-jsdom
import * as React from 'react';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { HandoverGateButton } from './HandoverGateButton';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));

const preferReducedMotion = (reduce: boolean) => {
	window.matchMedia = ((query: string) => ({
		matches: reduce && query.includes('prefers-reduced-motion'),
		media: query,
		addEventListener: () => undefined,
		removeEventListener: () => undefined,
		addListener: () => undefined,
		removeListener: () => undefined,
		dispatchEvent: () => false,
		onchange: null
	})) as typeof window.matchMedia;
};

/**
 * ORISO-Frontend#1737. The whole chain with nothing mocked: for a person who
 * asked for less motion the gate button draws nothing and still lets them in.
 */
describe('HandoverGateButton with reduced motion', () => {
	beforeEach(() => preferReducedMotion(true));
	afterEach(cleanup);

	it('lets the person in without drawing anything', async () => {
		const onEnter = vi.fn();
		render(
			<HandoverGateButton
				state="ready"
				closing="messageField"
				onEnter={onEnter}
			/>
		);

		fireEvent.click(
			document.querySelector('[data-cy="handover-gate-button"]')!
		);

		await waitFor(() => expect(onEnter).toHaveBeenCalledTimes(1));
		expect(document.querySelector('[data-closing-animation]')).toBeNull();
		await waitFor(() =>
			expect(
				document
					.querySelector('[data-cy="handover-gate-button"]')!
					.getAttribute('aria-busy')
			).toBe('false')
		);
	});
});
