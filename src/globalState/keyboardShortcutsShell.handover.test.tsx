// @vitest-environment oriso-jsdom
import * as React from 'react';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';
import { useKeyboardShortcuts } from '../features/keyboard-shortcuts';
import { getPlatform } from '../features/keyboard-shortcuts/utils/platform';
import {
	beginLoginHandover,
	endLoginHandover,
	resetLoginHandoverForTests
} from '../components/app/loginHandover';
import { KeyboardShortcutsRoot } from './state';

/*
 * #2272 review: the handover screen covers the login page, but the global
 * shortcut listener sits on window, so the command palette (a native modal
 * that escapes `inert`) could still open and navigate away mid sign-in.
 */

vi.mock('../features/keyboard-shortcuts/components/ShortcutHelpDialog', () => ({
	ShortcutHelpDialog: () => null
}));
vi.mock(
	'../features/keyboard-shortcuts/components/CommandPaletteDialog',
	() => ({ CommandPaletteDialog: () => null })
);

const PaletteProbe = () => {
	const { isPaletteOpen } = useKeyboardShortcuts();
	return <span data-cy="palette">{isPaletteOpen ? 'open' : 'closed'}</span>;
};

const pressPalette = () => {
	const mac = getPlatform() === 'mac';
	fireEvent.keyDown(window, {
		key: 'k',
		code: 'KeyK',
		metaKey: mac,
		ctrlKey: !mac
	});
};

describe('global shortcuts during a login handover', () => {
	beforeEach(() => resetLoginHandoverForTests(false));
	afterEach(() => {
		cleanup();
		endLoginHandover();
	});

	it('cannot open the command palette while the handover covers the page', () => {
		const view = render(
			<KeyboardShortcutsRoot>
				<PaletteProbe />
			</KeyboardShortcutsRoot>
		);
		const state = () =>
			view.container.querySelector('[data-cy="palette"]')?.textContent;

		act(() => beginLoginHandover());
		pressPalette();
		expect(state()).toBe('closed');

		act(() => endLoginHandover());
		pressPalette();
		expect(state()).toBe('open');
	});
});
