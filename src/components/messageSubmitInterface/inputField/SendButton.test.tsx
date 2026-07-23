// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SendButton } from './SendButton';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key
	})
}));

vi.mock('../../../resources/img/icons/paper-plane.svg', () => ({
	ReactComponent: 'svg'
}));

afterEach(() => {
	cleanup();
});

const getButton = () =>
	screen.getByRole('button', {
		name: 'enquiry.write.input.button.title'
	}) as HTMLButtonElement;

describe('SendButton', () => {
	it('sends via click in button mode when ready', () => {
		const onSend = vi.fn();

		render(<SendButton state="ready" type="button" onSend={onSend} />);

		const button = getButton();
		expect(button.disabled).toBe(false);
		expect(button.className).toContain('sendButton--ready');

		fireEvent.click(button);
		expect(onSend).toHaveBeenCalledTimes(1);
	});

	it('delegates to the parent form in submit mode', () => {
		const handleSubmit = vi.fn((event: React.FormEvent) =>
			event.preventDefault()
		);
		const onSend = vi.fn();

		render(
			<form onSubmit={handleSubmit}>
				<SendButton state="ready" onSend={onSend} />
			</form>
		);

		const button = getButton();
		expect(button.getAttribute('type')).toBe('submit');

		fireEvent.click(button);
		expect(handleSubmit).toHaveBeenCalledTimes(1);
		expect(onSend).not.toHaveBeenCalled();
	});

	it('is not clickable while empty, disabled or sending', () => {
		const onSend = vi.fn();

		for (const state of ['empty', 'disabled', 'sending'] as const) {
			const { unmount } = render(
				<SendButton state={state} type="button" onSend={onSend} />
			);
			const button = getButton();
			expect(button.disabled).toBe(true);
			fireEvent.click(button);
			unmount();
		}

		expect(onSend).not.toHaveBeenCalled();
	});

	it('launches the fly-out animation on ready -> sending', () => {
		const { rerender } = render(<SendButton state="ready" />);
		expect(getButton().className).not.toContain('sendButton--flyout');

		rerender(<SendButton state="sending" />);
		expect(getButton().className).toContain('sendButton--flyout');
	});

	it('clears the fly-out class after the animation finishes', () => {
		const { rerender, container } = render(<SendButton state="ready" />);
		rerender(<SendButton state="sending" />);

		const plane = container.querySelector('.sendButton__plane') as Element;
		fireEvent.animationEnd(plane);

		expect(getButton().className).not.toContain('sendButton--flyout');
	});

	it('does not fly out when arming from empty', () => {
		const { rerender } = render(<SendButton state="empty" />);
		rerender(<SendButton state="ready" />);
		expect(getButton().className).not.toContain('sendButton--flyout');
	});
});
