// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SendMessageButton } from './SendMessageButton';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key
	})
}));

vi.mock('../../resources/img/icons/paper-plane.svg', () => ({
	ReactComponent: 'svg'
}));

afterEach(() => {
	cleanup();
});

describe('SendMessageButton', () => {
	it('uses a native enabled button for sending messages', () => {
		const handleSendButton = vi.fn();

		render(<SendMessageButton handleSendButton={handleSendButton} />);

		const button = screen.getByRole('button', {
			name: 'enquiry.write.input.button.title'
		});
		expect(button.tagName).toBe('BUTTON');
		expect(button.getAttribute('type')).toBe('button');
		expect((button as HTMLButtonElement).disabled).toBe(false);

		fireEvent.click(button);

		expect(handleSendButton).toHaveBeenCalledTimes(1);
	});

	it('does not send while disabled', () => {
		const handleSendButton = vi.fn();

		render(
			<SendMessageButton
				deactivated={true}
				handleSendButton={handleSendButton}
			/>
		);

		const button = screen.getByRole('button', {
			name: 'enquiry.write.input.button.title'
		});
		expect((button as HTMLButtonElement).disabled).toBe(true);

		fireEvent.click(button);

		expect(handleSendButton).not.toHaveBeenCalled();
	});
});
