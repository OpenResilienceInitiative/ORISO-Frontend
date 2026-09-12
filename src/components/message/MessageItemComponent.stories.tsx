import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { ALIAS_MESSAGE_TYPES } from '../../api/apiSendAliasMessage';
import {
	ActiveSessionContext,
	E2EEContext,
	UserDataContext,
	type ExtendedSessionInterface
} from '../../globalState';
import { ConsultantListContext } from '../../globalState/provider/ConsultantListProvider';
import { ServerSettingsContext } from '../../globalState/provider/ServerSettingsProvider';
import type { UserDataInterface } from '../../globalState/interfaces';
import { MessageItemComponent, type MessageItem } from './MessageItemComponent';
import { buildSupervisionTimeline } from '../session/sessionHelpers';
import {
	MOCK_ASKER_MATRIX_ID,
	MOCK_CONSULTANT_MATRIX_ID,
	MOCK_GROUP_MODERATOR_MATRIX_ID,
	mockActiveSession1on1,
	mockActiveSessionGroup,
	mockAppointmentAliasContent,
	mockConsultantListContext,
	mockE2EEContext,
	mockE2eeParams,
	mockLongGermanMessage,
	mockMessageItem,
	mockMessageItemComponentProps,
	mockServerSettingsContext,
	mockCaseHandoverGrantedMessage,
	mockManyReactions,
	mockReactions,
	mockSystemNotificationMessage,
	mockUserData,
	mockVisibilityMessage,
	mockVisibilityMessageForViewer
} from './MessageItemComponent.mocks';
import {
	desktop1440Globals,
	mobileParameters,
	phone390Globals,
	tablet834Globals
} from './messageStoryShell';
import './message.styles.scss';

type MessageItemStoryParameters = {
	activeSession?: ExtendedSessionInterface;
	userData?: UserDataInterface;
};

function MessageItemContextDecorator({
	activeSession,
	userData,
	children,
	compact = false
}: {
	activeSession: ExtendedSessionInterface;
	userData: UserDataInterface;
	children: React.ReactNode;
	compact?: boolean;
}) {
	return (
		<ServerSettingsContext.Provider value={mockServerSettingsContext()}>
			<ConsultantListContext.Provider value={mockConsultantListContext()}>
				<E2EEContext.Provider value={mockE2EEContext()}>
					<UserDataContext.Provider
						value={{
							userData,
							setUserData: () => {},
							reloadUserData: async () => null as any
						}}
					>
						<ActiveSessionContext.Provider
							value={{
								activeSession,
								reloadActiveSession: () => {},
								readActiveSession: () => {}
							}}
						>
							<div
								style={{
									maxWidth: compact ? 390 : 1000,
									padding: compact
										? '16px 12px'
										: '24px 16px',
									background: '#ffffff'
								}}
							>
								{children}
							</div>
						</ActiveSessionContext.Provider>
					</UserDataContext.Provider>
				</E2EEContext.Provider>
			</ConsultantListContext.Provider>
		</ServerSettingsContext.Provider>
	);
}

const baseHandlers = {
	handleDecryptionErrors: () => {},
	handleDecryptionSuccess: () => {},
	e2eeParams: mockE2eeParams()
};

const longMessageArgs = {
	...mockMessageItemComponentProps({
		isMyMessage: false,
		userId: MOCK_ASKER_MATRIX_ID,
		askerMatrixUserId: MOCK_ASKER_MATRIX_ID,
		message: mockLongGermanMessage
	}),
	...baseHandlers
};

/** `.messageItem` enters at scale(0.98). Measuring mid-animation is why
 *  "Long message — expanded — tablet 834" failed in CI: the 700–770 band
 *  accepts 0.98×width, then expand settles at scale(1) and the delta is ~14px.
 *  Desktop's 769–771 band happens to wait this out. Same pin as
 *  CaseHandoverClientCards "Pending client consent". */
const waitForMessageEnterAnimation = async (canvasElement: HTMLElement) => {
	const messageItem =
		canvasElement.querySelector<HTMLElement>('.messageItem');
	expect(messageItem).not.toBeNull();
	await waitFor(() => {
		const style = getComputedStyle(messageItem!);
		expect(style.opacity).toBe('1');
		expect(['none', 'matrix(1, 0, 0, 1, 0, 0)']).toContain(style.transform);
	});
};

const verifyLongMessageState = async ({
	canvasElement,
	expanded,
	minWidth,
	maxWidth
}: {
	canvasElement: HTMLElement;
	expanded: boolean;
	minWidth: number;
	maxWidth: number;
}) => {
	const canvas = within(canvasElement);
	const showMore = await canvas.findByRole('button', {
		name: /^(Mehr anzeigen|Show more)$/
	});
	const bubble = canvasElement.querySelector<HTMLElement>(
		'.messageItem__message--wide'
	);
	expect(bubble).not.toBeNull();

	await waitForMessageEnterAnimation(canvasElement);

	await waitFor(() => {
		const width = bubble!.getBoundingClientRect().width;
		expect(width).toBeGreaterThanOrEqual(minWidth);
		expect(width).toBeLessThanOrEqual(maxWidth);
	});

	if (!expanded) return;

	const collapsedWidth = bubble!.getBoundingClientRect().width;
	await userEvent.click(showMore);
	await canvas.findByRole('button', {
		name: /^(Weniger anzeigen|Show less)$/
	});
	await waitFor(() => {
		expect(
			Math.abs(bubble!.getBoundingClientRect().width - collapsedWidth)
		).toBeLessThanOrEqual(1);
	});
};

