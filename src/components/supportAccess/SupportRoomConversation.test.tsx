// @vitest-environment jsdom

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MatrixClientContext } from '../../globalState/context/MatrixClientContext';
import { SupportRoomConversation } from './SupportRoomConversation';

const messageEvent = (body: string, sender: string) => ({
	getContent: () => ({ body, msgtype: 'm.text' }),
	getId: () => `$${body}`,
	getSender: () => sender,
	getType: () => 'm.room.message'
});

describe('SupportRoomConversation', () => {
	it('renders encrypted-room messages and sends new messages through Matrix', async () => {
		const sendMessage = vi.fn().mockResolvedValue(undefined);
		const events = [messageEvent('Existing message', '@consultant:matrix')];
		const room = {
			getLiveTimeline: () => ({ getEvents: () => events })
		};
		const client = {
			getRoom: vi.fn().mockReturnValue(room),
			getUserId: () => '@support:matrix',
			joinRoom: vi.fn(),
			on: vi.fn(),
			off: vi.fn()
		};
		const matrixClientService = {
			getClient: () => client,
			onClientChange: vi.fn().mockImplementation((listener) => {
				listener(client);
				return () => undefined;
			}),
			sendMessage
		} as any;

		render(
			<MatrixClientContext.Provider
				value={{
					matrixClientService,
					setMatrixClientService: vi.fn()
				}}
			>
				<SupportRoomConversation roomId="!support:matrix" />
			</MatrixClientContext.Provider>
		);

		expect(await screen.findByText('Existing message')).toBeTruthy();

		const input = screen.getByRole('textbox');
		fireEvent.change(input, { target: { value: 'New message' } });
		fireEvent.click(screen.getByRole('button'));

		await waitFor(() =>
			expect(sendMessage).toHaveBeenCalledWith(
				'!support:matrix',
				'New message'
			)
		);
	});
});
