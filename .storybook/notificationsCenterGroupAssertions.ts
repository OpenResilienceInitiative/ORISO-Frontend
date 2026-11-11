import { expect, waitFor } from 'storybook/test';

/** Assert the real group seam and outside corners, including during selection changes. */
export const expectTimelineGroupEnd = async (
	canvasElement: HTMLElement,
	previousId: string,
	lastId: string
) => {
	const card = (id: string) =>
		canvasElement.querySelector<HTMLElement>(
			`[data-notification-id="${id}"] .notificationsCenter__card`
		);
	const previous = card(previousId);
	const last = card(lastId);
	if (!previous || !last)
		throw new Error('Grouped timeline rows must render');
	await waitFor(() => {
		const upper = getComputedStyle(previous);
		const lower = getComputedStyle(last);
		expect(upper.borderBottomLeftRadius).toBe('0px');
		expect(upper.borderBottomRightRadius).toBe('0px');
		expect(lower.borderTopLeftRadius).toBe('0px');
		expect(lower.borderTopRightRadius).toBe('0px');
		expect(lower.borderBottomLeftRadius).toBe('32px');
		expect(lower.borderBottomRightRadius).toBe('32px');
		const upperBox = previous.getBoundingClientRect();
		const lowerBox = last.getBoundingClientRect();
		expect(Math.abs(upperBox.bottom - lowerBox.top)).toBeLessThan(1);
		expect(Math.abs(upperBox.left - lowerBox.left)).toBeLessThan(1);
		expect(Math.abs(upperBox.right - lowerBox.right)).toBeLessThan(1);
	});
};