const meta = {
	title: 'Components/Chat/MessageItem',
	component: MessageItemComponent,
	tags: ['autodocs'],
	parameters: {
		layout: 'fullscreen',
		activeSession: mockActiveSession1on1(),
		userData: mockUserData(),
		docs: {
			description: {
				component:
					'Chat message row (avatar, bubble, kebab). Production `.messageItem__kebabButton` is a **32×32px** touch zone (Figma Message Menu 772:18407 / issue #564 Android Compact). See `AndroidCompactKebabTouchZone`.'
			}
		}
	},
	args: {
		...mockMessageItemComponentProps(),
		...baseHandlers
	},
	decorators: [
		(Story, { parameters }) => (
			<MessageItemContextDecorator
				activeSession={
					(parameters as MessageItemStoryParameters).activeSession ??
					mockActiveSession1on1()
				}
				userData={
					(parameters as MessageItemStoryParameters).userData ??
					mockUserData()
				}
				compact={Boolean(
					(parameters as { compactShell?: boolean }).compactShell
				)}
			>
				<Story />
			</MessageItemContextDecorator>
		)
	]
} satisfies Meta<typeof MessageItemComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ClientIn1on1Incoming: Story = {
	name: 'Client 1-on-1 incoming (animal avatar)',
	parameters: {
		activeSession: mockActiveSession1on1(),
		userData: mockUserData()
	},
	args: {
		...mockMessageItemComponentProps({
			isMyMessage: false,
			userId: MOCK_ASKER_MATRIX_ID,
			askerMatrixUserId: MOCK_ASKER_MATRIX_ID,
			displayName: 'Sanftes Alpaka Kala',
			username: 'sanftes.alpaka.kala@oriso.invalid'
		}),
		...baseHandlers
	}
};

export const ClientIn1on1Outgoing: Story = {
	name: 'Client 1-on-1 outgoing (animal avatar)',
	parameters: {
		activeSession: mockActiveSession1on1(),
		userData: mockUserData()
	},
	args: {
		...mockMessageItemComponentProps({
			isMyMessage: true,
			userId: MOCK_CONSULTANT_MATRIX_ID,
			displayName: 'Karina P',
			username: 'karina.p@oriso.invalid',
			message:
				'Danke, dass du dich meldest. Lass uns zuerst die nächsten 10 Minuten strukturieren.'
		}),
		...baseHandlers
	}
};

/**
 * Issue #564 / Figma Android Compact: kebab (⋮) touch zone must be 32×32px.
 * Uses the real MessageItemComponent + production `message.styles.scss`.
 */
export const AndroidCompactKebabTouchZone: Story = {
	globals: phone390Globals,
	name: 'Android Compact — kebab 32×32 touch zone',
	parameters: {
		activeSession: mockActiveSession1on1(),
		userData: mockUserData(),
		compactShell: true,
		docs: {
			description: {
				story: 'Incoming + outgoing rows on a compact viewport. Each `.messageItem__kebabButton` must measure **32×32px** (min-width/height + box-sizing from production SCSS).'
			}
		}
	},
	render: () => (
		<div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
			<MessageItemComponent
				{...mockMessageItemComponentProps({
					isMyMessage: false,
					userId: MOCK_ASKER_MATRIX_ID,
					askerMatrixUserId: MOCK_ASKER_MATRIX_ID,
					displayName: 'Sanftes Alpaka Kala',
					username: 'sanftes.alpaka.kala@oriso.invalid',
					message: 'Okay. Ich bin gerade zuhause und kann schreiben.'
				})}
				{...baseHandlers}
			/>
			<MessageItemComponent
				{...mockMessageItemComponentProps({
					isMyMessage: true,
					userId: MOCK_CONSULTANT_MATRIX_ID,
					displayName: 'Beratende Person Kim G.',
					username: 'kim.g@oriso.invalid',
					message:
						'Danke, dass du dich meldest. Lass uns zuerst die nächsten 10 Minuten strukturieren.'
				})}
				{...baseHandlers}
			/>
		</div>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await waitFor(() => {
			const kebabs = canvasElement.querySelectorAll(
				'.messageItem__kebabButton'
			);
			expect(kebabs.length).toBeGreaterThanOrEqual(2);
			kebabs.forEach((button) => {
				const rect = (button as HTMLElement).getBoundingClientRect();
				expect(Math.round(rect.width)).toBe(32);
				expect(Math.round(rect.height)).toBe(32);
				// German is the preview default; keep the assertion readable
				// in either language rather than pinning one.
				expect(button.getAttribute('aria-label')).toMatch(
					/^(More|Weitere Optionen)$/
				);
			});
		});
		// Keep canvas typed usage so Storybook interaction panel stays wired.
		expect(
			canvas.getAllByLabelText(/^(More|Weitere Optionen)$/).length
		).toBeGreaterThanOrEqual(2);
	}
};

export const GroupIncoming: Story = {
	name: 'Group incoming (initials avatar)',
	parameters: {
		activeSession: mockActiveSessionGroup(),
		userData: mockUserData()
	},
	args: {
		...mockMessageItemComponentProps({
			isMyMessage: false,
			userId: MOCK_GROUP_MODERATOR_MATRIX_ID,
			rid: mockActiveSessionGroup().rid,
			displayName: 'Angela K',
			username: 'angela.k@oriso.invalid',
			message:
				'Kurzes Update für das Team: Der Fall bleibt heute bei mir.'
		}),
		...baseHandlers
	}
};

export const GroupOutgoing: Story = {
	name: 'Group outgoing (initials avatar)',
	parameters: {
		activeSession: mockActiveSessionGroup(),
		userData: mockUserData()
	},
	args: {
		...mockMessageItemComponentProps({
			isMyMessage: true,
			userId: MOCK_CONSULTANT_MATRIX_ID,
			rid: mockActiveSessionGroup().rid,
			displayName: 'Karina P',
			username: 'karina.p@oriso.invalid',
			message:
				'Verstanden, ich übernehme die Rückmeldung an die Klientin.'
		}),
		...baseHandlers
	}
};

export const NormalMessage: Story = {
	name: 'Normal text message',
	parameters: {
		activeSession: mockActiveSession1on1(),
		userData: mockUserData()
	},
	args: {
		...mockMessageItemComponentProps({
			isMyMessage: false,
			userId: MOCK_ASKER_MATRIX_ID,
			askerMatrixUserId: MOCK_ASKER_MATRIX_ID
		}),
		...baseHandlers
	}
};

