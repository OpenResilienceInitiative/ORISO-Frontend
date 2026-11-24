// @vitest-environment oriso-jsdom
import * as React from 'react';
import { describe, expect, it } from 'vite-plus/test';
import { render } from '@testing-library/react';
import { StackCountIcon } from './StackCountIcon';

const nextOf = (next: number) =>
	render(<StackCountIcon next={next} />)
		.container.querySelector('[data-cy="selection-reply-stack-count"]')
		?.getAttribute('data-next');

describe('StackCountIcon', () => {
	it('shows the number the next stacked answer gets', () => {
		expect(nextOf(1)).toBe('1');
		expect(nextOf(4)).toBe('4');
		expect(nextOf(9)).toBe('9');
	});

	it('shows 9+ from the tenth answer on and 1 for nonsense input', () => {
		expect(nextOf(10)).toBe('9+');
		expect(nextOf(42)).toBe('9+');
		expect(nextOf(0)).toBe('1');
	});
});
