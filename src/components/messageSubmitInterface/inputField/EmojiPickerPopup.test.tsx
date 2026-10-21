// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EmojiPickerPopup } from './EmojiPickerPopup';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key
	})
}));

afterEach(() => cleanup());

vi.mock('emoji-picker-react', () => {
	const Theme = { LIGHT: 'light', DARK: 'dark', AUTO: 'auto' };
	const MockPicker = () => <div data-testid="mock-emoji-picker">picker</div>;
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
});