export const SystemNotification: Story = {
	name: 'System notification',
	parameters: {
		activeSession: mockActiveSession1on1(),
		userData: mockUserData()
	},
	args: {
		...mockMessageItemComponentProps({
			isMyMessage: false,
			userId: 'system',
			displayName: 'system',
			username: 'system',
			message: mockSystemNotificationMessage
		}),
		...baseHandlers
	}
};

export const CaseHandoverGranted: Story = {
	name: 'Case handover granted (system card)',
	parameters: {
		activeSession: mockActiveSession1on1(),
		userData: mockUserData()
	},
	args: {
		...mockMessageItemComponentProps({
			isMyMessage: false,
			userId: 'system',
			displayName: 'system',
			username: 'system',
			message: mockCaseHandoverGrantedMessage
		}),
		...baseHandlers
	}
};

export const AppointmentSet: Story = {
	name: 'Appointment set',
	parameters: {
		activeSession: mockActiveSession1on1(),
		userData: mockUserData()
	},
	args: {
		...mockMessageItemComponentProps({
			isMyMessage: false,
			userId: MOCK_CONSULTANT_MATRIX_ID,
			displayName: 'Karina P',
			username: 'karina.p@oriso.invalid',
			message: '',
			alias: {
				messageType: ALIAS_MESSAGE_TYPES.APPOINTMENT_SET,
				content: mockAppointmentAliasContent
			}
		}),
		...baseHandlers
	}
};

export const DeletedMessage: Story = {
	name: 'Deleted message',
	parameters: {
		activeSession: mockActiveSession1on1(),
		userData: mockUserData()
	},
	args: {
		...mockMessageItemComponentProps({
			isMyMessage: false,
			userId: MOCK_ASKER_MATRIX_ID,
			askerMatrixUserId: MOCK_ASKER_MATRIX_ID,
			t: 'rm',
			message: 'Diese Nachricht wurde gelöscht.'
		}),
		...baseHandlers
	}
};

export const LongMessage: Story = {
	name: 'Long message with show more',
	parameters: {
		activeSession: mockActiveSession1on1(),
		userData: mockUserData()
	},
	args: {
		...mockMessageItemComponentProps({
			isMyMessage: false,
			userId: MOCK_ASKER_MATRIX_ID,
			askerMatrixUserId: MOCK_ASKER_MATRIX_ID,
			message: mockLongGermanMessage
		}),
		...baseHandlers
	}
};

export const LongMessageCollapsedMobile390: Story = {
	name: 'Long message — collapsed — mobile 390',
	globals: phone390Globals,
	parameters: {
		activeSession: mockActiveSession1on1(),
		userData: mockUserData(),
		...mobileParameters
	},
	args: longMessageArgs,
	play: ({ canvasElement }) =>
		verifyLongMessageState({
			canvasElement,
			expanded: false,
			minWidth: 280,
			maxWidth: 350
		})
};

export const LongMessageExpandedMobile390: Story = {
	name: 'Long message — expanded — mobile 390',
	globals: phone390Globals,
	parameters: {
		activeSession: mockActiveSession1on1(),
		userData: mockUserData(),
		...mobileParameters
	},
	args: longMessageArgs,
	play: ({ canvasElement }) =>
		verifyLongMessageState({
			canvasElement,
			expanded: true,
			minWidth: 280,
			maxWidth: 350
		})
};

export const LongMessageCollapsedTablet834: Story = {
	name: 'Long message — collapsed — tablet 834',
	globals: tablet834Globals,
	parameters: {
		activeSession: mockActiveSession1on1(),
		userData: mockUserData()
	},
	args: longMessageArgs,
	play: ({ canvasElement }) =>
		verifyLongMessageState({
			canvasElement,
			expanded: false,
			minWidth: 700,
			maxWidth: 770
		})
};

export const LongMessageExpandedTablet834: Story = {
	name: 'Long message — expanded — tablet 834',
	globals: tablet834Globals,
	parameters: {
		activeSession: mockActiveSession1on1(),
		userData: mockUserData()
	},
	args: longMessageArgs,
	play: ({ canvasElement }) =>
		verifyLongMessageState({
			canvasElement,
			expanded: true,
			minWidth: 700,
			maxWidth: 770
		})
};

export const LongMessageCollapsedDesktop1440: Story = {
	name: 'Long message — collapsed — desktop 1440',
	globals: desktop1440Globals,
	parameters: {
		activeSession: mockActiveSession1on1(),
		userData: mockUserData()
	},
	args: longMessageArgs,
	play: ({ canvasElement }) =>
		verifyLongMessageState({
			canvasElement,
			expanded: false,
			minWidth: 769,
			maxWidth: 771
		})
};

export const LongMessageExpandedDesktop1440: Story = {
	name: 'Long message — expanded — desktop 1440',
	globals: desktop1440Globals,
	parameters: {
		activeSession: mockActiveSession1on1(),
		userData: mockUserData()
	},
	args: longMessageArgs,
	play: ({ canvasElement }) =>
		verifyLongMessageState({
			canvasElement,
			expanded: true,
			minWidth: 769,
			maxWidth: 771
		})
};

export const IncomingWithReactions: Story = {
	name: 'Incoming with reactions',
	parameters: {
		activeSession: mockActiveSession1on1(),
		userData: mockUserData()
	},
	args: {
		...mockMessageItemComponentProps({
			isMyMessage: false,
			userId: MOCK_ASKER_MATRIX_ID,
			askerMatrixUserId: MOCK_ASKER_MATRIX_ID,
			displayName: 'Sanftes Alpaka Kala',
			username: 'sanftes.alpaka.kala@oriso.invalid'
		}),
		reactions: mockReactions(),
		onReact: () => {},
		onUnreact: () => {},
		...baseHandlers
	}
};

export const OutgoingWithReactions: Story = {
	name: 'Outgoing with reactions (delivered)',
	parameters: {
		activeSession: mockActiveSession1on1(),
		userData: mockUserData()
	},
	args: {
		...mockMessageItemComponentProps({
			isMyMessage: true,
			userId: MOCK_CONSULTANT_MATRIX_ID,
			displayName: 'Karina P',
			username: 'karina.p@oriso.invalid',
			isNotRead: true,
			message:
				'Danke für deine Offenheit. Wir schauen uns das morgen gemeinsam an.'
		}),
		reactions: mockReactions(),
		onReact: () => {},
		onUnreact: () => {},
		...baseHandlers
	}
};

