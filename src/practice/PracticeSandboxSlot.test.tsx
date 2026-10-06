// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PracticeSandboxSlot } from './PracticeSandboxSlot';

describe('PracticeSandboxSlot', () => {
	it('passes its children through until the sandbox replaces it', () => {
		const { container } = render(
			<PracticeSandboxSlot>
				<p>real app</p>
			</PracticeSandboxSlot>
		);

		expect(screen.getByText('real app')).toBeTruthy();
		expect(container.innerHTML).toBe('<p>real app</p>');
	});
});
