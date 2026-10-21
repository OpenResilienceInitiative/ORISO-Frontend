// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NotificationsContext } from '../../globalState/provider/NotificationsProvider';
import { Notification } from './Notification';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));
// Pulled in through the globalState barrel; needs a canvas jsdom lacks.
vi.mock('lottie-react', () => ({ default: () => null }));
// The call notification pulls in the video stack, which needs a canvas.
vi.mock('../incomingVideoCall/IncomingVideoCall', () => ({
	NOTIFICATION_TYPE_CALL: 'call',
	IncomingVideoCall: () => null
}));
vi.mock('../../resources/img/icons/x.svg', () => ({
	ReactComponent: () => <svg />
}));
vi.mock('../../resources/img/icons/i.svg', () => ({
	ReactComponent: () => <svg />
}));
vi.mock('../../resources/img/icons/exclamation-mark.svg', () => ({
	ReactComponent: () => <svg />
}));
vi.mock('../../resources/img/icons/checkmark-white.svg', () => ({
	ReactComponent: () => <svg />
}));

const renderNotice = (closeable: boolean) => {
	const removeNotification = vi.fn();
	const onClose = vi.fn();
	render(
		<NotificationsContext.Provider value={{ removeNotification } as any}>
			<Notification
				notification={
					{
						id: 'liveChatAvailabilityLost',
						notificationType: 'warning',
						closeable,
						title: 'Live chat is off',
						text: 'Switch it on again.',
						onClose
					} as any
				}
			/>
		</NotificationsContext.Provider>
	);
	return { removeNotification, onClose };
};

// #1485 review: the live-chat loss notice stays until closed, so it has to
// be closable without a mouse.
// #1485 review: an automatic switch-off must be announced, without making
// every notification interrupt a screen-reader user.
describe('notification announcement', () => {
	afterEach(cleanup);

	it('is an alert when the notification asks to be announced as one', () => {
		render(
			<NotificationsContext.Provider value={{} as any}>
				<Notification
					notification={
						{
							id: 'lost',
							notificationType: 'warning',
							announce: 'alert',
							title: 'Live chat is off',
							text: 'Switch it on again.'
						} as any
					}
				/>
			</NotificationsContext.Provider>
		);

		expect(screen.getByRole('alert').textContent).toContain(
			'Live chat is off'
		);
	});

	it('stays silent otherwise', () => {
		render(
			<NotificationsContext.Provider value={{} as any}>
				<Notification
					notification={
						{
							id: 'saved',
							notificationType: 'success',
							title: 'Saved',
							text: ''
						} as any
					}
				/>
			</NotificationsContext.Provider>
		);

		expect(screen.queryByRole('alert')).toBeNull();
		expect(screen.queryByRole('status')).toBeNull();
	});
});

describe('notification close control', () => {
	afterEach(cleanup);

	it('is a named button', () => {
		renderNotice(true);

		expect(
			screen.getByRole('button', { name: 'app.close' })
		).toBeInstanceOf(HTMLButtonElement);
	});

	it.each(['{Enter}', ' '])(
		'closes the notification from the keyboard (%s)',
		async (key) => {
			const user = userEvent.setup();
			const { removeNotification, onClose } = renderNotice(true);

			await user.tab();
			expect(screen.getByRole('button', { name: 'app.close' })).toBe(
				document.activeElement
			);
			await user.keyboard(key);

			expect(onClose).toHaveBeenCalledTimes(1);
			expect(removeNotification).toHaveBeenCalledWith(
				'liveChatAvailabilityLost',
				'warning'
			);
		}
	);

	it('still closes on a click', async () => {
		const { removeNotification } = renderNotice(true);

		await userEvent.click(
			screen.getByRole('button', { name: 'app.close' })
		);

		expect(removeNotification).toHaveBeenCalledTimes(1);
	});

	it('offers no close control when the notification is not closeable', () => {
		renderNotice(false);

		expect(screen.queryByRole('button')).toBeNull();
	});
});