async function assertReactionRailScrollsHorizontally(
	canvasElement: HTMLElement
) {
	await waitFor(() => {
		const rail = canvasElement.querySelector(
			'.messageItem__reactions'
		) as HTMLElement | null;
		expect(rail).toBeTruthy();
		const pills = Array.from(
			rail!.querySelectorAll('.messageItem__reactionPill')
		) as HTMLElement[];
		expect(pills.length).toBeGreaterThan(3);

		// Single row: every pill shares the same top edge (no vertical stack).
		const firstTop = pills[0].offsetTop;
		pills.forEach((pill) => {
			expect(pill.offsetTop).toBe(firstTop);
			expect(getComputedStyle(pill).flexShrink).toBe('0');
		});

		const style = getComputedStyle(rail!);
		expect(style.flexWrap).toBe('nowrap');
		expect(style.overflowX).toMatch(/auto|scroll/);
		expect(style.overflowY).toBe('hidden');
		// Overflow content must be wider than the visible rail (scrollable).
		expect(rail!.scrollWidth).toBeGreaterThan(rail!.clientWidth);
	});
}

export const OutgoingWithManyReactions: Story = {
	name: 'Outgoing with many reactions (horizontal scroll)',
	parameters: {
		activeSession: mockActiveSession1on1(),
		userData: mockUserData(),
		// Narrow shell so the chip rail overflows and must scroll (#564).
		compactShell: true,
		docs: {
			description: {
				story: 'Many reaction chips stay on one row and scroll horizontally (`overflow-x: auto`) instead of wrapping.'
			}
		}
	},
	args: {
		...mockMessageItemComponentProps({
			isMyMessage: true,
			userId: MOCK_CONSULTANT_MATRIX_ID,
			displayName: 'Karina P',
			username: 'karina.p@oriso.invalid',
			isNotRead: true,
			message: 'Viele Reaktionen: die Chip-Leiste scrollt horizontal.'
		}),
		reactions: mockManyReactions(),
		onReact: () => {},
		onUnreact: () => {},
		...baseHandlers
	},
	play: async ({ canvasElement }) => {
		await assertReactionRailScrollsHorizontally(canvasElement);
	}
};

export const IncomingWithManyReactions: Story = {
	name: 'Incoming with many reactions (horizontal scroll)',
	parameters: {
		activeSession: mockActiveSession1on1(),
		userData: mockUserData(),
		compactShell: true,
		docs: {
			description: {
				story: 'Many reaction chips stay on one row and scroll horizontally (`overflow-x: auto`) instead of wrapping.'
			}
		}
	},
	args: {
		...mockMessageItemComponentProps({
			isMyMessage: false,
			userId: MOCK_ASKER_MATRIX_ID,
			askerMatrixUserId: MOCK_ASKER_MATRIX_ID,
			displayName: 'Sanftes Alpaka Kala',
			username: 'sanftes.alpaka.kala@oriso.invalid'
		}),
		reactions: mockManyReactions(),
		onReact: () => {},
		onUnreact: () => {},
		...baseHandlers
	},
	play: async ({ canvasElement }) => {
		await assertReactionRailScrollsHorizontally(canvasElement);
	}
};

export const OutgoingDelivered: Story = {
	name: 'Outgoing delivered (single checkmark)',
	parameters: {
		activeSession: mockActiveSession1on1(),
		userData: mockUserData()
	},
	args: {
		...mockMessageItemComponentProps({
			isMyMessage: true,
			userId: MOCK_CONSULTANT_MATRIX_ID,
			displayName: 'Karina P',
			username: 'karina.p@oriso.invalid',
			isNotRead: true,
			message: 'Diese Nachricht ist zugestellt, aber noch nicht gelesen.'
		}),
		onReact: () => {},
		...baseHandlers
	}
};

export const OutgoingRead: Story = {
	name: 'Outgoing read (double checkmark)',
	parameters: {
		activeSession: mockActiveSession1on1(),
		userData: mockUserData()
	},
	args: {
		...mockMessageItemComponentProps({
			isMyMessage: true,
			userId: MOCK_CONSULTANT_MATRIX_ID,
			displayName: 'Karina P',
			username: 'karina.p@oriso.invalid',
			isNotRead: false,
			message: 'Diese Nachricht wurde bereits gelesen.'
		}),
		onReact: () => {},
		...baseHandlers
	}
};

export const OutgoingSendFailed: Story = {
	name: 'Outgoing send failed (cross)',
	parameters: {
		activeSession: mockActiveSession1on1(),
		userData: mockUserData()
	},
	args: {
		...mockMessageItemComponentProps({
			isMyMessage: true,
			userId: MOCK_CONSULTANT_MATRIX_ID,
			displayName: 'Karina P',
			username: 'karina.p@oriso.invalid',
			isNotRead: true,
			message: 'Diese Nachricht hat den Server nicht erreicht.'
		}),
		sendFailed: true,
		onReact: () => {},
		...baseHandlers
	}
};

export const IncomingEncryptionBroke: Story = {
	name: 'Incoming encryption broke (cross)',
	parameters: {
		activeSession: mockActiveSession1on1(),
		userData: mockUserData()
	},
	args: {
		...mockMessageItemComponentProps({
			isMyMessage: false,
			userId: MOCK_CONSULTANT_MATRIX_ID,
			displayName: 'Leila Pavlov',
			username: 'leila.p@oriso.invalid',
			isNotRead: true,
			message: 'Diese Nachricht konnte nicht entschlüsselt werden.'
		}),
		// Incoming message whose Megolm decryption failed: the red cross shows
		// on the received message (not own-message-only), labelled
		// "Verschlüsselung gebrochen".
		encryptionBroke: true,
		onReact: () => {},
		...baseHandlers
	}
};

