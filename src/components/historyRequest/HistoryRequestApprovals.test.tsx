// @vitest-environment jsdom
import * as React from 'react';
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { service, pending } = vi.hoisted(() => {
	const pending = { list: [] as any[] };
	return {
		pending,
		service: {
			getPendingApprovals: vi.fn((roomId?: string) =>
				pending.list.filter((item) => !roomId || item.roomId === roomId)
			),
			approveRequest: vi.fn(),
			declineRequest: vi.fn()
		}
	};
});

vi.mock('../../services/matrixRoomHistoryKeyTransfer', () => ({
	MATRIX_HISTORY_REQUEST_PENDING_EVENT: 'pending',
	MATRIX_HISTORY_REQUEST_RESOLVED_EVENT: 'resolved',
	matrixRoomHistoryKeyTransfer: service
}));
vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));

/* eslint-disable-next-line import/first -- must follow the vi.mock calls above. */
import { HistoryRequestApprovals } from './HistoryRequestApprovals';

const request = (
	requestId: string,
	roomId = '!a:m',
	reason = 'about school'
) => ({
	requestId,
	roomId,
	requesterUserId: '@asker:m',
	requesterDeviceId: 'DEV',
	reason,
	receivedAt: 1
});

beforeEach(() => {
	pending.list = [];
	service.approveRequest.mockReset();
	service.declineRequest.mockReset();
});
afterEach(cleanup);

describe('HistoryRequestApprovals', () => {
	it('renders nothing when no request waits', () => {
		const { container } = render(<HistoryRequestApprovals roomId="!a:m" />);

		expect(container.textContent).toBe('');
	});

	it('shows only requests of the open conversation', () => {
		pending.list = [
			request('one'),
			request('two', '!other:m', 'elsewhere')
		];
		render(<HistoryRequestApprovals roomId="!a:m" />);

		expect(screen.getByText('about school')).toBeTruthy();
		expect(screen.queryByText('elsewhere')).toBeNull();
	});

	it('picks up a request that arrives after the first render', async () => {
		render(<HistoryRequestApprovals roomId="!a:m" />);
		expect(screen.queryByText('about school')).toBeNull();

		pending.list = [request('late')];
		act(() => {
			window.dispatchEvent(new CustomEvent('pending'));
		});

		await screen.findByText('about school');
	});

	it('approves through the service and drops the card once it is resolved', async () => {
		pending.list = [request('one')];
		service.approveRequest.mockImplementation(async () => {
			pending.list = [];
			window.dispatchEvent(new CustomEvent('resolved'));
			return true;
		});
		render(<HistoryRequestApprovals roomId="!a:m" />);

		fireEvent.click(
			screen.getByRole('button', { name: 'historyRequest.card.approve' })
		);

		await waitFor(() =>
			expect(screen.queryByText('about school')).toBeNull()
		);
		expect(service.approveRequest).toHaveBeenCalledWith('one');
	});

	it('keeps the card and says so when the keys could not be sent', async () => {
		pending.list = [request('one')];
		service.approveRequest.mockResolvedValue(false);
		render(<HistoryRequestApprovals roomId="!a:m" />);

		fireEvent.click(
			screen.getByRole('button', { name: 'historyRequest.card.approve' })
		);

		await screen.findByRole('alert');
		expect(screen.getByText('about school')).toBeTruthy();
	});

	it('keeps the failure of one card when another is released', async () => {
		pending.list = [request('one'), request('two', '!a:m', 'second text')];
		service.approveRequest.mockResolvedValue(false);
		render(<HistoryRequestApprovals roomId="!a:m" />);
		const approve = () =>
			screen.getAllByRole('button', {
				name: 'historyRequest.card.approve'
			});

		fireEvent.click(approve()[0]);
		await waitFor(() =>
			expect(screen.getAllByRole('alert')).toHaveLength(1)
		);
		fireEvent.click(approve()[1]);

		await waitFor(() =>
			expect(screen.getAllByRole('alert')).toHaveLength(2)
		);
	});

	it('declines through the service without sending anything', () => {
		pending.list = [request('one')];
		render(<HistoryRequestApprovals roomId="!a:m" />);

		fireEvent.click(
			screen.getByRole('button', { name: 'historyRequest.card.decline' })
		);

		expect(service.declineRequest).toHaveBeenCalledWith('one');
		expect(service.approveRequest).not.toHaveBeenCalled();
	});
});
