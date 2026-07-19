// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
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
		render(<MessageSendFailed isDecryptionFailure />);

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
	});
});