export const WideLongMessageDesktop: Story = {
	name: 'Long text widens bubble (desktop 770px)',
	parameters: {
		activeSession: mockActiveSession1on1(),
		userData: mockUserData()
	},
	args: {
		...mockMessageItemComponentProps({
			isMyMessage: false,
			userId: MOCK_ASKER_MATRIX_ID,
			askerMatrixUserId: MOCK_ASKER_MATRIX_ID,
			message:
				'Hier ist das folgende Problem mit der Länge der Chatnachrichten: Oft sind die natürlich wie in einem Chat nicht so lang, weil sie eine direkte Unterhaltung sind. Manchmal sind das aber riesige Textbrocken, und da wäre auf dem Desktop besser, wenn die eher die breite Variante nutzen, damit die Zeilen nicht endlos umbrechen und der Text gut lesbar bleibt.'
		}),
		...baseHandlers
	}
};

export const OutgoingWithVisibility: Story = {
	name: 'Outgoing with visibility chip',
	parameters: {
		activeSession: mockActiveSession1on1(),
		userData: mockUserData()
	},
	args: {
		...mockMessageItemComponentProps({
			isMyMessage: true,
			userId: MOCK_CONSULTANT_MATRIX_ID,
			displayName: 'Karina P',
			username: 'karina.p@oriso.invalid',
			message: mockVisibilityMessage
		}),
		...baseHandlers
	}
};

export const GroupMessageEveryoneNoChip: Story = {
	name: 'Group message everyone can see — NO visibility chip',
	parameters: {
		activeSession: mockActiveSessionGroup(),
		userData: mockUserData(),
		docs: {
			description: {
				story: 'Regression pin for ORISO-Frontend#892. A group message with no recipient restriction addresses everyone, so the chip must **not** render. Before the fix it showed "visible only to: Alle" — a restriction chip claiming there is no restriction.'
			}
		}
	},
	args: {
		...mockMessageItemComponentProps({
			isMyMessage: false,
			userId: MOCK_GROUP_MODERATOR_MATRIX_ID,
			displayName: 'Angela K',
			username: 'angela.k@oriso.invalid',
			message:
				'Kurzes Update für das Team: Der Fall bleibt heute bei mir.'
		}),
		...baseHandlers
	}
};

export const GroupMessageRestrictedShowsChip: Story = {
	name: 'Group message restricted — chip IS shown',
	parameters: {
		activeSession: mockActiveSessionGroup(),
		userData: mockUserData(),
		docs: {
			description: {
				story: 'The other half of the pin: when the message really is limited to some participants, the chip must still appear. Guards against the #892 fix hiding the chip everywhere.\n\nThe recipient list names the viewer ("Karina P" from `mockUserData`) on purpose. A restricted message addressed to *other* people is hidden from the viewer entirely — `MessageItemComponent` returns `null` — so a story built on that fixture would render an empty frame and pin nothing.'
			}
		}
	},
	args: {
		...mockMessageItemComponentProps({
			isMyMessage: false,
			userId: MOCK_GROUP_MODERATOR_MATRIX_ID,
			displayName: 'Angela K',
			username: 'angela.k@oriso.invalid',
			message: mockVisibilityMessageForViewer
		}),
		...baseHandlers
	}
};

/**
 * Figma "Message Menu" (666:25242): the open kebab is a 28×32 red pill with
 * **white** dots, and the menu lists "Reply directly" first.
 *
 * Pins the regression Frank reported: `.messageItem__kebabButton svg` forced
 * 20×20 and `path, circle { fill: #17191c }` applied to *every* glyph, so
 * opening the menu shrank the pill and painted its white dots near-black.
 */
export const KebabActiveState: Story = {
	name: 'Kebab open — red pill, white dots (Figma 666:25242)',
	parameters: {
		activeSession: mockActiveSession1on1(),
		userData: mockUserData(),
		docs: {
			description: {
				story: 'Click the ⋮ and the trigger must stay a 28×32 red pill with white dots. Also the only story that wires `onReplyDirect`, so "Reply directly" is actually rendered.'
			}
		}
	},
	args: {
		...mockMessageItemComponentProps({
			isMyMessage: false,
			userId: MOCK_ASKER_MATRIX_ID,
			askerMatrixUserId: MOCK_ASKER_MATRIX_ID,
			displayName: 'Sanftes Alpaka Kala',
			username: 'sanftes.alpaka.kala@oriso.invalid',
			message: 'Okay. Ich bin gerade zuhause und kann schreiben.'
		}),
		onReact: () => {},
		onUnreact: () => {},
		onReplyDirect: () => {},
		...baseHandlers
	},
	play: async ({ canvasElement }) => {
		const kebab = canvasElement.querySelector(
			'.messageItem__kebabButton'
		) as HTMLElement;
		expect(kebab).toBeTruthy();
		kebab.click();

		await waitFor(() => {
			const active = canvasElement.querySelector(
				'.messageItem__kebabIconActive'
			) as SVGElement;
			expect(active).toBeTruthy();

			const rect = active.getBoundingClientRect();
			expect(Math.round(rect.width)).toBe(28);
			expect(Math.round(rect.height)).toBe(32);

			// The dots must stay white — this is the exact bit the blanket
			// `path { fill: #17191c }` used to clobber.
			const dots = active.querySelectorAll('path[fill="white"]');
			expect(dots.length).toBeGreaterThan(0);
			dots.forEach((dot) => {
				expect(getComputedStyle(dot).fill).toBe('rgb(255, 255, 255)');
			});
		});

		await waitFor(() => {
			const menu = document.querySelector(
				'.messageItem__actionMenu'
			) as HTMLElement;
			expect(menu).toBeTruthy();
			expect(getComputedStyle(menu).backgroundColor).toBe(
				'rgb(255, 255, 255)'
			);
			expect(menu.textContent).toMatch(/Reply directly|Direkt antworten/);
		});
	}
};

/**
 * Same pins as `KebabActiveState`, but for the **outgoing** side: the kebab
 * lives in the right side column (`--right`) and the menu is positioned from
 * the other edge, so the fix has to hold there independently.
 */
