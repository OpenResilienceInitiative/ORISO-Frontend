import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { EmailNotification } from './index';
import { UserDataContext } from '../../../globalState';
import { APP_ORISO_FIGMA_URL } from '../../storybookDesignLinks';

/**
 * The two lists side by side is the whole point of ADR-019, so the stories are
 * built to be compared rather than to demonstrate a component.
 */
const userData = (
	overrides: Partial<Record<string, unknown>> = {}
): Record<string, unknown> => ({
	email: 'jemand@example.org',
	grantedAuthorities: ['AUTHORIZATION_USER_DEFAULT'],
	emailToggles: [
		{ name: 'DAILY_ENQUIRY', state: true },
		{ name: 'NEW_CHAT_MESSAGE_FROM_ADVICE_SEEKER', state: true }
	],
	emailNotifications: {
		emailNotificationsEnabled: true,
		settings: {
			initialEnquiryNotificationEnabled: true,
			newChatMessageNotificationEnabled: true,
			reassignmentNotificationEnabled: true,
			appointmentNotificationEnabled: true,
			assignmentNotificationEnabled: true,
			feedbackNotificationEnabled: true,
			serviceNoticeNotificationEnabled: true
		}
	},
	...overrides
});

/**
 * The preview already wraps every story in a `MemoryRouter`, so this must not
 * add another — nesting two routers throws. A story that needs a query string
 * sets `parameters.router.initialPath` instead, which is what the preview
 * reads.
 */
const withUser =
	(data: Record<string, unknown>) => (Story: React.ComponentType) => (
		<UserDataContext.Provider
			value={
				{
					userData: data,
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

const meta = {
	title: 'Organisms/EmailNotificationSettings',
	component: EmailNotification,
	tags: ['autodocs'],
	parameters: {
		design: { type: 'figma', url: APP_ORISO_FIGMA_URL },
		docs: {
			description: {
				component:
					'E-mail notification settings, per ADR-019. Advice seekers and counsellors get two separate lists rather than one filtered by role — three switches against seven — because an advice seeker uses ORISO a handful of times in a situation they did not choose, and a counsellor works in it daily.\n\nThe screen also names what is sent regardless. Someone arriving from an unsubscribe link on a password-reset mail should read *why* there is no switch, instead of searching the list for one that does not exist.'
			}
		}
	}
} satisfies Meta<typeof EmailNotification>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AdviceSeeker: Story = {
	name: 'Advice seeker (3 switches)',
	decorators: [withUser(userData())]
};

export const Consultant: Story = {
	name: 'Counsellor (7 switches)',
	decorators: [
		withUser(
			userData({
				grantedAuthorities: ['AUTHORIZATION_CONSULTANT_DEFAULT']
			})
		)
	]
};

export const FromAnUnsubscribeLink: Story = {
	name: 'Arrived from an unsubscribe link',
	decorators: [
		withUser(
			userData({
				grantedAuthorities: ['AUTHORIZATION_CONSULTANT_DEFAULT']
			})
		)
	],
	parameters: {
		router: {
			initialPath:
				'/profile/notifications/email?mail=uebergabe-bestaetigt'
		},
		docs: {
			description: {
				story: 'Every ORISO mail links here with `?mail=<occasion>`. The matching switch is highlighted and scrolled to, so the recipient lands on the control that produced the mail in their hand.'
			}
		}
	}
};

export const NoEmailAddress: Story = {
	name: 'No e-mail address set',
	decorators: [withUser(userData({ email: undefined }))]
};

export const OnPhone: Story = {
	name: 'Counsellor on a phone (375px)',
	decorators: [
		(Story) => (
			<div style={{ width: 375, border: '1px solid #e0dada' }}>
				<Story />
			</div>
		),
		withUser(
			userData({
				grantedAuthorities: ['AUTHORIZATION_CONSULTANT_DEFAULT']
			})
		)
	]
};
