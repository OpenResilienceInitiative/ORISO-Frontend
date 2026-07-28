import { describe, expect, it, vi } from 'vitest';
import { focusSessionChromeOnPointerDown } from './focusSessionChrome';

describe('focusSessionChromeOnPointerDown', () => {
	it('focuses the session chrome when clicking outside the composer', () => {
		const focus = vi.fn();
		const currentTarget = { focus } as unknown as HTMLElement;
		const target = {
			closest: (selector: string) =>
				selector.includes('button') ||
				selector.includes('.textarea') ||
				selector.includes('[tabindex]')
					? null
					: null
		} as unknown as HTMLElement;

		focusSessionChromeOnPointerDown({
			target,
			currentTarget
		} as any);

		expect(focus).toHaveBeenCalledWith({ preventScroll: true });
	});

	it('does not steal focus when the composer is the click target', () => {
		const focus = vi.fn();
		const currentTarget = { focus } as unknown as HTMLElement;
		const target = {
			closest: (selector: string) =>
				selector.includes('.textarea') ? {} : null
		} as unknown as HTMLElement;

		focusSessionChromeOnPointerDown({
			target,
			currentTarget
		} as any);

		expect(focus).not.toHaveBeenCalled();
	});
});
