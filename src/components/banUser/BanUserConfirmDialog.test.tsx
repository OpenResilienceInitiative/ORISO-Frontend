// @vitest-environment oriso-jsdom
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { BanUserConfirmDialog } from './BanUserConfirmDialog';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, options?: { name?: string }) =>
			options?.name ? `${key}:${options.name}` : key
	})
}));

const renderDialog = (name: string | null = 'ruhiges Yak Kim') => {
	const onCancel = vi.fn();
	const onConfirm = vi.fn();
	render(
		<BanUserConfirmDialog
			name={name}
			onCancel={onCancel}
			onConfirm={onConfirm}
		/>
	);
	return { onCancel, onConfirm };
};

describe('BanUserConfirmDialog', () => {
	afterEach(cleanup);

	it('names the member as the counsellor sees them and explains the effect', () => {
		renderDialog();

		const dialog = screen.getByRole('dialog');
		expect(
			screen.getByRole('heading', {
				name: 'banUser.confirm.title:ruhiges Yak Kim'
			})
		).toBeTruthy();
		expect(dialog.textContent).toContain('banUser.confirm.description');
		expect(screen.getByRole('button', { name: 'app.close' })).toBeTruthy();
	});

	it('renders nothing while no member is selected', () => {
		renderDialog(null);
		expect(screen.queryByRole('dialog')).toBeNull();
	});

	it('cancels without removing on Cancel, on the close button and on Escape', () => {
		const { onCancel, onConfirm } = renderDialog();

		fireEvent.click(screen.getByRole('button', { name: 'app.cancel' }));
		fireEvent.click(screen.getByRole('button', { name: 'app.close' }));
		fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

		expect(onCancel).toHaveBeenCalledTimes(3);
		expect(onConfirm).not.toHaveBeenCalled();
	});

	it('removes once on the destructive confirm button', () => {
		const { onCancel, onConfirm } = renderDialog();

		const confirm = screen.getByRole('button', {
			name: 'banUser.confirm.submit'
		});
		expect(confirm.className).toContain('m3Dialog__action--primary');
		expect(document.querySelector('.m3Dialog--error')).toBeTruthy();
		fireEvent.click(confirm);

		expect(onConfirm).toHaveBeenCalledTimes(1);
		expect(onCancel).not.toHaveBeenCalled();
	});
});
