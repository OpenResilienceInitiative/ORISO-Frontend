import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { CaseHandoverConversation } from './CaseHandoverConversation';
import { MessageItemComponent } from '../message/MessageItemComponent';
import {
	MessageContextShell,
	phone390Globals,
	desktop1440Globals
} from '../message/messageStoryShell';
import { UserDataContext, TenantContext } from '../../globalState';
import { ModalProvider } from '../../globalState/provider/ModalProvider';
import type { TenantDataInterface } from '../../globalState/interfaces';
import {
	mockMessageItemComponentProps,
	mockE2eeParams,
	mockUserData,
	MOCK_ASKER_MATRIX_ID
} from '../message/MessageItemComponent.mocks';
import { endpoints } from '../../resources/scripts/endpoints';
import { notificationSettingsStore } from '../../utils/notificationSettings/store';

const persistedFirstResponse = `[SYSTEM_NOTIFICATION]${JSON.stringify({
	type: 'FIRST_RESPONSE',
	version: 1,
	bausteine: [
		{ id: 'greeting', body: 'Ihre Anfrage ist angekommen.' },
		{
			id: 'whoReadsAlong',
			headline: 'Wer liest meine Nachricht?',
			body: 'Ihre Nachricht lesen ausschließlich die Fachkräfte der zuständigen Beratungsstelle.'
		},
		{
			id: 'deadline',
			headline: 'Wann bekomme ich eine Antwort?',
			body: 'Sie erhalten innerhalb von zwei Werktagen eine Antwort.'
		},
		{
			id: 'emailNotification',
			headline: 'Wie sollen wir Sie erreichen?',
			body: 'Der Inhalt der Beratung steht nie in dieser E-Mail.',
			action: { kind: 'ADD_EMAIL', label: 'E-Mail-Adresse angeben' }
		}
	]
})}`;

/** Real renderers and real account APIs. Only the external HTTP and OS-permission
 * boundaries are fixtures. The in-memory account survives fixture remounts;
 * this proves UI continuation/readback, not backend/Dev persistence or delivery. */
function Journey({
	regular = false,
	hostWidth
}: {
	regular?: boolean;
	hostWidth?: number;
}) {
	const saved = React.useRef(
		mockUserData({ userId: MOCK_ASKER_MATRIX_ID, email: undefined })
	);
	const [userData, setUserData] = React.useState(saved.current);
	const [reloadKey, setReloadKey] = React.useState(0);
	const [consent, setConsent] = React.useState(false);
	const [ready, setReady] = React.useState(false);
	React.useEffect(() => {
		const originalFetch = globalThis.fetch;
		const ownedOverlay = document.getElementById('overlay')
			? null
			: document.createElement('div');
		if (ownedOverlay) {
			ownedOverlay.id = 'overlay';
			document.body.appendChild(ownedOverlay);
		}
		const originalNotification = Object.getOwnPropertyDescriptor(
			globalThis,
			'Notification'
		);
		const originalBrowserSettings = localStorage.getItem(
			'BROWSER_NOTIFICATIONS'
		);
		localStorage.removeItem('BROWSER_NOTIFICATIONS');
		notificationSettingsStore.resetForTests();
		let permission = 'default';
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
		globalThis.fetch = async (input, init) => {
			const url =
				typeof input === 'string'
					? input
					: input instanceof URL
						? input.href
						: input.url;
			const method =
				init?.method ??
				(input instanceof Request ? input.method : 'GET');
			const body =
				init?.body ??
				(input instanceof Request
					? await input.clone().text()
					: undefined);
			const matches = (endpoint: string) =>
				new URL(url, window.location.origin).pathname ===
				new URL(endpoint, window.location.origin).pathname;
			if (matches(endpoints.email) && method === 'PUT') {
				saved.current = {
					...saved.current,
					email: JSON.parse(String(body))
				};
				return new Response(null, { status: 204 });
			}
			if (matches(endpoints.userData) && method === 'PATCH') {
				saved.current = {
					...saved.current,
					...JSON.parse(String(body))
				};
				return new Response(null, { status: 204 });
			}
			return originalFetch(input, init);
		};
		setReady(true);
		return () => {
			globalThis.fetch = originalFetch;
			ownedOverlay?.remove();
			if (originalNotification)
				Object.defineProperty(
					globalThis,
					'Notification',
					originalNotification
				);
			if (originalBrowserSettings === null)
				localStorage.removeItem('BROWSER_NOTIFICATIONS');
			else
				localStorage.setItem(
					'BROWSER_NOTIFICATIONS',
					originalBrowserSettings
				);
			notificationSettingsStore.resetForTests();
		};
	}, []);
	const reloadUserData = async () => {
		setUserData(saved.current);
		return saved.current;
	};
	if (!ready) return null;
	return (
		<MessageContextShell userData={userData}>
			<div
				style={{
					width: hostWidth
						? Math.min(hostWidth, window.innerWidth - 32)
						: undefined,
					maxWidth: '100%'
				}}
			>
				<UserDataContext.Provider
					value={{ userData, setUserData, reloadUserData }}
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
							<div
								role="region"
								aria-label="Fixture conversation"
								key={reloadKey}
							>
								{regular ? (
									<MessageItemComponent
										{...mockMessageItemComponentProps({
											message: persistedFirstResponse,
											messageTime: '1',
											t: null
										})}
										handleDecryptionErrors={() => {}}
										handleDecryptionSuccess={() => {}}
										e2eeParams={mockE2eeParams()}
									/>
								) : (
									<CaseHandoverConversation
										mode="OPT_IN"
										consentGranted={consent}
										onApprove={() => setConsent(true)}
										onDecline={() => setConsent(false)}
									/>
								)}
							</div>
							<button
								type="button"
								onClick={() => {
									setUserData(saved.current);
									setReloadKey((key) => key + 1);
								}}
							>
								Fixture: reload conversation
							</button>
						</ModalProvider>
					</TenantContext.Provider>
				</UserDataContext.Provider>
			</div>
		</MessageContextShell>
	);
}

