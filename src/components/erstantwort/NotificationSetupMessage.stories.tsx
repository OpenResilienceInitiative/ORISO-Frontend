import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { useTranslation } from 'react-i18next';
import { NotificationSetupMessage } from './NotificationSetupMessage';
import { UserDataContext, TenantContext } from '../../globalState';
import { ModalProvider } from '../../globalState/provider/ModalProvider';
import type { TenantDataInterface } from '../../globalState/interfaces';
import {
	MessageStoryShell,
	phone390Globals,
	desktop1440Globals
} from '../message/messageStoryShell';
import { mockUserData } from '../message/MessageItemComponent.mocks';
import { notificationSettingsStore } from '../../utils/notificationSettings/store';

const tablet820Globals = { viewport: { value: 'tablet820' } };
const COLLAPSE_KEY_PREFIX = 'oriso.notificationSetup.';

/** The suggestion text the consent settings put above the choices. */
const Copy = () => {
	const { t } = useTranslation();
	return <p>{t('caseHandover.consent.info.notificationsCopy')}</p>;
};

/**
 * The account the message is rendered for. Real `NotificationSetup`, real
 * channel hook, real collapse state: only the OS permission and the account
 * are fixtures. Collapse state from earlier stories is wiped on mount so every
 * story starts from "never seen".
 */
const Fixture = ({
	email = false,
	browser = false,
	messageId = '$story-message',
	startOpen = false,
	silenced = false,
	requireConsentEmail = false
}: {
	email?: boolean;
	browser?: boolean;
	messageId?: string;
	startOpen?: boolean;
	/** The device is on but message notifications are muted. */
	silenced?: boolean;
	/** The consent-email suggestion of the Einsichtnahme settings. */
	requireConsentEmail?: boolean;
}) => {
	const [ready, setReady] = React.useState(false);
	const [reloadKey, setReloadKey] = React.useState(0);
	const [userData, setUserData] = React.useState(() =>
		mockUserData({
			email: 'ratsuchend@example.org',
			emailNotifications: {
				emailNotificationsEnabled: email,
				settings: {
					newChatMessageNotificationEnabled: email,
					reassignmentNotificationEnabled: email
				}
			}
		} as never)
	);
	React.useEffect(() => {
		const original = Object.getOwnPropertyDescriptor(
			globalThis,
			'Notification'
		);
		const originalBrowser = localStorage.getItem('BROWSER_NOTIFICATIONS');
		Object.keys(localStorage)
			.filter((key) => key.startsWith(COLLAPSE_KEY_PREFIX))
			.forEach((key) => localStorage.removeItem(key));
		notificationSettingsStore.resetForTests();
		if (silenced) notificationSettingsStore.setDeviceSilenced(true);
		if (browser) {
			localStorage.setItem(
				'BROWSER_NOTIFICATIONS',
				JSON.stringify({ enabled: true })
			);
		} else {
			localStorage.removeItem('BROWSER_NOTIFICATIONS');
		}
		let permission = browser ? 'granted' : 'default';
		Object.defineProperty(globalThis, 'Notification', {
			configurable: true,
			value: {
				get permission() {
					return permission;
				},
				requestPermission: async () => {
					permission = 'granted';
					return permission;
				}
			}
		});
		const overlay = document.getElementById('overlay')
			? null
			: document.createElement('div');
		if (overlay) {
			overlay.id = 'overlay';
			document.body.appendChild(overlay);
		}
		setReady(true);
		return () => {
			overlay?.remove();
			if (original)
				Object.defineProperty(globalThis, 'Notification', original);
			if (originalBrowser === null)
				localStorage.removeItem('BROWSER_NOTIFICATIONS');
			else localStorage.setItem('BROWSER_NOTIFICATIONS', originalBrowser);
			notificationSettingsStore.resetForTests();
		};
	}, [browser, silenced]);
	if (!ready) return null;
	return (
		<UserDataContext.Provider
			value={{
				userData,
				setUserData,
				// The account "saves" what the setup patched.
				reloadUserData: async () => {
					const next = mockUserData({
						email: 'ratsuchend@example.org',
						emailNotifications: {
							emailNotificationsEnabled: true,
							settings: {
								newChatMessageNotificationEnabled: true,
								reassignmentNotificationEnabled: true
							}
						}
					} as never);
					setUserData(next);
					return next;
				}
			}}
		>
			<TenantContext.Provider
				value={{
					tenant: {
						id: 1,
						settings: { featureAskerEmailEnabled: true }
					} as TenantDataInterface,
					setTenant: () => {},
					updateTenantSettings: () => {}
				}}
			>
				<ModalProvider>
					<MessageStoryShell>
						<NotificationSetupMessage
							key={reloadKey}
							messageId={messageId}
							startOpen={startOpen}
							requireConsentEmail={requireConsentEmail}
							copy={<Copy />}
						/>
						<button
							type="button"
							onClick={() => setReloadKey((key) => key + 1)}
						>
							Fixture: reload conversation
						</button>
					</MessageStoryShell>
				</ModalProvider>
			</TenantContext.Provider>
		</UserDataContext.Provider>
	);
};

