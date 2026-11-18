// @vitest-environment oriso-jsdom
import * as React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { OrisoTextarea } from './OrisoTextarea';

describe('OrisoTextarea', () => {
	afterEach(() => {
		cleanup();
		vi.restoreAllMocks();
	});

	it('keeps a fixed box when rows is given, without the default minRows', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		render(<OrisoTextarea label="Note" rows={3} />);
		expect(screen.getByRole('textbox').getAttribute('rows')).toBe('3');
		// MUI warns when minRows and rows are combined (the box would grow).
		expect(
			warn.mock.calls.some(([message]) =>
				String(message).includes('minRows')
			)
		).toBe(false);
	});
});
