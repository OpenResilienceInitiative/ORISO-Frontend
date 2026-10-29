// @vitest-environment oriso-jsdom
import * as React from 'react';
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { DirectLink } from './directLink';
import { DirectLinkShareDialog } from './DirectLinkShareDialog';
import { MyDirectLinks } from './MyDirectLinks';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));
vi.mock('qrcode', () => ({
	default: { toDataURL: vi.fn(() => Promise.resolve('data:image/png,')) }
}));

const link: DirectLink = {
	id: '1',
	name: 'Sucht',
	topic: 'Sucht',
	medium: 'CHAT',
	temporary: false,
	active: true,
	url: 'https://example.test/l/1'
} as DirectLink;

afterEach(() => {
	cleanup();
	vi.useRealTimers();
});

describe('copy feedback', () => {
	it('says so when the list cannot copy, and shows no check', async () => {
		render(
			<MyDirectLinks
				links={[link]}
				onToggle={vi.fn()}
				onShowQr={vi.fn()}
				onCopy={() => Promise.reject(new Error('denied'))}
			/>
		);
		await act(async () => {
			fireEvent.click(
				screen.getByRole('button', { name: 'directLink.copy' })
			);
		});
		expect(screen.getByRole('alert').textContent).toBe(
			'groupChat.shareDialog.copyFailed'
		);
	});

	it('takes the check off a copied tile after a moment', async () => {
		vi.useFakeTimers();
		const { container } = render(
			<MyDirectLinks
				links={[link]}
				onToggle={vi.fn()}
				onShowQr={vi.fn()}
				onCopy={() => Promise.resolve()}
			/>
		);
		await act(async () => {
			fireEvent.click(
				screen.getByRole('button', { name: 'directLink.copy' })
			);
		});
		expect(
			container.querySelector('[data-testid="CheckOutlinedIcon"]')
		).not.toBeNull();
		await act(async () => {
			await vi.advanceTimersByTimeAsync(3000);
		});
		expect(
			container.querySelector('[data-testid="CheckOutlinedIcon"]')
		).toBeNull();
	});

	it('says so when the share dialog cannot copy', async () => {
		render(
			<DirectLinkShareDialog
				open
				link={link}
				onClose={vi.fn()}
				onCopy={() => Promise.reject(new Error('denied'))}
			/>
		);
		await act(async () => {
			fireEvent.click(
				screen.getByRole('button', { name: /directLink.copy/ })
			);
		});
		expect(screen.getByRole('alert').textContent).toBe(
			'groupChat.shareDialog.copyFailed'
		);
		expect(screen.queryByText('directLink.share.copied')).toBeNull();
	});
});