const meta: Meta<typeof Journey> = {
	title: 'Organisms/CaseHandover/ConversationJourney',
	component: Journey,
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
					'Actual Carimat conversation, M3 dialog, email overlay and API clients. External HTTP and OS permission are isolated fixtures; this is local browser acceptance, not Dev/backend proof.'
			}
		}
	}
};
export default meta;
type Story = StoryObj<typeof meta>;

const shortcut: Story['play'] = async ({ canvasElement, globals }) => {
	const expectedViewport: Record<string, number> = {
		phone390: 390,
		tablet820: 820,
		desktop1440: 1440
	};
	expect(window.innerWidth).toBe(expectedViewport[globals.viewport.value]);
	const canvas = within(canvasElement);
	const page = within(canvasElement.ownerDocument.body);
	const more = await canvas.findByRole('button', { name: 'Mehr erfahren' });
	await userEvent.click(more);
	await page.findByRole('dialog');
	expect(page.getByRole('switch')).not.toBeChecked();
	await userEvent.click(page.getByTestId('m3-dialog-close'));
	await waitFor(() => expect(page.queryByRole('dialog')).toBeNull());
	await waitFor(() => expect(more).toHaveFocus());
	expect(
		canvas.queryByRole('region', { name: 'Benachrichtigungen einrichten' })
	).toBeNull();
	const openSetup = async () => {
		await userEvent.click(
			canvas.getByRole('button', { name: 'Mehr erfahren' })
		);
		const setup = await page.findByRole('button', {
			name: 'Benachrichtigungen einrichten'
		});
		expect(page.getByRole('switch')).not.toBeChecked();
		await userEvent.click(setup);
		await waitFor(() => expect(page.queryByRole('dialog')).toBeNull());
		const message = canvas.getByRole('region', {
			name: 'Benachrichtigungen einrichten'
		});
		await waitFor(() => expect(message).toHaveFocus());
		expect(
			canvas.getAllByRole('region', {
				name: 'Benachrichtigungen einrichten'
			})
		).toHaveLength(1);
		const consentBubble = canvasElement.querySelector(
			'.caseHandoverInlineConsent .messageItem__message--systemNotification'
		)!;
		const notificationBubble = message.querySelector(
			'.erstantwort__bubble'
		)!;
		const consentBounds = consentBubble.getBoundingClientRect();
		const notificationBounds = notificationBubble.getBoundingClientRect();
		expect(
			Math.abs(consentBounds.left - notificationBounds.left)
		).toBeLessThanOrEqual(1);
		expect(
			Math.abs(consentBounds.width - notificationBounds.width)
		).toBeLessThanOrEqual(1);

		const heading = message.querySelector(
			'.caseHandoverNotificationTitle'
		)!;
		const titleText = Array.from(heading.childNodes).find(
			(node) =>
				node.nodeType === Node.TEXT_NODE &&
				node.textContent?.includes('Benachrichtigungen')
		)!;
		const word = 'Benachrichtigungen';
		const wordStart = titleText.textContent!.indexOf(word);
		const range = document.createRange();
		range.setStart(titleText, wordStart);
		range.setEnd(titleText, wordStart + word.length);
		expect(range.getClientRects()).toHaveLength(1);
		expect(range.getBoundingClientRect().right).toBeLessThanOrEqual(
			notificationBounds.right + 1
		);

		const focusStyle = getComputedStyle(notificationBubble);
		expect(focusStyle.outlineStyle).not.toBe('none');
		expect(parseFloat(focusStyle.outlineWidth)).toBeGreaterThanOrEqual(2);
		expect(parseFloat(focusStyle.outlineOffset)).toBeLessThanOrEqual(-2);
		const consentHeader = canvasElement.querySelector(
			'.caseHandoverInlineConsent .messageItem__sendFailedTitle'
		)!;
		const notificationHeader = message.querySelector(
			'.pseudonymCard__headerName'
		)!;
		expect(
			Math.abs(
				consentHeader.getBoundingClientRect().left -
					notificationHeader.getBoundingClientRect().left
			)
		).toBeLessThanOrEqual(1);

		return within(message);
	};
	let choice = await openSetup();
	await openSetup();
	await userEvent.click(
		choice.getByRole('button', { name: /Beides einrichten/ })
	);
	await userEvent.click(
		await page.findByRole('button', { name: 'Schließen' })
	);
	expect(page.queryByRole('textbox')).toBeNull();
	expect(choice.queryByRole('status')).toBeNull();
	await userEvent.click(
		choice.getByRole('button', { name: /Beides einrichten/ })
	);
	await userEvent.type(await page.findByRole('textbox'), 'asker@example.org');
	await userEvent.click(page.getByRole('button', { name: 'Speichern' }));
	await userEvent.click(
		await choice.findByRole('button', { name: 'Browser aktivieren' })
	);
	await waitFor(() =>
		expect(
			choice.getByRole('button', { name: /Beides einrichten/ })
		).toHaveAttribute('aria-pressed', 'true')
	);
	await userEvent.click(
		canvas.getByRole('button', { name: 'Fixture: reload conversation' })
	);
	expect(
		canvas.queryByRole('region', { name: 'Benachrichtigungen einrichten' })
	).toBeNull();
	choice = await openSetup();
	expect(
		choice.getByRole('button', { name: /Beides einrichten/ })
	).toHaveAttribute('aria-pressed', 'true');
	expect(page.queryByRole('textbox')).toBeNull();
};
const regular: Story['play'] = async ({ canvasElement, parameters }) => {
	const canvas = within(canvasElement);
	const page = within(canvasElement.ownerDocument.body);
	const faq = await canvas.findByText('Wer liest meine Nachricht?');
	const channel = parameters.journeyChoice ?? 'EMAIL';
	const label =
		channel === 'BOTH'
			? /Beides einrichten/
			: channel === 'BROWSER'
				? /Geben Sie mir hier ein Signal/
				: /Schreiben Sie mir eine E-Mail/;
	const choice = canvas.getByRole('button', { name: label });
	expect(faq.tagName).toBe('SUMMARY');
	expect(
		faq.compareDocumentPosition(choice) & Node.DOCUMENT_POSITION_FOLLOWING
	).toBeTruthy();
	expect(canvas.queryByRole('button', { name: 'Mehr erfahren' })).toBeNull();
	await userEvent.click(faq);
	await waitFor(() =>
		expect(
			canvas.getByText(
				'Ihre Nachricht lesen ausschließlich die Fachkräfte der zuständigen Beratungsstelle.'
			)
		).toBeVisible()
	);
	await userEvent.click(choice);
	if (channel !== 'BROWSER') {
		await userEvent.type(
			await page.findByRole('textbox'),
			'asker@example.org'
		);
		await userEvent.click(page.getByRole('button', { name: 'Speichern' }));
	}
	if (channel === 'BOTH')
		await userEvent.click(
			await canvas.findByRole('button', { name: 'Browser aktivieren' })
		);
	await waitFor(() => expect(choice).toHaveAttribute('aria-pressed', 'true'));
	await userEvent.click(
		canvas.getByRole('button', { name: 'Fixture: reload conversation' })
	);
	expect(canvas.getByRole('button', { name: label })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await waitFor(() =>
		expect(
			canvas.getByText(
				'Der Inhalt der Beratung steht nie in dieser E-Mail.'
			)
		).toBeVisible()
	);
};
export const ShortcutPhone390: Story = {
	globals: phone390Globals,
	play: shortcut
};
export const ShortcutTablet820: Story = {
	globals: { viewport: { value: 'tablet820', isRotated: false } },
	play: shortcut
};
export const ShortcutDesktop1440: Story = {
	globals: desktop1440Globals,
	play: shortcut
};
export const RegularPhone390: Story = {
	args: { regular: true },
	globals: phone390Globals,
	play: regular
};
export const RegularTablet820: Story = {
	args: { regular: true },
	globals: { viewport: { value: 'tablet820', isRotated: false } },
	play: regular
};
export const RegularDesktop1440: Story = {
	args: { regular: true },
	globals: desktop1440Globals,
	play: regular
};

export const RegularBrowserPhone390: Story = {
	args: { regular: true },
	parameters: { journeyChoice: 'BROWSER' },
	globals: phone390Globals,
	play: regular
};
export const RegularBothTablet820: Story = {
	args: { regular: true },
	parameters: { journeyChoice: 'BOTH' },
	globals: { viewport: { value: 'tablet820', isRotated: false } },
	play: regular
};

export const ShortcutNarrowDesktop360: Story = {
	args: { hostWidth: 360 },
	globals: desktop1440Globals,
	play: shortcut
};
