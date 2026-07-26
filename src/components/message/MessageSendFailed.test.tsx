// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MessageSendFailed } from './MessageSendFailed';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (_key: string, fallback: string) => fallback
	})
}));

vi.mock('../../resources/img/icons/delivery-failed.svg', () => ({
	ReactComponent: (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />
}));

afterEach(cleanup);

describe('MessageSendFailed', () => {
	it('keeps the outgoing-send instructions for failed sends', () => {
		render(<MessageSendFailed />);

		expect(screen.getByText('Sending message failed')).toBeTruthy();
		expect(screen.getByText('Resend your message again')).toBeTruthy();
		expect(screen.getByRole('img').getAttribute('aria-label')).toBe(
			'not delivered'
		);
	});

	it('uses actionable incoming-message copy for decryption failures', () => {
		render(<MessageSendFailed isDecryptionFailure onRetry={vi.fn()} />);

		expect(screen.getByText('Message decryption failed')).toBeTruthy();
		expect(screen.getByText('Incoming message unavailable')).toBeTruthy();
		expect(
			screen.getByText(
				'This incoming message could not be decrypted. Ask the sender to send it again, or try reloading the conversation.'
			)
		).toBeTruthy();
		expect(screen.getByRole('img').getAttribute('aria-label')).toBe(
			'could not be decrypted'
		);
		expect(screen.queryByText('Resend your message again')).toBeNull();
		expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
	});

	it('offers one explicit retry action for an outgoing failed send', () => {
		const onRetry = vi.fn();
		const { rerender } = render(
			<MessageSendFailed onRetry={onRetry} retryPending={false} />
		);

		const retryButton = screen.getByRole('button', { name: 'Try again' });
		const statusRail = retryButton.closest('.messageItem__timeRail');
		expect(statusRail).toBeTruthy();
		expect(
			statusRail?.querySelector('.messageItem__messageTime')
		).toBeTruthy();
		fireEvent.click(retryButton);
		expect(onRetry).toHaveBeenCalledTimes(1);

		rerender(<MessageSendFailed onRetry={onRetry} retryPending />);
		expect(
			screen
				.getByRole('button', { name: 'Try again' })
				.hasAttribute('disabled')
		).toBe(true);
		fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
		expect(onRetry).toHaveBeenCalledTimes(1);
	});
});