const meta: Meta<typeof Fixture> = {
	id: 'components-chat-notificationsetupmessage',
	title: 'Chat/System messages/Notification setup',
	component: Fixture,
	tags: ['autodocs'],
	parameters: {
		layout: 'fullscreen',
		viewport: {
			options: {
				tablet820: {
					name: 'Tablet 820',
					styles: { width: '820px', height: '1180px' },
					type: 'tablet'
				}
			}
		},
		docs: {
			description: {
				component:
					'The notification-setup message in the chat history (ORISO-Frontend#1700). It stays in the conversation, but its card collapses to one line ("Benachrichtigung: E-Mail aktiv · ändern") as soon as a channel is chosen or the person closes it with the X. "ändern" opens it again. The state is remembered per account and message.'
			}
		}
	}
};
export default meta;
type Story = StoryObj<typeof meta>;

const DE = { locale: 'de' };
const EN = { locale: 'en' };

const summary =
	(text: RegExp) =>
	async ({ canvasElement }: { canvasElement: HTMLElement }) => {
		const canvas = within(canvasElement);
		await waitFor(() => expect(canvas.getByText(text)).toBeVisible());
		// One line: the choices are gone, "change" is the way back.
		expect(
			canvas.queryByRole('button', { name: /E-Mail|email/i })
		).toBeNull();
	};

export const ExpandedDesktopDe: Story = {
	name: 'Expanded — no channel yet — desktop 1440 (DE)',
	globals: { ...desktop1440Globals, ...DE },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await waitFor(() =>
			expect(
				canvas.getByRole('button', { name: 'Einrichtung ausblenden' })
			).toBeVisible()
		);
		expect(
			canvas.getByRole('button', {
				name: /Schreiben Sie mir eine E-Mail/
			})
		).toBeVisible();
	}
};

export const ExpandedTabletEn: Story = {
	name: 'Expanded — no channel yet — tablet 820 (EN)',
	globals: { ...tablet820Globals, ...EN },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await waitFor(() =>
			expect(
				canvas.getByRole('button', { name: 'Hide setup' })
			).toBeVisible()
		);
	}
};

export const ExpandedPhoneDe: Story = {
	tags: ['device-regression'],
	name: 'Expanded — no channel yet — phone 390 (DE)',
	globals: { ...phone390Globals, ...DE },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const close = canvas.getByRole('button', {
			name: 'Einrichtung ausblenden'
		});
		await waitFor(() => {
			const box = close.getBoundingClientRect();
			expect(box.width).toBeGreaterThanOrEqual(44);
			expect(box.right).toBeLessThanOrEqual(390);
		});
	}
};

export const CollapsedEmailDesktopDe: Story = {
	name: 'Collapsed — e-mail active — desktop 1440 (DE)',
	args: { email: true },
	globals: { ...desktop1440Globals, ...DE },
	play: summary(/Benachrichtigung: E-Mail aktiv/)
};

export const CollapsedEmailPhoneEn: Story = {
	tags: ['device-regression'],
	name: 'Collapsed — e-mail active — phone 390 (EN)',
	args: { email: true },
	globals: { ...phone390Globals, ...EN },
	play: summary(/Notifications: email on/)
};

export const CollapsedSignalTabletDe: Story = {
	name: 'Collapsed — signal active — tablet 820 (DE)',
	args: { browser: true },
	globals: { ...tablet820Globals, ...DE },
	play: summary(/Benachrichtigung: Signal auf diesem Gerät aktiv/)
};

export const CollapsedSignalDesktopEn: Story = {
	name: 'Collapsed — signal active — desktop 1440 (EN)',
	args: { browser: true },
	globals: { ...desktop1440Globals, ...EN },
	play: summary(/Notifications: signal active on this device/)
};

export const CollapsedBothPhoneDe: Story = {
	tags: ['device-regression'],
	name: 'Collapsed — e-mail and signal — phone 390 (DE)',
	args: { email: true, browser: true },
	globals: { ...phone390Globals, ...DE },
	play: summary(/Benachrichtigung: E-Mail und Signal aktiv/)
};