export const KebabActiveStateOutgoing: Story = {
	name: 'Kebab open — outgoing side (Figma 666:25242)',
	parameters: {
		activeSession: mockActiveSession1on1(),
		userData: mockUserData(),
		docs: {
			description: {
				story: 'Outgoing counterpart of the incoming kebab pin. Also asserts the full emoji picker renders **above** the action menu that opened it.'
			}
		}
	},
	args: {
		...mockMessageItemComponentProps({
			isMyMessage: true,
			userId: MOCK_CONSULTANT_MATRIX_ID,
			displayName: 'Karina P',
			username: 'karina.p@oriso.invalid',
			message:
				'Danke, dass du dich meldest. Lass uns zuerst die nächsten 10 Minuten strukturieren.'
		}),
		onReact: () => {},
		onUnreact: () => {},
		onReplyDirect: () => {},
		...baseHandlers
	},
	play: async ({ canvasElement }) => {
		const kebab = canvasElement.querySelector(
			'.messageItem__kebabButton--right'
		) as HTMLElement;
		expect(kebab).toBeTruthy();
		kebab.click();

		await waitFor(() => {
			const active = canvasElement.querySelector(
				'.messageItem__kebabIconActive'
			) as SVGElement;
			expect(active).toBeTruthy();

			const rect = active.getBoundingClientRect();
			expect(Math.round(rect.width)).toBe(28);
			expect(Math.round(rect.height)).toBe(32);

			const dots = active.querySelectorAll('path[fill="white"]');
			expect(dots.length).toBeGreaterThan(0);
			dots.forEach((dot) => {
				expect(getComputedStyle(dot).fill).toBe('rgb(255, 255, 255)');
			});
		});

		const menu = await waitFor(() => {
			const found = document.querySelector(
				'.messageItem__actionMenu'
			) as HTMLElement;
			expect(found).toBeTruthy();
			return found;
		});
		expect(menu.textContent).toMatch(/Reply directly|Direkt antworten/);

		// The menu must stay inside the viewport on this side too — it is
		// positioned from the right edge, so a wrong clamp pushes it off-screen.
		const menuRect = menu.getBoundingClientRect();
		expect(menuRect.left).toBeGreaterThanOrEqual(0);
		expect(menuRect.right).toBeLessThanOrEqual(window.innerWidth);

		// The picker the quick row opens has to sit ON TOP of that menu.
		const more = menu.querySelector(
			'.messageItem__actionMenuReactionMore'
		) as HTMLElement;
		expect(more).toBeTruthy();
		more.click();

		await waitFor(() => {
			const picker = document.querySelector(
				'[data-testid="emoji-picker-popup"]'
			) as HTMLElement;
			expect(picker).toBeTruthy();
			expect(Number(getComputedStyle(picker).zIndex)).toBeGreaterThan(
				Number(menu.style.zIndex)
			);

			// …and beside the menu, not over its entries.
			const pickerRect = picker.getBoundingClientRect();
			const menuRect2 = menu.getBoundingClientRect();
			const overlaps = !(
				pickerRect.right <= menuRect2.left ||
				pickerRect.left >= menuRect2.right ||
				pickerRect.bottom <= menuRect2.top ||
				pickerRect.top >= menuRect2.bottom
			);
			expect(overlaps).toBe(false);
			expect(pickerRect.left).toBeGreaterThanOrEqual(0);
			expect(pickerRect.right).toBeLessThanOrEqual(window.innerWidth);
		});
	}
};

/**
 * #1081: the action menu must follow its message. It used to be positioned once
 * at open time and frozen there, so scrolling the conversation left it pointing
 * at a different message — and the next click applied "Reply directly" or
 * "Delete Message" to something the counsellor was no longer looking at.
 *
 * Renders inside a short scroll container so the story can actually scroll.
 */
export const KebabMenuFollowsScroll: Story = {
	name: 'Kebab open — menu follows the message on scroll (#1081)',
	parameters: {
		activeSession: mockActiveSession1on1(),
		userData: mockUserData(),
		docs: {
			description: {
				story: 'Open the ⋮ and scroll the container: the menu keeps the same offset to its message instead of staying put.'
			}
		}
	},
	args: {
		...mockMessageItemComponentProps({
			isMyMessage: false,
			userId: MOCK_ASKER_MATRIX_ID,
			askerMatrixUserId: MOCK_ASKER_MATRIX_ID,
			displayName: 'Sanftes Alpaka Kala',
			username: 'sanftes.alpaka.kala@oriso.invalid',
			message: 'Okay. Ich bin gerade zuhause und kann schreiben.'
		}),
		onReact: () => {},
		onUnreact: () => {},
		onReplyDirect: () => {},
		...baseHandlers
	},
	decorators: [
		(Story) => (
			<div
				data-testid="scroll-container"
				style={{ height: 260, overflowY: 'auto' }}
			>
				<div style={{ height: 200 }} />
				<Story />
				<div style={{ height: 600 }} />
			</div>
		)
	],
	play: async ({ canvasElement }) => {
		const kebab = canvasElement.querySelector(
			'.messageItem__kebabButton'
		) as HTMLElement;
		expect(kebab).toBeTruthy();
		kebab.click();

		const menu = await waitFor(() => {
			const found = document.querySelector(
				'.messageItem__actionMenu'
			) as HTMLElement;
			expect(found).toBeTruthy();
			// Wait for floating-ui to place it, not the off-screen default.
			expect(found.getBoundingClientRect().top).toBeGreaterThan(-1000);
			return found;
		});

		const offsetBefore =
			menu.getBoundingClientRect().top -
			kebab.getBoundingClientRect().top;

		const kebabTopBefore = kebab.getBoundingClientRect().top;
		const scroller = canvasElement.querySelector(
			'[data-testid="scroll-container"]'
		) as HTMLElement;
		scroller.scrollTop = 120;
		scroller.dispatchEvent(new Event('scroll'));

		await waitFor(() => {
			// Guard against a vacuous pass: if the container did not actually
			// scroll, "the offset is unchanged" is true for the wrong reason.
			expect(
				kebabTopBefore - kebab.getBoundingClientRect().top
			).toBeGreaterThan(100);

			const offsetAfter =
				menu.getBoundingClientRect().top -
				kebab.getBoundingClientRect().top;
			// The menu tracks the trigger: their distance is unchanged.
			expect(Math.abs(offsetAfter - offsetBefore)).toBeLessThan(2);
		});

		// And it is still inside the viewport after the scroll.
		const rect = menu.getBoundingClientRect();
		expect(rect.left).toBeGreaterThanOrEqual(0);
		expect(rect.right).toBeLessThanOrEqual(window.innerWidth);
	}
};

