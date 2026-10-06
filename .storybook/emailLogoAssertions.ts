import { expect, waitFor } from 'storybook/test';

/** Browser assertions exercise loaded assets and the iframe's actual mobile media query. */
export const verifyEmailLogoVariants = async ({
	canvasElement
}: {
	canvasElement: HTMLElement;
}) => {
	await waitFor(() =>
		expect(canvasElement.querySelectorAll('iframe')).toHaveLength(4)
	);
	const frames = Array.from(canvasElement.querySelectorAll('iframe'));
	for (const [index, frame] of frames.entries()) {
		await waitFor(() => {
			const image = frame.contentDocument?.querySelector('img');
			expect(image?.complete && image.naturalWidth > 0).toBe(true);
		});
		const doc = frame.contentDocument!;
		const image = doc.querySelector('img')!;
		const bounds = image.getBoundingClientRect();
		expect(bounds.height).toBeCloseTo(48, 1);
		expect(bounds.width / bounds.height).toBeCloseTo(
			image.naturalWidth / image.naturalHeight,
			2
		);
		const name = doc.querySelector('.logo-wordmark')!;
		const hidden =
			doc.defaultView!.getComputedStyle(name).display === 'none';
		expect(hidden).toBe(
			index === 3 && doc.documentElement.clientWidth <= 620
		);
		expect(
			doc.documentElement.scrollWidth,
			`fixture ${index}: viewport ${doc.documentElement.clientWidth}`
		).toBeLessThanOrEqual(doc.documentElement.clientWidth + 1);
	}
};
