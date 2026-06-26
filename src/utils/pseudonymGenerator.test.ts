// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderAvatarSvg, type Avatar } from './pseudonymGenerator';

const avatar = (file: string): Avatar => ({
	file,
	bg: '#ffffff',
	iconColor: '#123456'
});

describe('renderAvatarSvg', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('loads and recolors valid SVG avatar markup', async () => {
		vi.stubGlobal(
			'fetch',
			vi
				.fn()
				.mockResolvedValue(
					new Response(
						'<svg xmlns="http://www.w3.org/2000/svg"><path fill="#000000" d="M0 0h1v1z"/></svg>',
						{ headers: { 'content-type': 'image/svg+xml' } }
					)
				)
		);

		const svg = await renderAvatarSvg(avatar('valid-test.svg'));

		expect(svg).toContain('#123456');
	});

	it('rejects failed SVG responses before caching', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(
				new Response('missing', {
					status: 404,
					headers: { 'content-type': 'image/svg+xml' }
				})
			)
		);

		await expect(
			renderAvatarSvg(avatar('missing-test.svg'))
		).rejects.toThrow('Failed to load avatar SVG');
	});

	it('rejects non-SVG responses before injecting markup', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(
				new Response('<html></html>', {
					headers: { 'content-type': 'text/html' }
				})
			)
		);

		await expect(renderAvatarSvg(avatar('html-test.svg'))).rejects.toThrow(
			'Failed to load avatar SVG'
		);
	});

	it('rejects invalid SVG bodies even with an SVG content type', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(
				new Response('<svg><path></svg>', {
					headers: { 'content-type': 'image/svg+xml' }
				})
			)
		);

		await expect(
			renderAvatarSvg(avatar('invalid-test.svg'))
		).rejects.toThrow('Invalid avatar SVG');
	});
});
