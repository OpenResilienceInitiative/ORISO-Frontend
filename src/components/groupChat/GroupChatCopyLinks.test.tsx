// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import QRCode from 'qrcode';
import userEvent from '@testing-library/user-event';
import { GroupChatCopyLinks } from './GroupChatCopyLinks';
import { copyTextToClipboard } from '../../utils/clipboardHelpers';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));
vi.mock('../../hooks/useAppConfig', () => ({
	useAppConfig: () => ({ urls: { toLogin: 'https://example.org/login' } })
}));
vi.mock('../../utils/clipboardHelpers', () => ({
	copyTextToClipboard: vi.fn(() => Promise.resolve())
}));
vi.mock('qrcode', () => ({
	default: {
		toDataURL: vi.fn(() => Promise.resolve('data:image/png;base64,qr'))
	}
}));
vi.mock('../../globalState', async () => {
	const React = await import('react');
	return {
		NotificationsContext: React.createContext({ addNotification: vi.fn() }),
		NOTIFICATION_TYPE_SUCCESS: 'success'
	};
});
afterEach(cleanup);

it('offers the invitation as a read-only field and a native copy button', async () => {
	render(<GroupChatCopyLinks seriesId={42} />);
	const field = screen.getByRole('textbox') as HTMLInputElement;
	expect(field.readOnly).toBe(true);
	const button = screen.getByRole('button', {
		name: 'groupChat.copy.link.text'
	});
	expect(button.tagName).toBe('BUTTON');
	button.focus();
	await userEvent.keyboard('{Enter}');
	expect(copyTextToClipboard).toHaveBeenCalledWith(
		field.value,
		expect.any(Function)
	);
});

it('renders a downloadable QR inline without opening a second dialog', async () => {
	render(<GroupChatCopyLinks seriesId={42} />);
	await waitFor(() =>
		expect(screen.getByRole('img').getAttribute('src')).toBe(
			'data:image/png;base64,qr'
		)
	);
	expect(QRCode.toDataURL).toHaveBeenCalled();
	expect(
		screen
			.getByRole('link', { name: 'qrCode.overlay.download' })
			.getAttribute('href')
	).toBe('data:image/png;base64,qr');
	expect(screen.queryByRole('dialog')).toBeNull();
});
