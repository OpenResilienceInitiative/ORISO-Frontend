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

	it('can delegate sending to a parent form submit handler', () => {
		const handleSubmit = vi.fn((event: React.FormEvent) => {
			event.preventDefault();
		});
		const handleSendButton = vi.fn();

		render(
			<form onSubmit={handleSubmit}>
				<SendMessageButton
					type="submit"
					handleSendButton={handleSendButton}
				/>
			</form>
		);

		const button = screen.getByRole('button', {
			name: 'enquiry.write.input.button.title'
		});
		expect(button.getAttribute('type')).toBe('submit');

		fireEvent.click(button);

		expect(handleSubmit).toHaveBeenCalledTimes(1);
		expect(handleSendButton).not.toHaveBeenCalled();
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
