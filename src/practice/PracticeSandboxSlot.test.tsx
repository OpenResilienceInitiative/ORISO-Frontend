// @vitest-environment jsdom
import React from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PracticeSandboxSlot } from './PracticeSandboxSlot';

describe('PracticeSandboxSlot', () => {
	it('is an empty placeholder until the sandbox replaces it', () => {
		const { container } = render(<PracticeSandboxSlot />);

		expect(container.innerHTML).toBe('');
	});
});
