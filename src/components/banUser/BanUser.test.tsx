// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react';
import { BanUser } from './BanUser';
import { apiPostBanUser } from '../../api/apiPostBanUser';
vi.mock('../../api/apiPostBanUser', () => ({ apiPostBanUser: vi.fn() }));
vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));
vi.mock('../overlay/Overlay', () => ({ Overlay: () => null }));
vi.mock('../headline/Headline', () => ({ Headline: () => null }));
afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});
describe('BanUser', () => {
	it('reports a failed request without reporting a successful ban', async () => {
		vi.mocked(apiPostBanUser).mockRejectedValueOnce(
			new Error('unavailable')
		);
		const failed = vi.fn(),
			success = vi.fn(),
			close = vi.fn();
		render(
			<BanUser
				matrixUserId="@participant:test"
				chatId={15}
				userName="participant"
				onSelect={close}
				onBanFailed={failed}
				handleUserBan={success}
			/>
		);
		fireEvent.click(screen.getByRole('button'));
		await waitFor(() => expect(failed).toHaveBeenCalledWith('participant'));
		expect(apiPostBanUser).toHaveBeenCalledWith({
			matrixUserId: '@participant:test',
			chatId: 15
		});
		expect(close).toHaveBeenCalledOnce();
		expect(success).not.toHaveBeenCalled();
	});
});
