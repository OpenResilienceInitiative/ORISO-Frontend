// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MessageTimeline } from './MessageTimeline';

vi.mock('../message/MessageItemComponent', () => ({
	MessageItemComponent: ({
		askerMatrixUserId,
		message
	}: {
		askerMatrixUserId?: string;
		message?: string;
	}) => (
		<div data-testid="message" data-asker-id={askerMatrixUserId}>
			{message}
		</div>
	)
}));

vi.mock('../message/MessageSendFailed', () => ({
	MessageSendFailed: () => null
}));

afterEach(cleanup);

describe('MessageTimeline identity overrides', () => {
	it('places a consent continuation between older and newer chat messages', () => {
		const message = (id: string, time: string) => ({
			_id: id,
			message: id,
			messageDate: { str: '', date: null },
			messageTime: time,
			isNotRead: false,
			t: null,
			rid: '!main',
			displayName: 'Client',
			username: 'client',
			userId: '@client'
		});
		const { container } = render(
			<MessageTimeline
				messages={[
					message('Earlier message', '1000'),
					message('Later message', '3000')
				]}
				clientName="Client"
				isMyMessage={() => false}
				handleDecryptionErrors={vi.fn()}
				handleDecryptionSuccess={vi.fn()}
				e2eeParams={{} as never}
				supplement={<p>Consent request</p>}
				supplementTime={2000}
			/>
		);
		expect(container.textContent).toBe(
			'Earlier messageConsent requestLater message'
		);
	});

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
