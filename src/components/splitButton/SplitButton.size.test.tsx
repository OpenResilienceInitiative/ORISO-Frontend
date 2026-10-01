// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { SplitButton } from './SplitButton';

describe('SplitButton size (#1377 sound picker)', () => {
	afterEach(cleanup);

	it('renders the small (32px) variant with its class', () => {
		render(
			<SplitButton
				label="Ton 3"
				size="small"
				onToggleMenu={() => undefined}
				mainOpensMenu={false}
				menuLabel="Ton wählen"
			/>
		);
		const root = screen.getByRole('button', {
			name: 'Ton 3'
		}).parentElement!;
		expect(root.className).toContain('splitButton--small');
		expect(screen.getByRole('button', { name: 'Ton wählen' })).toBeTruthy();
	});
});
