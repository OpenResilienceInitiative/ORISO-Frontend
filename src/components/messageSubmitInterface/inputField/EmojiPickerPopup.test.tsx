// @vitest-environment oriso-jsdom
import * as React from 'react';
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { EmojiPickerPopup } from './EmojiPickerPopup';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key
	})
}));

afterEach(() => cleanup());

vi.mock('emoji-picker-react', () => {
	const Theme = { LIGHT: 'light', DARK: 'dark', AUTO: 'auto' };
	const MockPicker = () => <input aria-label="Emoji search" />;
	return { __esModule: true, default: MockPicker, Theme };
});

describe('EmojiPickerPopup (#835)', () => {
	it('portals the picker to document.body so session overflow cannot clip it', async () => {
		const anchor = document.createElement('button');
		anchor.setAttribute('data-emoji-picker-toggle', '');
		document.body.appendChild(anchor);

		const clippingHost = document.createElement('div');
		clippingHost.style.overflow = 'hidden';
		document.body.appendChild(clippingHost);

		render(
			<EmojiPickerPopup
				direction="up"
				anchorEl={anchor}
				onPick={() => undefined}
				onClose={() => undefined}
			/>,
			{ container: clippingHost }
		);

		const popup = await waitFor(() =>
			screen.getByTestId('emoji-picker-popup')
		);

		expect(popup.parentElement).toBe(document.body);
		expect(clippingHost.contains(popup)).toBe(false);
		expect(popup.className).toContain('emojiPickerPopup--portalled');

		anchor.remove();
		clippingHost.remove();
	});
	it('restores keyboard focus to the launcher when the picker closes', async () => {
		const onClose = vi.fn();
		const { getByRole } = render(
			<button type="button">More reactions</button>
		);
		const launcher = getByRole('button', { name: 'More reactions' });
		render(
			<EmojiPickerPopup
				direction="down"
				anchorEl={document.body}
				returnFocusEl={launcher}
				onPick={() => undefined}
				onClose={onClose}
			/>
		);
		const input = await screen.findByRole('textbox', {
			name: 'Emoji search'
		});
		input.focus();
		fireEvent.keyDown(input, { key: 'Escape' });
		expect(onClose).toHaveBeenCalledOnce();
		expect(document.activeElement).toBe(launcher);
	});
});
