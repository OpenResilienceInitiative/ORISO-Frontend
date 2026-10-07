import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { apiGetUserData } from '../../../api';
import { UserDataInterface } from '../../../globalState/interfaces';
import { EmailNotification } from './index';
import { UserDataContext } from '../../../globalState';
import { APP_ORISO_FIGMA_URL } from '../../storybookDesignLinks';

/**
 * The two lists side by side is the whole point of ADR-024, so the stories are
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
			internalChatNotificationEnabled: true,
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
					'E-mail notification settings, per ADR-024. Advice seekers and counsellors get two separate lists rather than one filtered by role — three occasion switches against nine — because an advice seeker uses ORISO a handful of times in a situation they did not choose, and a counsellor works in it daily.\n\nThe screen also names what is sent regardless. Someone arriving from an unsubscribe link on a password-reset mail should read *why* there is no switch, instead of searching the list for one that does not exist.'
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
	name: 'Counsellor (9 occasion switches)',
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

/** Local browser fixture: the real PATCH/GET client persists only the fixture's preference. */
const EmailPreferenceFixture = ({
	children,
	storageKey = 'storybook.selfhelp.appointment.preference'
}: {
	children: React.ReactNode;
	storageKey?: string;
}) => {
	const [data, setData] = React.useState(
		() =>
			userData({
				grantedAuthorities: ['AUTHORIZATION_CONSULTANT_DEFAULT']
			}) as unknown as UserDataInterface
	);
	const reload = React.useCallback(async () => {
		const saved = await apiGetUserData();
		setData(saved);
		return saved;
	}, []);
	React.useEffect(() => {
		const originalFetch = window.fetch;
		const key = storageKey;
		const initial = data;
		window.fetch = async (input, init) => {
			const url = input instanceof Request ? input.url : String(input);
			if (
				new URL(url, window.location.href).pathname !==
				'/service/users/data'
			) {
				return originalFetch(input, init);
			}
			const stored =
				JSON.parse(window.sessionStorage.getItem(key) || 'null') ||
				initial;
			const method =
				init?.method ||
				(input instanceof Request ? input.method : 'GET');
			if (method === 'PATCH') {
				const body = init?.body
					? String(init.body)
					: input instanceof Request
						? await input.clone().text()
						: '{}';
				const patch = JSON.parse(body);
				window.sessionStorage.setItem(
					key,
					JSON.stringify({ ...stored, ...patch })
				);
				return new Response('{}', {
					status: 200,
					headers: { 'Content-Type': 'application/json' }
				});
			}
			return new Response(JSON.stringify(stored), {
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			});
		};
		void reload();
		return () => {
			window.fetch = originalFetch;
		};
		// Initial data seeds only the local fixture; reload reads its persisted state.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [reload, storageKey]);
	return (
		<UserDataContext.Provider
			value={
				{
					userData: data,
					reloadUserData: reload,
					setUserData: setData
				} as never
			}
		>
			<div style={{ maxWidth: 640, padding: 16 }}>{children}</div>
		</UserDataContext.Provider>
	);
};

export const CounsellorAppointmentPreference: Story = {
	name: 'Counsellor appointment preference (local save/reload fixture)',
	decorators: [
		(Story) => (
			<EmailPreferenceFixture>
				<Story />
			</EmailPreferenceFixture>
		)
	],
	parameters: {
		router: {
			initialPath:
				'/profile/notifications/email?mail=selbsthilfe-termin-erinnerung-beratung'
		},
		docs: {
			description: {
				story: 'Local browser fixture only. Toggle the existing appointment preference, then reload this story. The real PATCH/GET client is used with an in-memory browser fixture; this does not send mail or contact Dev.'
			}
		}
	}
};

export const CounsellorInternalChatPreference: Story = {
	name: 'Counsellor internal-chat preference (local save/reload fixture)',
	decorators: [
		(Story) => (
			<EmailPreferenceFixture storageKey="storybook.internal-chat.preference">
				<Story />
			</EmailPreferenceFixture>
		)
	],
	parameters: {
		router: {
			initialPath: '/profile/notifications/email?mail=interne-nachricht'
		},
		docs: {
			description: {
				story: 'Local browser fixture only. The internal counsellor-chat preference is independent of protected feedback and browser notifications. Toggle this preference and reload to observe the fixture saving it; no mail or Dev request is sent.'
			}
		}
	}
};
