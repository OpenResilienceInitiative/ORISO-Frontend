import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { BrowserNotification } from './index';
import { UserDataContext } from '../../../globalState';

const withUser =
	(grantedAuthorities: string[]) => (Story: React.ComponentType) => (
		<UserDataContext.Provider
			value={
				{
					userData: { grantedAuthorities },
					reloadUserData: () => Promise.resolve(),
					setUserData: () => undefined
				} as never
			}
		>
			<div style={{ maxWidth: 640, padding: 16 }}>
				<Story />
			</div>
		</UserDataContext.Provider>
	);

// Opted in with permission granted, so the per-type switches are visible.
const optedIn = () => {
	const previous = localStorage.getItem('BROWSER_NOTIFICATIONS');
	localStorage.setItem(
		'BROWSER_NOTIFICATIONS',
		JSON.stringify({
			enabled: true,
			initialEnquiry: true,
			newMessage: true,
			visited: true
		})
	);
	Object.defineProperty(window.Notification, 'permission', {
		configurable: true,
		get: () => 'granted'
	});
	return () => {
		delete (window.Notification as { permission?: unknown }).permission;
		if (previous === null) localStorage.removeItem('BROWSER_NOTIFICATIONS');
		else localStorage.setItem('BROWSER_NOTIFICATIONS', previous);
	};
};

const meta = {
	title: 'Organisms/BrowserNotificationSettings',
	component: BrowserNotification,
	tags: ['autodocs'],
	beforeEach: optedIn,
	parameters: {
		docs: {
			description: {
				component:
					'Legacy per-browser pop-up switch, shown under Profile > Settings > Notifications while `enableNewNotifications` is off (#1551). Counsellors also get the new-enquiry switch; advice seekers only get new messages.'
			}
		}
	}
} satisfies Meta<typeof BrowserNotification>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Counsellor: Story = {
	name: 'Counsellor (3 switches)',
	decorators: [withUser(['AUTHORIZATION_CONSULTANT_DEFAULT'])],
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getAllByRole('switch')).toHaveLength(3);
	}
};

export const AdviceSeeker: Story = {
	name: 'Advice seeker (2 switches)',
	decorators: [withUser(['AUTHORIZATION_USER_DEFAULT'])],
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getAllByRole('switch')).toHaveLength(2);
	}
};
