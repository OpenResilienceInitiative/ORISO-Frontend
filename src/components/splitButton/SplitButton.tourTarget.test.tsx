// @vitest-environment oriso-jsdom
import * as React from 'react';
import { afterEach, describe, expect, it } from 'vite-plus/test';
import { cleanup, render, screen } from '@testing-library/react';
import { SplitButton } from './SplitButton';

afterEach(cleanup);

describe('SplitButton — product-tour anchor', () => {
	it('puts data-tour-target on the root, around both segments', () => {
		render(
			<SplitButton
				label="Zugriff anfragen"
				onToggleMenu={() => undefined}
				mainOpensMenu={false}
				menuLabel="Weitere Aktionen"
				tourTarget="case-handover-request-access"
			/>
		);

		const root = screen.getByRole('button', {
			name: 'Zugriff anfragen'
		}).parentElement!;
		expect(root.getAttribute('data-tour-target')).toBe(
			'case-handover-request-access'
		);
		expect(root.contains(screen.getByLabelText('Weitere Aktionen'))).toBe(
			true
		);
	});

	it('renders no anchor attribute without the prop', () => {
		const { container } = render(<SplitButton label="Ton 3" />);

		expect(container.querySelector('[data-tour-target]')).toBeNull();
	});
});
