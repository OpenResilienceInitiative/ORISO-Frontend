import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { createInstance } from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import de from '../../resources/i18n/de/common.json';
import en from '../../resources/i18n/en/common.json';
import fr from '../../resources/i18n/fr/common.json';
import { UserDataContext } from '../../globalState/context/UserDataContext';
import { UserDataProvider } from '../../globalState/provider/UserDataProvider';
import {
	TenantContext,
	TenantProvider
} from '../../globalState/provider/TenantProvider';
import {
	NotificationsContext,
	NotificationsProvider
} from '../../globalState/provider/NotificationsProvider';
import { Notifications } from '../notifications/Notifications';
import { CircleSettingsStage } from '../conversationCreate/circle/circleSettingsStage';
import { usePendingGroupChatJoin } from '../../hooks/usePendingGroupChatJoin';
import { Text } from '../text/Text';
import {
	desktop1440Globals,
	phone390Globals
} from '../message/messageStoryShell';

type ReviewArgs = {
	scenario: 'circle' | 'assignment';
	locale: 'de' | 'en' | 'fr';
	failureStatus: 403 | 502;
	layout: 'desktop' | 'mobile';
	retrySucceeds: boolean;
};
const catalogues = { de, en, fr };
const requests: Request[] = [];

const PrepareSession = ({
	scenario,
	children
}: {
	scenario: ReviewArgs['scenario'];
	children: React.ReactNode;
}) => {
	const { setTenant } = React.useContext(TenantContext);
	const { userData, setUserData } = React.useContext(UserDataContext);
	React.useEffect(() => {
		setTenant({
			id: 41,
			settings: { featureGroupChatV2Enabled: true }
		} as Parameters<typeof setTenant>[0]);
		setUserData({
			userId: 'storybook-group-review',
			userName: 'storybook-group-review',
			grantedAuthorities:
				scenario === 'assignment'
					? ['AUTHORIZATION_USER_DEFAULT']
					: [
							'AUTHORIZATION_CONSULTANT_DEFAULT',
							'AUTHORIZATION_CREATE_NEW_CHAT'
						]
		} as Parameters<typeof setUserData>[0]);
	}, [scenario, setTenant, setUserData]);
	return userData ? <>{children}</> : null;
};
const VisibleNotifications = () => {
	const { notifications } = React.useContext(NotificationsContext);
	return <Notifications notifications={notifications} />;
};
const PendingInvite = () => {
	const { userData } = React.useContext(UserDataContext);
	usePendingGroupChatJoin(userData);
	return (
		<Text
			text="Local group invitation review. The actual notification and retry action appear below."
			type="standard"
		/>
	);
};
const RouteObservation = () => (
	<output aria-label="Current route">{useLocation().pathname}</output>
);

/** Existing components/providers and bundled copy; only the HTTP system boundary is replaced. */
const Review = ({ scenario, locale, layout }: ReviewArgs) => {
	const translations = React.useMemo(() => {
		const instance = createInstance().use(initReactI18next);
		void instance.init({
			lng: locale,
			fallbackLng: 'de',
			initImmediate: false,
			defaultNS: 'common',
			resources: {
				de: { common: de },
				en: { common: en },
				fr: { common: fr }
			},
			interpolation: { escapeValue: false }
		});
		return instance;
	}, [locale]);
	return (
		<I18nextProvider i18n={translations}>
			<TenantProvider>
				<UserDataProvider>
					<NotificationsProvider>
						<PrepareSession scenario={scenario}>
							{scenario === 'circle' ? (
								<CircleSettingsStage
									layout={layout}
									people={[]}
									activeLanguages={[locale]}
								/>
							) : (
								<PendingInvite />
							)}
							<VisibleNotifications />
							<RouteObservation />
						</PrepareSession>
					</NotificationsProvider>
				</UserDataProvider>
			</TenantProvider>
		</I18nextProvider>
	);
};

const installBoundary = (args: ReviewArgs) => {
	const originalFetch = globalThis.fetch;
	const originalUrl = window.location.href;
	const previewUrl = new URL(originalUrl);
	if (args.scenario === 'assignment')
		previewUrl.searchParams.set('gcid', '19.Ab3_x-Yz');
	else previewUrl.searchParams.delete('gcid');
	window.history.replaceState(null, '', previewUrl);
	requests.length = 0;
	const boundary: typeof fetch = async (input, init) => {
		const request = new Request(input, init);
		const path = new URL(request.url).pathname;
		const mutation =
			args.scenario === 'circle'
				? request.method === 'POST' &&
					path === '/service/users/chat/v2/new'
				: request.method === 'PUT' &&
					path === '/service/users/chat/19/assign';
		if (mutation) {
			requests.push(request.clone());
			if (args.retrySucceeds && requests.length > 1)
				return new Response(null, { status: 204 });
			return new Response('', {
				status: args.failureStatus,
				headers: {
					'X-Reason':
						args.failureStatus === 403
							? 'DPA_NEW_COUNSELLING_NOT_ALLOWED'
							: 'DPA_POLICY_UNAVAILABLE'
				}
			});
		}
		if (
			path.startsWith('/service/') ||
			!['GET', 'HEAD'].includes(request.method)
		)
			throw new Error(
				`Unexpected review HTTP: ${request.method} ${path}`
			);
		return originalFetch(input, init);
	};
	globalThis.fetch = boundary;
	return () => {
		if (globalThis.fetch === boundary) globalThis.fetch = originalFetch;
		window.history.replaceState(null, '', originalUrl);
	};
};

