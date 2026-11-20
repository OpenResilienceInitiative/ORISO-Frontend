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
let emailWrites = 0;
let notificationWrites = 0;
type FixtureProps = {
	firstReply?: boolean;
	emailOnlySetup?: boolean;
	refreshFailure?: boolean;
};
const Setup = ({
	firstReply = false,
	emailOnlySetup = false
}: FixtureProps) => {
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
					trigger={
						emailOnlySetup
							? 'AFTER_ENQUIRY_DISPATCHED'
							: 'AFTER_FIRST_MESSAGE'
					}
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
const Fixture = ({
	firstReply = false,
	emailOnlySetup = false,
	refreshFailure = false
}: FixtureProps) => {
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
			email =
				firstReply && !emailOnlySetup
					? undefined
					: 'existing@example.test',
			refreshAttempts = 0,
			permission = 'default';
		const overlay = document.createElement('div');
		overlay.id = 'overlay';
		document.body.appendChild(overlay);
		releaseRefresh = undefined;
		browserRequests = 0;
		emailWrites = 0;
		notificationWrites = 0;
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
					notificationWrites++;
					acceptedWrite = true;
					return new Response('{}', { status: 200 });
				}
				if (!acceptedWrite) return response();
				return new Promise<Response>((resolve, reject) => {
					const attempt = ++refreshAttempts;
					releaseRefresh = () =>
						refreshFailure && attempt === 1
							? reject(new TypeError('Synthetic offline refresh'))
							: resolve(response());
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
				emailWrites++;
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
	}, [firstReply, emailOnlySetup, refreshFailure]);
	if (!ready) return null;
	return (
		<>
			<TenantContext.Provider
				value={{
					tenant: accountPolicyTenant({
						featureAskerEmailCollectionSelfHelpEnabled: false,
						featureAskerBrowserAgencyCounsellingEnabled:
							!emailOnlySetup
					}),
					setTenant: () => {},
					updateTenantSettings: () => {}
				}}
			>
				<UserDataProvider>
					<ModalProvider>
						<Setup
							firstReply={firstReply}
							emailOnlySetup={emailOnlySetup}
						/>
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
		// The browser step lives in a modal dialog, outside the canvas.
		await userEvent.click(
			await within(canvasElement.ownerDocument.body).findByRole(
				'button',
				{
					name: i18n.t('erstantwort.notificationChoice.enableBrowser')
				}
			)
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
	name: 'Accepted first-reply email keeps the form closed',
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
		// The last confirmed capability stays while the refresh is pending.
		await expect(
			canvas.getByTestId('collection-capability')
		).toHaveTextContent('true');
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

const acceptedFailure = async (canvasElement: HTMLElement) => {
	const canvas = within(canvasElement),
		page = within(canvasElement.ownerDocument.body);
	await userEvent.click(
		await canvas.findByRole('button', {
			name: i18n.t('erstantwort.emailNotification.action')
		})
	);
	await userEvent.type(await page.findByRole('textbox'), 'new@example.test');
	await userEvent.click(
		page.getByRole('button', {
			name: i18n.t('furtherSteps.email.overlay.button1.label')
		})
	);
	await waitFor(() => expect(typeof releaseRefresh).toBe('function'));
	// The last confirmed capability stays while the refresh is pending.
	await expect(canvas.getByTestId('collection-capability')).toHaveTextContent(
		'true'
	);
	releaseRefresh!();
	await waitFor(() =>
		expect(canvas.getByTestId('collection-capability')).toHaveTextContent(
			'false'
		)
	);
	await waitFor(() =>
		expect(
			page.getByRole('heading', {
				name: i18n.t('furtherSteps.email.success.overlay.headline')
			})
		).toBeVisible()
	);
	await expect(page.getByRole('alert')).toHaveTextContent(
		i18n.t('erstantwort.emailNotification.refreshFailed')
	);
	await expect(page.queryByRole('textbox')).toBeNull();
	await expect(emailWrites).toBe(1);
	return { canvas, page };
};
export const AcceptedEmailRefreshFailure: Story = {
	args: { firstReply: true, refreshFailure: true },
	play: async ({ canvasElement }) => {
		await acceptedFailure(canvasElement);
	}
};
export const AcceptedEmailRefreshRetry: Story = {
	args: { firstReply: true, refreshFailure: true },
	play: async ({ canvasElement }) => {
		const { canvas, page } = await acceptedFailure(canvasElement),
			previous = releaseRefresh;
		await userEvent.click(
			page.getByRole('button', {
				name: i18n.t('erstantwort.emailNotification.retryRefresh')
			})
		);
		await waitFor(() => expect(releaseRefresh).not.toBe(previous));
		await expect(page.queryByRole('textbox')).toBeNull();
		releaseRefresh!();
		await waitFor(() =>
			expect(
				canvas.getByTestId('collection-capability')
			).toHaveTextContent('true')
		);
		await expect(page.queryByRole('alert')).toBeNull();
		await expect(emailWrites).toBe(1);
	}
};
export const AcceptedEmailOnlyRefreshFailure: Story = {
	args: { firstReply: true, emailOnlySetup: true, refreshFailure: true },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(
			await canvas.findByRole('button', {
				name: new RegExp(i18n.t('erstantwort.notificationChoice.email'))
			})
		);
		await waitFor(() => expect(typeof releaseRefresh).toBe('function'));
		// The last confirmed capability stays while the refresh is pending.
		await expect(
			canvas.getByTestId('collection-capability')
		).toHaveTextContent('true');
		releaseRefresh!();
		await waitFor(() =>
			expect(
				canvas.getByTestId('collection-capability')
			).toHaveTextContent('false')
		);
		await expect(canvas.getByRole('alert')).toHaveTextContent(
			i18n.t('erstantwort.notificationChoice.refreshFailed')
		);
		await expect(
			canvas.getByRole('button', {
				name: i18n.t('erstantwort.emailNotification.retryRefresh')
			})
		).toBeVisible();
		await expect(
			canvasElement.querySelector('input:not([readonly]):not([disabled])')
		).toBeNull();
		await expect(notificationWrites).toBe(1);
		await expect(emailWrites).toBe(0);
	}
};