/**
 * T21: the thread entry under a root message — reply count and
 * "Author: last reply…" on one line — opens the thread.
 */
export const ThreadEntryWithLastReply: Story = {
	name: 'Thread entry — replies + "Author: last reply…" (T21)',
	parameters: {
		activeSession: mockActiveSession1on1(),
		userData: mockUserData()
	},
	args: {
		...mockMessageItemComponentProps({
			isMyMessage: false,
			userId: MOCK_ASKER_MATRIX_ID,
			askerMatrixUserId: MOCK_ASKER_MATRIX_ID,
			displayName: 'Sanftes Alpaka Kala',
			username: 'sanftes.alpaka.kala@oriso.invalid',
			message:
				'Es sind ein paar Briefe gekommen, die ich nicht aufgemacht habe. Mahnbescheide, glaube ich.'
		}),
		...baseHandlers,
		renderMode: 'main',
		threadsEnabled: true,
		threadSummary: {
			replyCount: 2,
			lastReplyText:
				'Sanftes Alpaka Kala: Okay. Vielleicht nächste Woche, wenn ich weiß, wie es mit dem Vertrag weitergeht.'
		},
		onOpenThread: fn()
	},
	play: async ({ canvasElement, args }) => {
		const entry = await waitFor(() => {
			const element = canvasElement.querySelector<HTMLButtonElement>(
				'[data-cy="thread-entry"]'
			);
			expect(element).not.toBeNull();
			return element!;
		});
		await expect(entry.textContent).toContain('2 Antworten');
		const preview = entry.querySelector<HTMLElement>(
			'[data-cy="thread-entry-preview"]'
		)!;
		await expect(preview.textContent).toContain('Sanftes Alpaka Kala:');
		// One line, ellipsis — never a second line (D1: the entry follows
		// the chat text scale, label/medium 12/16 — one line-height plus rounding).
		await expect(
			preview.getBoundingClientRect().height
		).toBeLessThanOrEqual(
			Number.parseFloat(getComputedStyle(preview).lineHeight) + 2
		);
		await expect(getComputedStyle(preview).textOverflow).toBe('ellipsis');
		await userEvent.click(entry);
		await expect(args.onOpenThread).toHaveBeenCalledTimes(1);
	}
};

/* ---------------------------------------------------------------------------
 * T49 — the supervision side room's system notice.
 *
 * The notice is not a message someone wrote: `buildSupervisionTimeline`
 * (session/sessionHelpers.ts) builds it in the frontend and prepends it to the
 * side room's timeline. Its `[SYSTEM_NOTIFICATION]` payload carries
 * `type: 'SUPERVISION_NOTICE'`, and that type is what makes
 * `MessageItemComponent` return the **Carimat organism** (`ErstantwortSequence`
 * → `pseudonymCard`) instead of the generic system-notification chrome.
 *
 * That was the promise in T49, and until now it could only be seen two levels
 * up — in `Components/Session/SidePanel` "first visit, empty side room" and in
 * the stage story "(a2)". Here it stands at the block that actually renders it.
 *
 * The fixtures come from `buildSupervisionTimeline` itself rather than a
 * hand-written payload, so a change to the builder shows up here instead of
 * quietly passing against a copy of what it used to emit.
 * ------------------------------------------------------------------------- */

const SUPERVISION_ROOM_ID = '!storybook-supervision:oriso.org';
const SUPERVISION_NOTICE_TITLE = 'Supervision';
const SUPERVISION_NOTICE_TEXT =
	'Supervision durch Angela K. ist aktiv. Eine andere Supervisorin oder einen anderen Supervisor können Sie über das Plus neben dem Mail-Symbol anfragen.';

const buildSupervisionNoticeTimeline = (messages: MessageItem[] = []) =>
	buildSupervisionTimeline(messages, {
		roomId: SUPERVISION_ROOM_ID,
		title: SUPERVISION_NOTICE_TITLE,
		description: SUPERVISION_NOTICE_TEXT,
		askerMatrixUserId: MOCK_ASKER_MATRIX_ID
	});

/** One counsellor line under the notice — the side room's first real message. */
const supervisionFirstMessage = (): MessageItem =>
	mockMessageItem({
		_id: 'supervision-msg-1',
		rid: SUPERVISION_ROOM_ID,
		userId: MOCK_CONSULTANT_MATRIX_ID,
		displayName: 'Beratende Person Kim G.',
		username: 'kim.g@oriso.invalid',
		message:
			'Ich komme beim Thema Mahnbescheide nicht weiter und hätte gern einen zweiten Blick darauf.',
		messageDate: { str: 'Heute', date: null }
	});

const renderSupervisionTimeline = (items: MessageItem[]) => (
	<div style={{ display: 'flex', flexDirection: 'column' }}>
		{items.map((item) => (
			<MessageItemComponent
				key={item._id}
				{...mockMessageItemComponentProps(item)}
				{...baseHandlers}
			/>
		))}
	</div>
);

/**
 * The whole point of T49, asserted rather than eyeballed: the notice is drawn
 * with the Carimat organism and carries **none** of the generic system chrome.
 *
 * Every negative check is scoped to the notice's own subtree — in the story
 * where a real message sits below it, a kebab and a bubble legitimately exist
 * on that message, and an unscoped `querySelector` would pass for the wrong
 * reason (or fail for one).
 */
