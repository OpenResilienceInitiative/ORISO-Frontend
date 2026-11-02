import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import i18n from '../../i18n';
import { NotificationSetup } from './NotificationSetup';
import { UserDataProvider } from '../../globalState/provider/UserDataProvider';
import { UserDataContext } from '../../globalState/context/UserDataContext';
import { TenantContext } from '../../globalState/provider/TenantProvider';
import { ModalProvider } from '../../globalState/provider/ModalProvider';
import { useAccountEmailCollectionAllowed } from '../../hooks/useAccountEmailCollectionAllowed';
import {
	accountPolicyTenant,
	accountPolicyUser
} from '../../test/fixtures/askerAccountPolicyFixtures';
import { notificationSettingsStore } from '../../utils/notificationSettings/store';
import { endpoints } from '../../resources/scripts/endpoints';
import { ErstantwortMessage } from './ErstantwortMessage';

let releaseRefresh: (() => void) | undefined;
let browserRequests = 0;
const Setup = ({ firstReply = false }: { firstReply?: boolean }) => {
	const { userData, reloadUserData } = React.useContext(UserDataContext);
	const emailAllowed = useAccountEmailCollectionAllowed();
	React.useEffect(() => {
		void reloadUserData();
	}, [reloadUserData]);
	return (
		<>
			<span hidden data-testid="collection-capability">
				{String(userData?.isAskerEmailCollectionAllowed)}
			</span>
			{firstReply ? (
				<ErstantwortMessage
					trigger="AFTER_FIRST_MESSAGE"
					conversationType="AGENCY_COUNSELLING"
					skipAnimation
				/>
			) : (
				<NotificationSetup isEmailEnabled={emailAllowed} />
			)}
		</>
	);
};

/** Real provider, HTTP primitive and setup; only server responses/OS permission are synthetic. */
const Fixture = ({ firstReply = false }: { firstReply?: boolean }) => {
	const [ready, setReady] = React.useState(false);
	React.useEffect(() => {
		const originalFetch = globalThis.fetch;
		const originalNotification = Object.getOwnPropertyDescriptor(
			globalThis,
			'Notification'
		);
		const originalBrowser = localStorage.getItem('BROWSER_NOTIFICATIONS');
		let subscribed = false,
			acceptedWrite = false,
			email = firstReply ? undefined : 'existing@example.test',
			permission = 'default';
		const overlay = document.createElement('div');
		overlay.id = 'overlay';
		document.body.appendChild(overlay);
		releaseRefresh = undefined;
		browserRequests = 0;
		notificationSettingsStore.resetForTests();
		localStorage.removeItem('BROWSER_NOTIFICATIONS');
		const response = () =>
			Response.json(
				accountPolicyUser({
					email,
					isAskerEmailCollectionAllowed: true,
					emailNotifications: {
						emailNotificationsEnabled: subscribed,
						settings: {
							newChatMessageNotificationEnabled: subscribed,
							reassignmentNotificationEnabled: subscribed
						}
					}
				})
			);
		globalThis.fetch = async (input, init) => {
			const url =
				typeof input === 'string'
					? input
					: input instanceof Request
						? input.url
						: input.href;
			const method =
				init?.method ??
				(input instanceof Request ? input.method : 'GET');
			if (
				new URL(url, window.location.origin).pathname ===
				new URL(endpoints.userData, window.location.origin).pathname
			) {
				if (method === 'PATCH') {
					subscribed = true;
					acceptedWrite = true;
					return new Response('{}', { status: 200 });
				}
				if (!acceptedWrite) return response();
				return new Promise<Response>((resolve) => {
					releaseRefresh = () => resolve(response());
				});
			}
			if (
				new URL(url, window.location.origin).pathname ===
					new URL(endpoints.email, window.location.origin).pathname &&
				method === 'PUT'
			) {
				const body =
					init?.body ??
					(input instanceof Request
						? await input.clone().text()
						: '');
				email = JSON.parse(String(body));
				acceptedWrite = true;
				return new Response(null, { status: 204 });
			}
			return originalFetch(input, init);
		};
		Object.defineProperty(globalThis, 'Notification', {
			configurable: true,
			value: {
				get permission() {
					return permission;
				},
				requestPermission: async () => {
					browserRequests++;
					permission = 'granted';
					return permission;
				}
			}
		});
		setReady(true);
		return () => {
			globalThis.fetch = originalFetch;
			overlay.remove();
			if (originalNotification)
				Object.defineProperty(
					globalThis,
					'Notification',
					originalNotification
				);
			else Reflect.deleteProperty(globalThis, 'Notification');
			if (originalBrowser === null)
				localStorage.removeItem('BROWSER_NOTIFICATIONS');
			else localStorage.setItem('BROWSER_NOTIFICATIONS', originalBrowser);
			notificationSettingsStore.resetForTests();
			releaseRefresh = undefined;
		};
	}, [firstReply]);
	if (!ready) return null;
	return (
		<>
			<TenantContext.Provider
				value={{
					tenant: accountPolicyTenant({
						featureAskerEmailCollectionLiveChatEnabled: false
					}),
					setTenant: () => {},
					updateTenantSettings: () => {}
				}}
			>
				<UserDataProvider>
					<ModalProvider>
						<Setup firstReply={firstReply} />
					</ModalProvider>
				</UserDataProvider>
			</TenantContext.Provider>
		</>
	);
};
const meta = {
	title: 'Chat/System messages/Notification account refresh',
	component: Fixture,
	tags: ['autodocs'],
	parameters: { layout: 'padded' }
} satisfies Meta<typeof Fixture>;
export default meta;
type Story = StoryObj<typeof meta>;
export const AcceptedRefreshKeepsBoth: Story = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(
			await canvas.findByRole('button', {
				name: new RegExp(
					i18n.t('erstantwort.notificationChoice.bothSetup')
				)
			})
		);
		await waitFor(() => expect(typeof releaseRefresh).toBe('function'));
		await expect(
			canvas.queryByRole('button', {
				name: i18n.t('erstantwort.notificationChoice.enableBrowser')
			})
		).toBeNull();
		await expect(browserRequests).toBe(0);
		releaseRefresh!();
		await userEvent.click(
			await canvas.findByRole('button', {
				name: i18n.t('erstantwort.notificationChoice.enableBrowser')
			})
		);
		await waitFor(() =>
			expect(
				canvas.getByRole('button', {
					name: new RegExp(
						i18n.t('erstantwort.notificationChoice.bothSetup')
					)
				})
			).toHaveAttribute('aria-pressed', 'true')
		);
		await expect(browserRequests).toBe(1);
	}
};

export const AcceptedFirstReplyEmailStaysClosed: Story = {
	args: { firstReply: true },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement),
			page = within(canvasElement.ownerDocument.body);
		await userEvent.click(
			await canvas.findByRole('button', {
				name: i18n.t('erstantwort.emailNotification.action')
			})
		);
		await userEvent.type(
			await page.findByRole('textbox'),
			'new@example.test'
		);
		await userEvent.click(
			page.getByRole('button', {
				name: i18n.t('furtherSteps.email.overlay.button1.label')
			})
		);
		await waitFor(() => expect(typeof releaseRefresh).toBe('function'));
		await waitFor(() =>
			expect(
				canvas.getByTestId('collection-capability')
			).toHaveTextContent('undefined')
		);
		await expect(page.queryByRole('textbox')).toBeNull();
		releaseRefresh!();
		await waitFor(() =>
			expect(
				canvas.getByTestId('collection-capability')
			).toHaveTextContent('true')
		);
		await expect(page.queryByRole('textbox')).toBeNull();
	}
};
