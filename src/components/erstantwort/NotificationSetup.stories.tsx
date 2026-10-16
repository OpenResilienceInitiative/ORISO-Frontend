import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { NotificationSetup } from './NotificationSetup';
import { UserDataContext } from '../../globalState/context/UserDataContext';
import { ModalProvider } from '../../globalState/provider/ModalProvider';
import type { UserDataInterface } from '../../globalState/interfaces/UserDataInterface';
import { phone390Globals } from '../message/messageStoryShell';

/**
 * The notification setup as it sits in the first answer. The stories pin the
 * browser permission the page sees, because that — not the button — decides
 * what the person can do next: a blocked site never shows the permission
 * prompt again, so the only honest help is to say where to lift the block.
 */
const account = {
	email: 'ratsuchend@example.org',
	emailNotifications: {
		emailNotificationsEnabled: false,
		settings: {
			newChatMessageNotificationEnabled: false,
			reassignmentNotificationEnabled: false
		}
	}
} as UserDataInterface;

const withPermission = (permission: NotificationPermission) => async () => {
	const original = Object.getOwnPropertyDescriptor(
		window.Notification,
		'permission'
	);
	Object.defineProperty(window.Notification, 'permission', {
		value: permission,
		configurable: true
	});
	return () => {
		if (original)
			Object.defineProperty(window.Notification, 'permission', original);
	};
};

const meta = {
	title: 'Components/Chat/Erstantwort/NotificationSetup',
	component: NotificationSetup,
	parameters: { layout: 'padded' },
	decorators: [
		(Story) => (
			<UserDataContext.Provider
				value={{
					userData: account,
					reloadUserData: async () => account,
					setUserData: () => undefined
				}}
			>
				<ModalProvider>
					<div style={{ maxWidth: 560 }}>
						<Story />
					</div>
				</ModalProvider>
			</UserDataContext.Provider>
		)
	]
} satisfies Meta<typeof NotificationSetup>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Nothing decided yet: the browser may still ask, so no hint is shown. */
export const AskingAllowed: Story = {
	beforeEach: withPermission('default'),
	play: async ({ canvas }) => {
		await expect(
			canvas.queryByText(/blocked for this site|blockiert/i)
		).toBeNull();
	}
};

/** The site is blocked: the prompt can never open again, so say how to undo it. */
export const BlockedInBrowser: Story = {
	beforeEach: withPermission('denied'),
	play: async ({ canvas }) => {
		await expect(
			await canvas.findByText(/blocked for this site|blockiert/i)
		).toBeVisible();
	}
};

/** The same hint at phone width. */
export const BlockedInBrowserMobile: Story = {
	...BlockedInBrowser,
	globals: phone390Globals
};

/** "Browser only" opens the tone dialog first; the browser is asked on its button. */
export const BrowserOnlyOpensToneDialog: Story = {
	beforeEach: withPermission('default'),
	play: async ({ canvas }) => {
		await userEvent.click(
			await canvas.findByRole('button', {
				name: /^(Give me a signal|Geben Sie mir hier ein Signal)/i
			})
		);
		const body = within(document.body);
		await waitFor(() => expect(body.getByRole('radiogroup')).toBeTruthy());
		await expect(
			body.getByText(/ORISO stays open|ORISO in diesem Browser/i)
		).toBeTruthy();
	}
};