const meta = {
	title: 'GroupChat/AVV feedback',
	component: Review,
	tags: ['autodocs'],
	parameters: {
		layout: 'fullscreen',
		router: { initialPath: '/sessions/user/view' },
		docs: {
			description: {
				component:
					'Local HTTP-to-UI proof for group AVV refusals and verification outages. Circle stories reuse the existing circle-settings stage; invitation stories show the real notification and pending-join hook. They do not prove a deployed backend or direct Matrix admission enforcement.'
			}
		}
	},
	args: {
		scenario: 'circle',
		locale: 'de',
		failureStatus: 403,
		layout: 'desktop',
		retrySucceeds: false
	},
	argTypes: {
		scenario: { control: false },
		failureStatus: { control: false },
		retrySucceeds: { control: false },
		locale: { control: 'select', options: ['de', 'en', 'fr'] },
		layout: { control: 'select', options: ['desktop', 'mobile'] }
	},
	beforeEach: ({ args }) => installBoundary(args)
} satisfies Meta<ReviewArgs>;
export default meta;
type Story = StoryObj<typeof meta>;

const showFailure: Story['play'] = async ({ args }) => {
	const view = within(document.body);
	const catalogue = catalogues[args.locale];
	if (args.scenario === 'circle') {
		await userEvent.type(
			await view.findByRole('textbox', {
				name: catalogue.groupChat.create.authorContent.welcome
			}),
			'Synthetic review draft'
		);
		const create = view.getByRole('button', {
			name: catalogue.groupChat.circle.createLabel
		});
		await waitFor(() => expect(create).toBeEnabled());
		await userEvent.click(create);
	}
	const notice = await view.findByRole('alert');
	const copy =
		args.failureStatus === 403
			? catalogue.counselling.dpa.restricted
			: catalogue.counselling.dpa.unavailable;
	await waitFor(() =>
		expect(within(notice).getByText(copy.title)).toBeVisible()
	);
	await expect(requests).toHaveLength(1);
	await expect(view.getByLabelText('Current route')).toHaveTextContent(
		'/sessions/user/view'
	);
	if (args.scenario === 'circle') {
		await expect(
			view.getByRole('textbox', {
				name: catalogue.groupChat.create.authorContent.welcome
			})
		).toHaveValue('Synthetic review draft');
		await expect(
			view.getByRole('button', {
				name: catalogue.groupChat.circle.createLabel
			})
		).toBeEnabled();
	} else {
		await expect(
			within(notice).getByRole('button', {
				name: catalogue.groupChat.loadError.retry
			})
		).toBeEnabled();
		if (args.retrySucceeds) {
			await userEvent.click(
				within(notice).getByRole('button', {
					name: catalogue.groupChat.loadError.retry
				})
			);
			await waitFor(() =>
				expect(view.getByLabelText('Current route')).toHaveTextContent(
					'/groups/19/entry'
				)
			);
			await expect(requests).toHaveLength(2);
			await expect(requests[1].url).toBe(requests[0].url);
			await expect(
				new URL(requests[1].url).searchParams.get('inviteToken')
			).toBe('Ab3_x-Yz');
			await waitFor(() => expect(view.queryByRole('alert')).toBeNull());
		}
	}
};

export const CircleRestricted: Story = {
	globals: desktop1440Globals,
	play: showFailure
};
export const CircleVerificationUnavailableMobile: Story = {
	globals: phone390Globals,
	args: { failureStatus: 502, locale: 'en', layout: 'mobile' },
	play: showFailure
};
export const InvitationRestricted: Story = {
	args: { scenario: 'assignment', locale: 'fr' },
	play: showFailure
};
export const InvitationVerificationUnavailable: Story = {
	args: { scenario: 'assignment', failureStatus: 502 },
	play: showFailure
};
export const InvitationPermissionRestoredRetry: Story = {
	args: { scenario: 'assignment', retrySucceeds: true },
	play: showFailure
};
