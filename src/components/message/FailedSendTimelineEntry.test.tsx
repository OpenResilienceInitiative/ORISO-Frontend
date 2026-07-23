// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FailedSendTimelineEntry } from './FailedSendTimelineEntry';

vi.mock('./MessageItemComponent', () => ({
	MessageItemComponent: ({
		message,
		sendFailed,
		messageTime
	}: {
		message: string;
		sendFailed?: boolean;
		messageTime: string;
	}) => (
		<div
			data-testid="failed-original-message"
			data-send-failed={String(sendFailed)}
			data-message-time={messageTime}
		>
			{message}
		</div>
	)
}));

vi.mock('./MessageSendFailed', () => ({
	MessageSendFailed: ({
		messageTime,
		onRetry,
		retryPending,
		retryDisabled
	}: {
		messageTime?: string;
		onRetry?: () => void;
		retryPending?: boolean;
		retryDisabled?: boolean;
	}) => (
		<div
			data-testid="failed-send-system-card"
			data-message-time={messageTime}
		>
			Sending message failed
			{onRetry && (
				<button
					onClick={onRetry}
					disabled={retryPending || retryDisabled}
				>
					Try again
				</button>
			)}
		</div>
	)
}));

afterEach(cleanup);

describe('FailedSendTimelineEntry', () => {
	it('keeps the original failed message before the explanatory system card', () => {
		const onRetry = vi.fn();
		const { container } = render(
			<FailedSendTimelineEntry
				failed={{
					id: 'send-failed-123',
					message: 'lala lala — I have a problem',
					ts: 123,
					transportMessage: 'lala lala — I have a problem',
					isAside: false,
					mentionedUserIds: []
				}}
				messageProps={{} as never}
				onRetry={onRetry}
				retryPending={false}
			/>
		);

		const original = screen.getByTestId('failed-original-message');
		const systemCard = screen.getByTestId('failed-send-system-card');

		expect(original.textContent).toBe('lala lala — I have a problem');
		expect(original.getAttribute('data-send-failed')).toBe('true');
		expect(original.getAttribute('data-message-time')).toBe('123');
		expect(systemCard.getAttribute('data-message-time')).toBe('123');
		expect(Array.from(container.children)).toEqual([original, systemCard]);
		fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
		expect(onRetry).toHaveBeenCalledWith('send-failed-123');
	});

	it('forwards the pending state to disable retry', () => {
		render(
			<FailedSendTimelineEntry
				failed={{
					id: 'send-failed-456',
					message: 'Still not delivered',
					ts: 456,
					transportMessage: 'Still not delivered',
					isAside: false,
					mentionedUserIds: []
				}}
				messageProps={{} as never}
				onRetry={vi.fn()}
				retryPending
			/>
		);

		expect(
			screen
				.getByRole('button', { name: 'Try again' })
				.hasAttribute('disabled')
		).toBe(true);
	});

	it('does not render retry without a retry handler', () => {
		render(
			<FailedSendTimelineEntry
				failed={{
					id: 'send-failed-789',
					message: 'No retry callback',
					ts: 789,
					transportMessage: 'No retry callback',
					isAside: false,
					mentionedUserIds: []
				}}
				messageProps={{} as never}
			/>
		);

		expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
	});
});
