// @vitest-environment jsdom
import * as React from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// The media origin the parser resolves against (mirror the split-host prod case).
vi.mock('../endpoints', () => ({
	tenantServiceOrigin: 'https://api.oriso-dev.site'
}));

import htmlParser from './htmlParser';

describe('htmlParser media rewrite', () => {
	it('rewrites a root-relative /media img src to the tenant origin', () => {
		const { container } = render(
			<div>{htmlParser('<p>Impressum</p><img src="/media/abc-1">')}</div>
		);
		const img = container.querySelector('img');
		expect(img?.getAttribute('src')).toBe(
			'https://api.oriso-dev.site/media/abc-1'
		);
	});

	it('leaves absolute and non-media srcs untouched, still strips class="remove"', () => {
		const { container } = render(
			<div>
				{htmlParser(
					'<img src="https://cdn/x.png"><span class="remove">x</span><b>keep</b>'
				)}
			</div>
		);
		expect(container.querySelector('img')?.getAttribute('src')).toBe(
			'https://cdn/x.png'
		);
		expect(container.querySelector('span.remove')).toBeNull();
		expect(container.querySelector('b')?.textContent).toBe('keep');
	});
});
