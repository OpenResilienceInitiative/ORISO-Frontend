// @vitest-environment jsdom

import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AvatarPicker } from './AvatarPicker';

vi.mock('../../../utils/pseudonymGenerator', async (importOriginal) => ({
	...(await importOriginal<
		typeof import('../../../utils/pseudonymGenerator')
	>()),
	renderAvatarSvg: vi.fn(() => Promise.resolve('<svg></svg>'))
}));

const FILES = ['fox.svg', 'magpie.svg', 'owl.svg'];
const defaultTile = {
	avatar: { file: 'yak.svg', bg: '#fff', iconColor: '#000' },
	label: 'Standard'
};

const renderPicker = (value: string | null, onChange = vi.fn()) => {
	render(
		<AvatarPicker
			role="asker"
			layout="row"
			files={FILES}
			value={value}
			onChange={onChange}
			label="Ihr Bild"
			defaultTile={defaultTile}
		/>
	);
	return onChange;
};

const tabStops = () =>
	screen.getAllByRole('radio').filter((tile) => tile.tabIndex === 0);

afterEach(cleanup);

describe('AvatarPicker keyboard (#878 phase 4)', () => {
	it('is one tab stop: the picked tile, else the default tile', () => {
		renderPicker('magpie.svg');
		expect(
			tabStops().map((tile) => tile.getAttribute('aria-label'))
		).toEqual(['magpie']);
		cleanup();

		renderPicker(null);
		expect(
			tabStops().map((tile) => tile.getAttribute('aria-label'))
		).toEqual(['Standard']);
	});

	it('moves focus with the arrows without picking, and picks with Enter', () => {
		const onChange = renderPicker(null);
		const group = screen.getByRole('radiogroup', { name: 'Ihr Bild' });
		screen.getByRole('radio', { name: 'Standard' }).focus();

		fireEvent.keyDown(group, { key: 'ArrowRight' });
		expect(document.activeElement?.getAttribute('aria-label')).toBe('fox');
		fireEvent.keyDown(group, { key: 'End' });
		expect(document.activeElement?.getAttribute('aria-label')).toBe('owl');
		fireEvent.keyDown(group, { key: 'ArrowRight' });
		expect(document.activeElement?.getAttribute('aria-label')).toBe('owl');
		expect(onChange).not.toHaveBeenCalled();

		fireEvent.click(document.activeElement as HTMLElement);
		expect(onChange).toHaveBeenCalledWith('owl.svg');
	});

	it('keeps focus on a busy tile and ignores picks while saving', () => {
		const onChange = vi.fn();
		render(
			<AvatarPicker
				role="asker"
				files={FILES}
				value="fox.svg"
				onChange={onChange}
				label="Ihr Bild"
				disabled
			/>
		);
		const fox = screen.getByRole('radio', { name: 'fox' });
		fox.focus();
		fireEvent.click(screen.getByRole('radio', { name: 'owl' }));

		expect(document.activeElement).toBe(fox);
		expect(onChange).not.toHaveBeenCalled();
	});
});