export const CollapsedBothTabletEn: Story = {
	name: 'Collapsed — e-mail and signal — tablet 820 (EN)',
	args: { email: true, browser: true },
	globals: { ...tablet820Globals, ...EN },
	play: summary(/Notifications: email and signal on/)
};

export const ClosedWithXNoChannelDesktopDe: Story = {
	name: 'Closed with X — no channel — desktop 1440 (DE)',
	globals: { ...desktop1440Globals, ...DE },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const close = await canvas.findByRole('button', {
			name: 'Einrichtung ausblenden'
		});
		await waitFor(() => expect(close).toBeVisible());
		await userEvent.click(close);
		await waitFor(() =>
			expect(
				canvas.getByText(/Benachrichtigung: nicht eingerichtet/)
			).toBeVisible()
		);
		expect(
			canvas.getByRole('button', { name: 'Benachrichtigung ändern' })
		).toBeVisible();
	}
};

export const ClosedWithXNoChannelPhoneEn: Story = {
	tags: ['device-regression'],
	name: 'Closed with X — no channel — phone 390 (EN)',
	globals: { ...phone390Globals, ...EN },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const close = await canvas.findByRole('button', { name: 'Hide setup' });
		await waitFor(() => expect(close).toBeVisible());
		await userEvent.click(close);
		await waitFor(() =>
			expect(canvas.getByText(/Notifications: not set up/)).toBeVisible()
		);
	}
};

export const ChooseThenChangeDesktopDe: Story = {
	name: 'Choose e-mail, collapses, "ändern" opens it again (DE)',
	globals: { ...desktop1440Globals, ...DE },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const choice = await canvas.findByRole('button', {
			name: /Schreiben Sie mir eine E-Mail/
		});
		await waitFor(() => expect(choice).toBeVisible());
		await userEvent.click(choice);
		await waitFor(() =>
			expect(
				canvas.getByText(/Benachrichtigung: E-Mail aktiv/)
			).toBeVisible()
		);
		await userEvent.click(
			canvas.getByRole('button', { name: 'Benachrichtigung ändern' })
		);
		await waitFor(() =>
			expect(
				canvas.getByRole('button', {
					name: /Schreiben Sie mir eine E-Mail/
				})
			).toBeVisible()
		);
	}
};

export const ClosedWithXSurvivesReloadDesktopDe: Story = {
	name: 'X survives a reload — still one line (DE)',
	globals: { ...desktop1440Globals, ...DE },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const close = await canvas.findByRole('button', {
			name: 'Einrichtung ausblenden'
		});
		await waitFor(() => expect(close).toBeVisible());
		await userEvent.click(close);
		await userEvent.click(
			canvas.getByRole('button', { name: 'Fixture: reload conversation' })
		);
		await waitFor(() =>
			expect(
				canvas.getByText(/Benachrichtigung: nicht eingerichtet/)
			).toBeVisible()
		);
		expect(
			canvas.queryByRole('button', {
				name: /Schreiben Sie mir eine E-Mail/
			})
		).toBeNull();
	}
};

export const OpenedOnPurposeWithChannelEn: Story = {
	name: 'Opened on purpose — stays in full although e-mail is active (EN)',
	args: { email: true, startOpen: true },
	globals: { ...desktop1440Globals, ...EN },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await waitFor(() =>
			expect(
				canvas.getByRole('button', { name: 'Hide setup' })
			).toBeVisible()
		);
		expect(canvas.queryByText(/Notifications: email on/)).toBeNull();
	}
};

export const SilencedBrowserStaysOpenDesktopEn: Story = {
	name: 'Browser on but silenced — stays in full, with its warning (EN)',
	args: { browser: true, silenced: true },
	globals: { ...desktop1440Globals, ...EN },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await waitFor(() =>
			expect(
				canvas.getByRole('button', { name: 'Hide setup' })
			).toBeVisible()
		);
		expect(canvas.queryByText(/Notifications: /)).toBeNull();
		expect(canvas.getByText(/silenced/)).toBeVisible();
	}
};

export const ConsentSuggestionBrowserOnlyPhoneDe: Story = {
	tags: ['device-regression'],
	name: 'Consent e-mail suggestion — only the browser is on — stays in full — phone 390 (DE)',
	args: { browser: true, requireConsentEmail: true },
	globals: { ...phone390Globals, ...DE },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const close = await canvas.findByRole('button', {
			name: 'Einrichtung ausblenden'
		});
		await waitFor(() => expect(close).toBeVisible());
		expect(canvas.queryByText(/Benachrichtigung: /)).toBeNull();
		expect(
			canvas.getByRole('button', {
				name: /Schreiben Sie mir eine E-Mail/
			})
		).toBeVisible();
		expect(close.getBoundingClientRect().right).toBeLessThanOrEqual(390);
	}
};
