// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MessageTimeline } from './MessageTimeline';

vi.mock('../message/MessageItemComponent', () => ({
	MessageItemComponent: ({ askerMatrixUserId }: { askerMatrixUserId?: string }) => (
		<div data-testid="message" data-asker-id={askerMatrixUserId} />
	)
}));

vi.mock('../message/MessageSendFailed', () => ({
	MessageSendFailed: () => null
}));

afterEach(cleanup);

describe('MessageTimeline identity overrides', () => {
	it('uses the room-specific asker identity instead of the message fallback', () => {
		render(
			<MessageTimeline
				messages={[
					{
						_id: '$message',
						message: 'hello',
						messageDate: { str: '', date: null },
						messageTime: '1',
						askerMatrixUserId: '@client-room:oriso.invalid',
						isNotRead: false,
						t: null,
						rid: '!side-room:oriso.invalid',
						displayName: 'Client',
						username: 'client',
						userId: '@client:oriso.invalid'
					}
				]}
				clientName="Client"
				askerMatrixUserIdFor={() => '@side-room-client:oriso.invalid'}
				isMyMessage={() => false}
				handleDecryptionErrors={vi.fn()}
				handleDecryptionSuccess={vi.fn()}
				e2eeParams={{} as never}
			/>
		);

		expect(
			screen.getByTestId('message').getAttribute('data-asker-id')
		).toBe('@side-room-client:oriso.invalid');
	});
});