const expectCarimatNoticeStructure = async (canvasElement: HTMLElement) => {
	const notice = await waitFor(() => {
		const element = canvasElement.querySelector<HTMLElement>(
			'.messageItem--supervisionNotice'
		);
		expect(element).not.toBeNull();
		return element!;
	});

	// Carimat structure: the staged sequence and its pseudonym card.
	expect(
		notice.querySelector('[data-testid="erstantwort-sequence"]')
	).not.toBeNull();
	expect(notice.querySelector('.pseudonymCard')).not.toBeNull();
	expect(notice.querySelector('.pseudonymCard__avatarFrame')).not.toBeNull();
	expect(
		notice.querySelector<HTMLElement>('.pseudonymCard__headerName')
			?.textContent
	).toBe(SUPERVISION_NOTICE_TITLE);
	expect(
		notice.querySelector<HTMLElement>('.pseudonymCard__headerSubtitle')
			?.textContent
	).toMatch(/^(Systembenachrichtigung|System Notification)$/);
	expect(
		notice.querySelector<HTMLElement>('.pseudonymCard__bubbleText')
			?.textContent
	).toBe(SUPERVISION_NOTICE_TEXT);

	// No generic system-notification chrome: no kebab, no notification bubble
	// class, no bot avatar, no two-line notification header.
	expect(notice.querySelector('.messageItem__kebabButton')).toBeNull();
	expect(
		notice.querySelector('.messageItem__message--systemNotification')
	).toBeNull();
	expect(notice.querySelector('.messageItem__avatar--bot')).toBeNull();
	expect(notice.querySelector('.messageItem__botAvatarIcon')).toBeNull();
	expect(
		notice.querySelector('.messageItem__systemNotificationHeaderText')
	).toBeNull();
	expect(
		notice.querySelector('.messageItem__systemNotificationDescription')
	).toBeNull();

	return notice;
};

export const SupervisionNotice: Story = {
	name: 'Supervision notice — Carimat organism, no system chrome (T49)',
	parameters: {
		activeSession: mockActiveSession1on1(),
		userData: mockUserData(),
		docs: {
			description: {
				story: 'The side room notice `SUPERVISION_NOTICE`, rendered by `MessageItemComponent` as the **Carimat** sequence (`ErstantwortSequence` → `pseudonymCard`) under the room name — never with the generic system-notification chrome (kebab, bot avatar, `messageItem__message--systemNotification`).'
			}
		}
	},
	args: {
		...mockMessageItemComponentProps(
			buildSupervisionNoticeTimeline([supervisionFirstMessage()])[0]
		),
		...baseHandlers
	},
	play: async ({ canvasElement }) => {
		const notice = await expectCarimatNoticeStructure(canvasElement);
		// The day pill moves onto the notice when the room already has history.
		expect(notice.querySelector('.messageDateDivider')).not.toBeNull();
	}
};

export const SupervisionNoticeAboveMessage: Story = {
	name: 'Supervision notice — above the first real message (T49)',
	parameters: {
		activeSession: mockActiveSession1on1(),
		userData: mockUserData(),
		docs: {
			description: {
				story: 'Notice plus the counsellor line beneath it. The day pill sits on the notice and the message below gives its own up, so the same day is never drawn twice — and the message keeps its ordinary chrome (kebab, bubble) while the notice keeps none of it.'
			}
		}
	},
	render: () =>
		renderSupervisionTimeline(
			buildSupervisionNoticeTimeline([supervisionFirstMessage()])
		),
	play: async ({ canvasElement }) => {
		await expectCarimatNoticeStructure(canvasElement);

		const rows = canvasElement.querySelectorAll(
			'.messageItem:not(.pseudonymCard)'
		);
		expect(rows.length).toBe(2);
		expect(rows[0].classList).toContain('messageItem--supervisionNotice');

		// Exactly one day pill in the pair, and it belongs to the notice.
		expect(
			canvasElement.querySelectorAll('.messageDateDivider').length
		).toBe(1);
		expect(rows[0].querySelector('.messageDateDivider')).not.toBeNull();

		// The ordinary message below is untouched — it still has its kebab,
		// which is what makes the notice's missing one meaningful.
		await waitFor(() =>
			expect(
				rows[1].querySelector('.messageItem__kebabButton')
			).not.toBeNull()
		);
	}
};

export const SupervisionNoticeEmptyRoom: Story = {
	name: 'Supervision notice — empty side room, no day pill (T49)',
	parameters: {
		activeSession: mockActiveSession1on1(),
		userData: mockUserData(),
		docs: {
			description: {
				story: 'What a freshly assigned standing supervisor sees before anyone has written. N-2: `buildSupervisionTimeline` sets an explicit empty `PrettyDate` here — the earlier version cloned `list[0]`, left `messageDate` undefined on an empty room and crashed the timeline.'
			}
		}
	},
	args: {
		...mockMessageItemComponentProps(buildSupervisionNoticeTimeline()[0]),
		...baseHandlers
	},
	play: async ({ canvasElement }) => {
		const notice = await expectCarimatNoticeStructure(canvasElement);
		// No history, so no day pill — and no crash on the empty date.
		expect(notice.querySelector('.messageDateDivider')).toBeNull();
		expect(
			canvasElement.querySelectorAll('.messageItem:not(.pseudonymCard)')
				.length
		).toBe(1);
	}
};

export const SupervisionNoticeMobile390: Story = {
	name: 'Supervision notice — phone 390 (T49)',
	globals: phone390Globals,
	parameters: {
		activeSession: mockActiveSession1on1(),
		userData: mockUserData(),
		...mobileParameters,
		docs: {
			description: {
				story: 'The notice at 390px, where the side room is a full-width sheet. The card and its text stay inside the column — the notice is the first thing in that room, so a horizontal overflow here would be the first thing anyone sees.'
			}
		}
	},
	args: {
		...mockMessageItemComponentProps(
			buildSupervisionNoticeTimeline([supervisionFirstMessage()])[0]
		),
		...baseHandlers
	},
	play: async ({ canvasElement }) => {
		const notice = await expectCarimatNoticeStructure(canvasElement);
		const card = notice.querySelector<HTMLElement>('.pseudonymCard')!;
		const shell = notice.parentElement!;
		await waitFor(() => {
			expect(card.getBoundingClientRect().width).toBeGreaterThan(0);
			expect(card.getBoundingClientRect().right).toBeLessThanOrEqual(
				shell.getBoundingClientRect().right + 1
			);
		});
	}
};
