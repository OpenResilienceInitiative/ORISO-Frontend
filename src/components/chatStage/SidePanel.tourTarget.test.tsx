// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SidePanel } from './SidePanel';

afterEach(cleanup);

describe('SidePanel — product-tour anchor', () => {
	it('forwards data-tour-target to the panel region', () => {
		render(
			<SidePanel
				label="Team-Besprechung"
				header={<h2>Team</h2>}
				data-tour-target="team-discussion-panel"
			/>
		);

		expect(
			screen
				.getByRole('complementary', { name: 'Team-Besprechung' })
				.getAttribute('data-tour-target')
		).toBe('team-discussion-panel');
	});

	it('renders no anchor attribute when none is given', () => {
		render(<SidePanel label="Supervision" header={<h2>Sup</h2>} />);

		expect(
			screen
				.getByRole('complementary', { name: 'Supervision' })
				.hasAttribute('data-tour-target')
		).toBe(false);
	});
});
