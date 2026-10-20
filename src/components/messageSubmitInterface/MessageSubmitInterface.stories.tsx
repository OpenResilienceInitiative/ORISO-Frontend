import * as React from 'react';
import { StrictMode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { MessageSubmitInterfaceComponent } from './messageSubmitInterfaceComponent';
import {
	buildMockActiveSession,
	buildMockGroupSession,
	ComposerStoryDecorator,
	mockComposerAskerData,
	storybookGroupRoomMembers
} from './__storybook__/composerStoryDecorator';
import './messageSubmitInterface.styles.scss';
import '../session/session.styles.scss';
import { focusSessionChromeOnPointerDown } from '../session/focusSessionChrome';
import {
	phone390Globals,
	desktop1440Globals,
	tablet834Globals
} from '../message/messageStoryShell';

const INPUT_FIELD_FIGMA_URL =
	'https://www.figma.com/design/L2mOFNSGdxPPx1XA4HFAog/App.Oriso?node-id=18-1989';

const shellStyle: React.CSSProperties = {
	background: '#eae7e8',
	// Tall enough that the docked toolbar menus (which open upward, like in
	// the app where the composer sits at the bottom of the screen) stay
	// visible inside the story canvas.
	minHeight: 560,
	padding: 24,
	position: 'relative',
	boxSizing: 'border-box',
	display: 'flex',
	flexDirection: 'column',
	justifyContent: 'flex-end',
	// Story layout only — `.session` supplies resting/active borders (#597)
	margin: 0,
	borderRadius: 28,
	overflow: 'hidden'
};

function ComposerShell({
	activeSession,
	roomMembers,
	userData,
	shellHeight,
	productionSessionFade = false,
	...composerProps
}: {
	activeSession?: any;
	roomMembers?: Array<{ userId: string; name: string }>;
	userData?: any;
	/**
	 * T41: the composer never grows past its host minus
	 * `MIN_TIMELINE_VISIBLE`, so a story about growth has to stand in a card
	 * as tall as a real one (852 px at a 900 px window).
	 */
	shellHeight?: number;
	/** Match SessionItemComponent's real transformed reveal ancestor. */
	productionSessionFade?: boolean;
} & Partial<React.ComponentProps<typeof MessageSubmitInterfaceComponent>>) {
	const composer = (
		<ComposerStoryDecorator
			activeSession={activeSession}
			roomMembers={roomMembers}
			userData={userData}
		>
			<MessageSubmitInterfaceComponent
				placeholder="Nachricht an Klient:in schreiben"
				onSendButton={() => {}}
				isTyping={() => {}}
				language="de"
				{...composerProps}
			/>
		</ComposerStoryDecorator>
	);
	return (
		<div
			className="session"
			tabIndex={-1}
			onMouseDown={focusSessionChromeOnPointerDown}
			style={
				shellHeight
					? { ...shellStyle, minHeight: shellHeight }
					: shellStyle
			}
		>
			{productionSessionFade ? (
				<div className="session__gameInputFadeTarget session__gameInputFadeTarget--reveal">
					{composer}
				</div>
			) : (
				composer
			)}
		</div>
	);
}

const meta = {
	title: 'Components/Message/MessageSubmitInterface',
	tags: ['autodocs'],
	parameters: {
		layout: 'fullscreen',
		backgrounds: { default: 'gray' },
		design: [
			{
				type: 'figma',
				name: 'Input Field (Organism)',
				url: INPUT_FIELD_FIGMA_URL
			}
		],
		docs: {
			description: {
				component:
					'The REAL chat composer (`MessageSubmitInterfaceComponent`) mounted with mocked session/user/transport contexts. ' +
					'Every state shown here is produced by the production component — no visual mocks. ' +
					'Interactions (typing, toolbar, send states) behave exactly as in the app layer.'
			}
		}
	}
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** Assert the public composer-to-session bottom spacing contract in CSS pixels. */
async function expectComposerBottomInset(
	canvasElement: HTMLElement,
	expectedInset: number
) {
	await waitFor(() => {
		const session = canvasElement.querySelector<HTMLElement>('.session');
		const composerCard = canvasElement.querySelector<HTMLElement>(
			'.textarea__wrapper-send-message'
		);
		if (!session || !composerCard) {
			throw new Error('composer layout not mounted yet');
		}

		const sessionInnerBottom =
			session.getBoundingClientRect().bottom -
			Number.parseFloat(
				getComputedStyle(session).borderBottomWidth || '0'
			);
		const composerBottom = composerCard.getBoundingClientRect().bottom;

		expect(Math.round(sessionInnerBottom - composerBottom)).toBe(
			expectedInset
		);
	});
}

/**
 * The absence banner an advice seeker sees when their counsellor is away.
 *
 * It renders inside the composer wrapper, above the card. The composer card used
 * to be `position: absolute; bottom: 0` with an opaque background; that removed
 * it from flow so the wrapper didn’t reserve room for the banner and the card
 * painted over it, making the notice invisible while still present in the DOM.
 */
export const ConsultantAbsent: Story = {
	name: 'Asker — counsellor is absent',
	render: () => (
		<ComposerShell
			userData={mockComposerAskerData}
			activeSession={buildMockActiveSession({
				consultant: {
					consultantId: 'consultant-storybook',
					username: 'shaziaknew',
					displayName: 'shazia ka',
					absent: true,
					absenceMessage:
						'I am out of office, please contact me later'
				}
			})}
			placeholder="Schreiben Sie uns, was Sie bewegt."
		/>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const banner = await canvas.findByText(
			'I am out of office, please contact me later'
		);

		// Present in the DOM is not enough — that was true throughout the bug.
		// Assert it is actually on screen and not painted over by the card.
		await waitFor(() => {
			const bannerBox = banner.getBoundingClientRect();
			expect(bannerBox.height).toBeGreaterThan(0);

			const composer = canvasElement.querySelector('form.textarea');
			expect(composer).not.toBeNull();
			const composerBox = (
				composer as HTMLElement
			).getBoundingClientRect();

			// The banner sits above the composer card, not underneath it.
			expect(Math.round(bannerBox.bottom)).toBeLessThanOrEqual(
				Math.round(composerBox.top) + 1
			);
		});
	}
};

export const Default: Story = {
	name: 'Default (empty)',
	render: () => <ComposerShell />
};

/** Desktop chat card contract: the composer card rests on the session's inner edge. */
export const DesktopBottomAnchored: Story = {
	name: 'Desktop — composer anchored to session bottom',
	parameters: {
		viewport: {
			options: {
				desktop1440: {
					name: 'Desktop 1440',
					styles: { width: '1440px', height: '900px' }
				}
			}
		}
	},
	globals: {
		viewport: { value: 'desktop1440' }
	},
	render: () => <ComposerShell />,
	play: async ({ canvasElement }) => {
		await expectComposerBottomInset(canvasElement, 0);
	}
};

/** #597: focus the editor so `--selected` applies (2px primary-container + send styles). */
export const Selected: Story = {
	name: 'Selected (composer focused)',
	render: () => <ComposerShell />,
	play: async ({ canvasElement }) => {
		const editor = await waitFor(() => {
			const node = canvasElement.querySelector<HTMLElement>(
				'[contenteditable="true"]'
			);
			if (!node) {
				throw new Error('composer editor not mounted yet');
			}
			return node;
		});

		await userEvent.click(editor);

		await waitFor(async () => {
			const selected = canvasElement.querySelector(
				'.textarea__wrapper-send-message--selected'
			);
			await expect(selected).toBeTruthy();
		});
	}
};

/**
 * #835: opening the emoji picker in the docked composer must not leave a dark
 * clipped fragment over the emoji / mention controls. The picker is portalled
 * to document.body (outside `.session { overflow: hidden }`).
 */
export const DockedEmojiPickerNoOverlay: Story = {
	name: 'Docked emoji picker — no dark overlay (#835)',
	render: () => (
		<div
			style={{
				// Leave room above the docked composer so the portalled picker
				// (380px) is visible in Storybook screenshots / visual review.
				minHeight: 720,
				display: 'flex',
				flexDirection: 'column',
				justifyContent: 'flex-end'
			}}
		>
			<ComposerShell />
		</div>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		// Both languages: the Storybook preview defaults to German
		// (`initialGlobals.locale = FALLBACK_LNG`, and the component test pins
		// the browser to de-DE), but the toolbar can be switched to English.
		const emojiButton = await canvas.findByRole('button', {
			name: /emoji/i
		});
		const mentionButton = await canvas.findByRole('button', {
			name: /mention|erwähnen/i
		});

		await userEvent.click(emojiButton);

		const popup = await waitFor(() => {
			const node = document.querySelector(
				'[data-testid="emoji-picker-popup"]'
			);
			if (!(node instanceof HTMLElement)) {
				throw new Error('emoji picker popup not mounted yet');
			}
			return node;
		});

		await expect(popup.parentElement).toBe(document.body);
		await expect(popup.className).toContain('emojiPickerPopup--portalled');
		await expect(
			canvasElement.querySelector('.session')?.contains(popup)
		).toBe(false);

		// Toolbar controls stay in the layout (not covered by an in-session clip).
		await expect(emojiButton).toBeVisible();
		await expect(mentionButton).toBeVisible();
	}
};

export const ReadyToSend: Story = {
	name: 'Ready to send (typed)',
	render: () => <ComposerShell />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const editor = await waitFor(() => {
			const node = canvasElement.querySelector<HTMLElement>(
				'[contenteditable="true"]'
			);
			if (!node) {
				throw new Error('composer editor not mounted yet');
			}
			return node;
		});

		await userEvent.click(editor);
		await userEvent.keyboard('Writing');

		await waitFor(async () => {
			const sendButton = canvas.getByRole('button', {
				name: /senden|send/i
			});
			await expect(sendButton).toBeEnabled();
		});
	}
};

export const LongMessageAutoGrow: Story = {
	name: 'Long message (auto-grows to 14 lines)',
	render: () => <ComposerShell shellHeight={852} />,
	play: async ({ canvasElement }) => {
		const editor = await waitFor(() => {
			const node = canvasElement.querySelector<HTMLElement>(
				'[contenteditable="true"]'
			);
			if (!node) throw new Error('composer editor not mounted yet');
			return node;
		});
		await userEvent.click(editor);
		await userEvent.type(
			editor,
			Array.from({ length: 20 }, (_, index) => `Zeile ${index + 1}`).join(
				'{Enter}'
			)
		);

		// D1 (05.09.2026): 14 lines × 19.6 px (14 px × 1.4) + 122 px of
		// chrome (dock, toolbar strip, insets, borders) = 396 px — was 436
		// with the 16 px / 22.4 px line. T41: the card is a real 852 px one,
		// so the timeline floor (`MIN_TIMELINE_VISIBLE`) leaves those 14
		// lines room; in a shorter card the floor wins and the composer
		// stops earlier — which is the point of it.
		await waitFor(() => {
			const shell = canvasElement.querySelector<HTMLElement>(
				'.textarea__wrapper-send-message'
			);
			expect(Math.round(shell?.getBoundingClientRect().height || 0)).toBe(
				396
			);
		});
	}
};

function SessionHeightResetHarness() {
	const [sessionId, setSessionId] = React.useState(360);
	return (
		<div style={{ position: 'relative' }}>
			<button
				type="button"
				style={{ position: 'absolute', top: 8, left: 8, zIndex: 10 }}
				onClick={() => setSessionId(361)}
			>
				Gespräch wechseln
			</button>
			<ComposerShell
				activeSession={buildMockActiveSession({}, { id: sessionId })}
			/>
		</div>
	);
}

export const SessionHeightReset: Story = {
	name: 'Dragged height resets on conversation change',
	render: () => <SessionHeightResetHarness />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const dragHandle = await canvas.findByRole('button', {
			name: /ziehen, um den editor zu vergrößern/i
		});
		dragHandle.focus();
		// Dispatch on the handle rather than via `userEvent.keyboard`, which
		// sends to whatever holds focus. The composer's editor takes focus back
		// asynchronously, so on a slower machine the key landed on the TipTap
		// contenteditable instead and user-event threw "Not implemented" trying
		// to move the caret — green on macOS, red on the Linux CI runner. Same
		// approach as DragHandle.stories.tsx.
		dragHandle.dispatchEvent(
			new KeyboardEvent('keydown', { key: 'End', bubbles: true })
		);
		await waitFor(() => {
			const shell = canvasElement.querySelector<HTMLElement>(
				'.textarea__wrapper-send-message'
			);
			expect(shell?.getBoundingClientRect().height || 0).toBeGreaterThan(
				196
			);
		});

		await userEvent.click(
			canvas.getByRole('button', { name: 'Gespräch wechseln' })
		);
		await waitFor(() => {
			const shell = canvasElement.querySelector<HTMLElement>(
				'.textarea__wrapper-send-message'
			);
			expect(Math.round(shell?.getBoundingClientRect().height || 0)).toBe(
				196
			);
		});
	}
};

/** WP-4: pasting an image into the editor routes into the attachment flow
 *  and the pre-send card shows a real thumbnail instead of a file icon. */
export const ImageAttachmentPreview: Story = {
	name: 'Image attachment preview (pasted)',
	// Wrapped in StrictMode: the pre-send thumbnail must survive the
	// mount → cleanup → mount object-URL cycle (the 1146 KB broken-thumb fix).
	render: () => (
		<StrictMode>
			<ComposerShell />
		</StrictMode>
	),
	play: async ({ canvasElement }) => {
		const editor = await waitFor(() => {
			const node = canvasElement.querySelector<HTMLElement>(
				'[contenteditable="true"]'
			);
			if (!node) {
				throw new Error('composer editor not mounted yet');
			}
			return node;
		});

		const pngBytes = Uint8Array.from(
			atob(
				'iVBORw0KGgoAAAANSUhEUgAAAHgAAABICAYAAAA9HjF/AAAAwElEQVR4nO3RsQkAIBDAwK/dfwXn1DGEeMX1gcyedeia1wEYjMEY/CmD4wyOMzjO4DiD4wyOMzjO4DiD4wyOMzjO4DiD4wyOMzjO4DiD4wyOMzjO4DiD4wyOMzjO4DiD4wyOMzjO4DiD4wyOMzjO4DiD4wyOMzjO4DiD4wyOMzjO4DiD4wyOMzjO4DiD4wyOMzjO4DiD4wyOMzjO4DiD4wyOMzjO4DiD4wyOMzjO4DiD4wyOMzjO4DiD4wyOMzjuAl4Hs8nHnWSXAAAAAElFTkSuQmCC'
			),
			(char) => char.charCodeAt(0)
		);
		const clipboardData = new DataTransfer();
		clipboardData.items.add(
			new File([pngBytes], 'pasted.png', { type: 'image/png' })
		);
		editor.dispatchEvent(
			new ClipboardEvent('paste', {
				clipboardData,
				bubbles: true,
				cancelable: true
			})
		);

		await waitFor(() => {
			const thumb = canvasElement.querySelector(
				'.textarea__attachmentModeThumb'
			);
			if (!thumb) {
				throw new Error('attachment thumbnail not rendered yet');
			}
		});
	}
};

export const ReplyingToMessage: Story = {
	name: 'Replying (m.in_reply_to preview)',
	render: () => (
		<ComposerShell
			replyTo={{
				eventId: '$orig:matrix.example.org',
				author: 'Maria K.',
				text: 'Ich habe seit letzter Woche große Probleme mit meinem Vermieter und weiß nicht weiter.'
			}}
			onCancelReply={() => {}}
		/>
	),
	play: async ({ canvasElement }) => {
		await waitFor(() => {
			expect(
				canvasElement.querySelector('.messageSubmit__replyPreview')
			).toBeTruthy();
		});

		const preview = canvasElement.querySelector(
			'.messageSubmit__replyPreview'
		) as HTMLElement;
		const editor = preview
			.closest('form')
			?.querySelector('.textarea__input') as HTMLElement;
		const editorRect = editor.getBoundingClientRect();

		// The bar hugs the quote instead of spanning the composer — it should
		// read like the bubble it quotes, not like a full-width banner.
		expect(preview.getBoundingClientRect().width).toBeLessThan(
			editorRect.width * 0.8
		);
		// …starting on the editor's left edge, not outside it.
		expect(Math.round(preview.getBoundingClientRect().left)).toBe(
			Math.round(editorRect.left)
		);

		// A very long quote grows to the editor's width and stops there.
		const text = preview.querySelector(
			'.messageSubmit__replyPreviewText'
		) as HTMLElement;
		const original = text.textContent;
		text.textContent = 'x'.repeat(600);
		expect(
			Math.round(preview.getBoundingClientRect().right)
		).toBeLessThanOrEqual(Math.round(editorRect.right));
		text.textContent = original;
	}
};

const EDITING_LONG_TEXT =
	'When some text is written meaning their is something the user can send to the chat room, than onlyshow the red sending state and nothing else at all';

/** Shared assertions for the Figma "Reply Bar_v2" edit banner (9354:206458). */
const expectEditBannerMatchesFigma = async (canvasElement: HTMLElement) => {
	const banner = await waitFor(() => {
		const found = canvasElement.querySelector(
			'.messageSubmit__editPreview'
		) as HTMLElement;
		expect(found).toBeTruthy();
		return found;
	});

	// One 32px line, never wrapping, and flush with the *editor* below it.
	// Figma 18:1990 puts the bar and the text component both at x=16 /
	// width 863 — not at the outer card's edges.
	const editor = banner
		.closest('form')
		?.querySelector('.textarea__input') as HTMLElement;
	const bannerRect = banner.getBoundingClientRect();
	const editorRect = editor.getBoundingClientRect();
	expect(Math.round(bannerRect.height)).toBe(32);
	expect(Math.round(bannerRect.left)).toBe(Math.round(editorRect.left));
	expect(Math.round(bannerRect.right)).toBe(Math.round(editorRect.right));

	const text = banner.querySelector(
		'.messageSubmit__editPreviewText'
	) as HTMLElement;
	expect(getComputedStyle(text).textOverflow).toBe('ellipsis');
	expect(getComputedStyle(text).whiteSpace).toBe('nowrap');
	// Ellipsized, not clipped away: the line box stays one line high.
	expect(Math.round(text.getBoundingClientRect().height)).toBe(16);

	// M3 body-small, emphasized lead in secondary, message in primary.
	expect(getComputedStyle(banner).fontSize).toBe('12px');
	expect(getComputedStyle(banner).lineHeight).toBe('16px');
	const label = banner.querySelector(
		'.messageSubmit__editPreviewLabel'
	) as HTMLElement;
	expect(getComputedStyle(label).fontWeight).toBe('500');

	// The cancel glyph is a real 16px icon, not a "×" character.
	const cancel = banner.querySelector(
		'.messageSubmit__editPreviewCancel'
	) as HTMLElement;
	expect(cancel.querySelector('svg')).toBeTruthy();
	expect(Math.round(cancel.getBoundingClientRect().width)).toBe(16);

	// #978 must not come back through the newly visible preview text.
	expect(banner.textContent).not.toMatch(/\[\[/);
};

export const EditingMessage: Story = {
	name: 'Editing (m.replace preview)',
	render: () => (
		<ComposerShell
			editingMessage={{
				eventId: '$orig:matrix.example.org',
				text: EDITING_LONG_TEXT
			}}
			onCancelEdit={() => {}}
		/>
	),
	play: async ({ canvasElement }) => {
		await expectEditBannerMatchesFigma(canvasElement);
	}
};

/**
 * Mobile counterpart — Figma 18:6713. Same bar, less room for the text.
 *
 * Uses `phone390Globals`, not `parameters.viewport.defaultViewport`: preview.tsx
 * replaces the viewport options with `phone375` / `phone390` only (#849), so
 * naming a built-in preset like `mobile1` silently leaves the story at desktop
 * width — and this story's whole point is the mobile breakpoint.
 */
export const EditingMessageMobile: Story = {
	name: 'Editing (m.replace preview) — mobile',
	globals: phone390Globals,
	render: () => (
		<ComposerShell
			editingMessage={{
				eventId: '$orig:matrix.example.org',
				text: EDITING_LONG_TEXT
			}}
			onCancelEdit={() => {}}
		/>
	),
	play: async ({ canvasElement }) => {
		await expectEditBannerMatchesFigma(canvasElement);
	}
};

export const GroupChat: Story = {
	name: 'Group chat (multiple recipients)',
	render: () => (
		<ComposerShell
			activeSession={buildMockGroupSession()}
			roomMembers={storybookGroupRoomMembers}
		/>
	)
};

/** Production caller: both split segments must return focus after Escape. */
export const RecipientMenuKeyboard: Story = {
	...GroupChat,
	name: 'Recipient menu — Escape restores keyboard focus',
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await waitFor(() =>
			expect(
				canvasElement.querySelectorAll(
					'.textarea__audienceSelector .splitButton > button'
				)
			).toHaveLength(2)
		);
		const triggers = Array.from(
			canvasElement.querySelectorAll<HTMLButtonElement>(
				'.textarea__audienceSelector .splitButton > button'
			)
		);
		for (const trigger of triggers) {
			trigger.focus();
			await userEvent.keyboard('{Enter}');
			await waitFor(() =>
				expect(trigger.getAttribute('aria-expanded')).toBe('true')
			);
			const dialog = await canvas.findByRole('dialog');
			const popupButton =
				dialog.querySelector<HTMLButtonElement>('button')!;
			popupButton.focus();
			await expect(document.activeElement).toBe(popupButton);
			await userEvent.keyboard('{Escape}');
			await waitFor(() =>
				expect(trigger.getAttribute('aria-expanded')).toBe('false')
			);
			await expect(canvas.queryByRole('dialog')).toBeNull();
			await expect(document.activeElement).toBe(trigger);
		}
		const closedEscape = new KeyboardEvent('keydown', {
			key: 'Escape',
			bubbles: true,
			cancelable: true
		});
		document.dispatchEvent(closedEscape);
		await expect(closedEscape.defaultPrevented).toBe(false);
	}
};

export const Supervisor: Story = {
	name: 'Supervisor aside',
	render: () => (
		<ComposerShell
			activeSession={buildMockActiveSession()}
			isSupervisor={true}
		/>
	)
};

export const Mobile: Story = {
	// Was `defaultViewport: 'mobile1'`, which has not resolved since #849
	// removed the built-in presets — the story called itself Mobile and
	// rendered at desktop width.
	globals: phone390Globals,
	render: () => <ComposerShell />,
	play: async ({ canvasElement }) => {
		await expectComposerBottomInset(canvasElement, 16);
	}
};

export const Tablet: Story = {
	globals: tablet834Globals,
	render: () => <ComposerShell />,
	play: async ({ canvasElement }) => {
		await expectComposerBottomInset(canvasElement, 16);
	}
};

/**
 * #1248 — mobile + maximised at a keyboard-sized viewport.
 *
 * The gap that let the bug ship: there was no maximised story at all, so the
 * overlay was only ever reviewed at desktop height, where sizing to the layout
 * viewport looks correct.
 *
 * A Storybook iframe has no soft keyboard, so the keyboard is modelled the only
 * way it can be here — a viewport the height of what is left visible when it is
 * up (390x464). The assertion is the one the issue's acceptance asks for: with
 * the editor maximised, the whole box is inside the visible area, so the
 * toolbar and send button are reachable without scrolling the page.
 */
export const MaximisedMobileKeyboardOpen: Story = {
	name: 'Mobile — maximised, keyboard-sized viewport (#1248)',
	parameters: {
		viewport: {
			options: {
				phone390Keyboard: {
					name: 'Phone 390 · keyboard open',
					styles: { width: '390px', height: '464px' }
				}
			}
		}
	},
	globals: { viewport: { value: 'phone390Keyboard' } },
	render: () => <ComposerShell />,
	play: async ({ canvasElement }) => {
		// The toolbar only mounts once the composer is focused, so click into
		// the editor first — the same order a user follows.
		const input = await waitFor(() => {
			const node = canvasElement.querySelector<HTMLElement>(
				'[contenteditable="true"]'
			);
			if (!node) {
				throw new Error('composer editor not mounted yet');
			}
			return node;
		});
		await userEvent.click(input);

		const maximise = await waitFor(() =>
			within(canvasElement).getByRole('button', {
				// Exact: 'Ziehen, um den Editor zu vergrößern' (the drag
				// handle) would also match a loose pattern.
				name: 'Editor vergrößern'
			})
		);
		await userEvent.click(maximise);

		// The overlay portals out of `canvasElement`, so query the document.
		const editor = await waitFor(() => {
			const node = document.querySelector<HTMLElement>(
				'.textarea__wrapper-send-message--expanded'
			);
			if (!node) {
				throw new Error('composer did not maximise');
			}
			return node;
		});

		const overlay = document.querySelector<HTMLElement>(
			'.messageSubmit__wrapper--expanded'
		) as HTMLElement;
		await expect(overlay).toBeTruthy();

		const rect = editor.getBoundingClientRect();
		// Fully inside the visible area — nothing above the top edge, nothing
		// past the bottom. Before the fix the box was sized from the layout
		// viewport and overhung both.
		await expect(rect.top).toBeGreaterThanOrEqual(0);
		const overlayRect = overlay.getBoundingClientRect();
		await expect(rect.top).toBeGreaterThanOrEqual(overlayRect.top - 1);
		await expect(rect.bottom).toBeLessThanOrEqual(overlayRect.bottom + 1);
		await expect(rect.height).toBeGreaterThan(0);

		/*
		 * Long text scrolls in the editor, not in the box around it (#1319
		 * review). `.ProseMirror` is the scroll container — absolutely
		 * positioned inside a clipped parent — so the outer input box must NOT
		 * become one: an overflow rule there computes overflow-x to auto too
		 * and turns the counter and editing banner into scroll content.
		 */
		const prose = document.querySelector<HTMLElement>(
			'.messageSubmit__wrapper--expanded .ProseMirror'
		);
		await expect(prose).toBeTruthy();
		await expect(window.getComputedStyle(prose!).overflowY).toBe('auto');
		const inputBox = document.querySelector<HTMLElement>(
			'.textarea__wrapper-send-message--expanded .textarea__input'
		);
		await expect(inputBox).toBeTruthy();
		await expect(window.getComputedStyle(inputBox!).overflowY).toBe(
			'visible'
		);

		/*
		 * The part that actually catches #1248.
		 *
		 * A Storybook iframe has no soft keyboard, so the layout/visual
		 * viewport split that causes the bug cannot occur on its own here —
		 * without this the story passes against the unfixed code too. So the
		 * keyboard is simulated the way iOS presents it: the visual viewport
		 * shrinks while the layout viewport (window.innerHeight) does not.
		 * The overlay has to follow the visible height, not the layout one.
		 */
		const viewport = window.visualViewport;
		// No silent skip (#1319 review): without the API this story proves
		// nothing, and a green run would hide that.
		if (!viewport) {
			throw new Error(
				'window.visualViewport is unavailable — this story cannot verify #1248'
			);
		}
		const layoutHeight = window.innerHeight;
		const keyboardHeight = Math.round(layoutHeight / 2);
		Object.defineProperty(viewport, 'height', {
			configurable: true,
			get: () => keyboardHeight
		});
		viewport.dispatchEvent(new Event('resize'));

		try {
			await waitFor(async () => {
				const shrunk = overlay.getBoundingClientRect();
				await expect(Math.round(shrunk.height)).toBe(keyboardHeight);
				// …and the editor stays inside that smaller box.
				const inside = editor.getBoundingClientRect();
				await expect(inside.bottom).toBeLessThanOrEqual(
					shrunk.bottom + 1
				);
				await expect(inside.top).toBeGreaterThanOrEqual(shrunk.top - 1);
			});
		} finally {
			// `delete` puts the prototype's native getter back. Redefining an own
			// property with the captured value would freeze the height for every
			// story that runs after this one in the same page (#1319 review).
			delete (viewport as unknown as { height?: number }).height;
			viewport.dispatchEvent(new Event('resize'));
		}
	}
};

/** The same control at desktop height, which the issue says must not regress. */
export const MaximisedDesktop: Story = {
	name: 'Desktop — maximised (unchanged by #1248)',
	parameters: {
		viewport: {
			options: {
				desktop1440: {
					name: 'Desktop 1440',
					styles: { width: '1440px', height: '900px' }
				}
			}
		}
	},
	globals: { viewport: { value: 'desktop1440' } },
	render: () => <ComposerShell />,
	play: async ({ canvasElement }) => {
		// The toolbar only mounts once the composer is focused, so click into
		// the editor first — the same order a user follows.
		const input = await waitFor(() => {
			const node = canvasElement.querySelector<HTMLElement>(
				'[contenteditable="true"]'
			);
			if (!node) {
				throw new Error('composer editor not mounted yet');
			}
			return node;
		});
		await userEvent.click(input);

		const maximise = await waitFor(() =>
			within(canvasElement).getByRole('button', {
				// Exact: 'Ziehen, um den Editor zu vergrößern' (the drag
				// handle) would also match a loose pattern.
				name: 'Editor vergrößern'
			})
		);
		await userEvent.click(maximise);

		const editor = await waitFor(() => {
			const node = document.querySelector<HTMLElement>(
				'.textarea__wrapper-send-message--expanded'
			);
			if (!node) {
				throw new Error('composer did not maximise');
			}
			return node;
		});

		const overlay = document.querySelector<HTMLElement>(
			'.messageSubmit__wrapper--expanded'
		) as HTMLElement;
		await expect(overlay).toBeTruthy();

		const rect = editor.getBoundingClientRect();
		// Measured against the overlay, which is what the fix sizes to the
		// visible viewport — the runner's window metrics do not agree with its
		// emulated viewport, so they are not a usable reference here.
		const overlayRect = overlay.getBoundingClientRect();
		await expect(rect.bottom).toBeLessThanOrEqual(overlayRect.bottom + 1);
		await expect(rect.top).toBeGreaterThanOrEqual(overlayRect.top - 1);
		// The overlay lays out over a frame or two after the click, so settle
		// before measuring rather than catching the intermediate height.
		await waitFor(async () => {
			const settled = editor.getBoundingClientRect();
			// Desktop keeps the roomy editor: well over half the overlay.
			await expect(settled.height).toBeGreaterThan(
				overlay.getBoundingClientRect().height * 0.5
			);
		});
	}
};

/**
 * #1249 — repeated maximise/restore.
 *
 * The report is that after one or two cycles on an iPhone the composer stops
 * responding to everything but reopening it. This pins the sequence the issue
 * asks for: ten toggles, checking after **every** one that the editor still
 * accepts input and that the toggle control itself is still there.
 *
 * It does NOT reproduce the reported lock-up — see
 * `docs/agent-tasks/2026-09-06_issue-1249-composer-toggle-lockup/` for what was
 * ruled out and how. It is here as the regression guard the acceptance asks
 * for ("covers repeated toggling — not a single toggle"), so that whatever the
 * cause turns out to be, a regression in the toggle path itself is caught.
 */
export const RepeatedMaximiseToggle: Story = {
	name: 'Mobile — ten maximise/restore cycles stay usable (#1249)',
	globals: phone390Globals,
	render: () => <ComposerShell />,
	play: async ({ canvasElement }) => {
		const editor = await waitFor(() => {
			const node = canvasElement.querySelector<HTMLElement>(
				'[contenteditable="true"]'
			);
			if (!node) {
				throw new Error('composer editor not mounted yet');
			}
			return node;
		});
		await userEvent.click(editor);

		const toggle = () =>
			within(canvasElement).getByRole('button', {
				name: /^Editor (vergrößern|verkleinern)$/
			});

		for (let cycle = 1; cycle <= 10; cycle += 1) {
			// The control has to still exist — if a toggle leaves the toolbar in
			// a state without it, the user is stranded.
			const button = await waitFor(toggle);
			await userEvent.click(button);

			// …and the editor has to still take input after every single cycle.
			const live = await waitFor(() => {
				const node = document.querySelector<HTMLElement>(
					'[contenteditable="true"]'
				);
				if (!node) {
					throw new Error(`editor gone after cycle ${cycle}`);
				}
				return node;
			});
			await expect(live.getAttribute('contenteditable')).toBe('true');

			await userEvent.click(live);
			await userEvent.type(live, String(cycle % 10));
			await waitFor(async () => {
				await expect(live.textContent ?? '').toContain(
					String(cycle % 10)
				);
			});
		}

		// The toggle survives all ten cycles.
		await expect(toggle()).toBeTruthy();
	}
};

const LONG_RECIPIENT = 'P. BouvierMitSehrLangemNachnamen';
const recipientLayoutMembers = [
	...storybookGroupRoomMembers,
	{
		userId: '@andrea:beratung.local',
		name: 'Patty BouvierMitSehrLangemNachnamen'
	}
];
const RecipientLayoutScenario = ({
	productionSessionFade = true
}: {
	productionSessionFade?: boolean;
}) => (
	<ComposerShell
		productionSessionFade={productionSessionFade}
		activeSession={buildMockGroupSession()}
		roomMembers={recipientLayoutMembers}
		autoFocusEditor={false}
	/>
);
const overlaps = (a: DOMRect, b: DOMRect) =>
	Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5 &&
	Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5;

async function expectRecipientClearOfComposer(
	canvasElement: HTMLElement,
	reserveEditor: boolean
) {
	await document.fonts.ready;
	await waitFor(() => {
		const card = canvasElement.querySelector<HTMLElement>(
			'.textarea__wrapper-send-message'
		)!;
		expect(
			card
				.getAnimations()
				.some((animation) => animation.playState === 'running')
		).toBe(false);
		const fade = card.closest<HTMLElement>('.session__gameInputFadeTarget');
		if (fade)
			expect(
				fade
					.getAnimations()
					.some((animation) => animation.playState === 'running')
			).toBe(false);
		const selector = canvasElement.querySelector<HTMLElement>(
			'.textarea__audienceSelector'
		)!;
		const chip = selector
			.querySelector<HTMLElement>('.splitButton')!
			.getBoundingClientRect();
		expect(Math.round(chip.height)).toBe(32);
		const cardBox = card.getBoundingClientRect();
		expect(chip.left).toBeGreaterThanOrEqual(cardBox.left - 0.5);
		expect(chip.right).toBeLessThanOrEqual(cardBox.right + 0.5);
		expect(chip.bottom).toBeLessThanOrEqual(cardBox.bottom + 0.5);
		const controls = Array.from(
			canvasElement.querySelectorAll<HTMLElement>(
				'.textarea__figmaToolbar button, .textarea__attachmentSelect button'
			)
		);
		for (const control of controls) {
			const box = control.getBoundingClientRect();
			if (box.width && box.height)
				expect(
					overlaps(chip, box),
					`recipient overlaps ${control.getAttribute('aria-label')}`
				).toBe(false);
		}
		const editor =
			canvasElement.querySelector<HTMLElement>('.ProseMirror')!;
		const text = editor.querySelector<HTMLElement>('p')!;
		expect(editor.getBoundingClientRect().height).toBeGreaterThan(0);
		expect(
			overlaps(
				chip,
				(reserveEditor ? editor : text).getBoundingClientRect()
			),
			'recipient overlaps editable text'
		).toBe(false);
	});
}

async function recipientLayoutJourney(
	canvasElement: HTMLElement,
	reserveEditor: boolean
) {
	await waitFor(() =>
		expect(
			canvasElement.querySelector(
				'.textarea__audienceSelector .splitButton'
			)
		).not.toBeNull()
	);
	const canvas = within(canvasElement);
	const toggle = () =>
		canvasElement.querySelector<HTMLButtonElement>(
			'.textarea__audienceSelector .splitButton__trailing'
		)!;
	// Explicitly choose All so per-chat memory from another scenario cannot
	// substitute a previously narrowed audience for this geometry check.
	await userEvent.click(toggle());
	const allDialog = await canvas.findByRole('dialog');
	await userEvent.click(
		allDialog.querySelector<HTMLButtonElement>(
			'.textarea__audienceSelectorMenuSelectAll'
		)!
	);
	await userEvent.keyboard('{Escape}');
	await waitFor(() =>
		expect(
			canvasElement.querySelector(
				'.textarea__audienceSelector .splitButton__label'
			)?.textContent
		).toBe('Alle')
	);
	await expectRecipientClearOfComposer(canvasElement, reserveEditor);
	await userEvent.click(toggle());
	const dialog = await canvas.findByRole('dialog');
	for (const button of Array.from(
		dialog.querySelectorAll<HTMLButtonElement>(
			'.textarea__audienceSelectorSectionChevron'
		)
	)) {
		if (button.getAttribute('aria-expanded') === 'false')
			await userEvent.click(button);
	}
	await userEvent.click(
		within(dialog).getByRole('button', {
			name: LONG_RECIPIENT
		})
	);
	await userEvent.keyboard('{Escape}');
	await waitFor(() =>
		expect(
			canvasElement.querySelector(
				'.textarea__audienceSelector .splitButton__label'
			)?.textContent
		).toBe(LONG_RECIPIENT)
	);
	await expectRecipientClearOfComposer(canvasElement, reserveEditor);
	const editor = canvasElement.querySelector<HTMLElement>('.ProseMirror')!;
	await userEvent.click(editor);
	await userEvent.keyboard('Eine Nachricht an die Gruppe.');
	await expectRecipientClearOfComposer(canvasElement, reserveEditor);
	const expand =
		canvasElement.querySelector<HTMLButtonElement>(
			'.textarea__figmaToolbar button[aria-label="Maximieren"]'
		) ||
		Array.from(
			canvasElement.querySelectorAll<HTMLButtonElement>(
				'.textarea__figmaToolbar button'
			)
		).find((button) =>
			/maxim|expand|vergröß/i.test(
				button.getAttribute('aria-label') || ''
			)
		);
	expect(expand).toBeTruthy();
	await userEvent.click(expand!);
	await waitFor(() =>
		expect(
			canvasElement.querySelector(
				'.textarea__wrapper-send-message--expanded'
			)
		).not.toBeNull()
	);
	await expectRecipientClearOfComposer(canvasElement, reserveEditor);
	await expect(
		canvasElement
			.querySelector('.textarea__wrapper-send-message--expanded')!
			.getBoundingClientRect().height
	).toBeGreaterThan(window.innerHeight * 0.5);
	const viewport = window.visualViewport;
	const viewTop = viewport?.offsetTop || 0;
	const viewLeft = viewport?.offsetLeft || 0;
	const viewBottom = viewTop + (viewport?.height || window.innerHeight);
	const viewRight = viewLeft + (viewport?.width || window.innerWidth);
	await waitFor(() => {
		const card = canvasElement.querySelector<HTMLElement>(
			'.textarea__wrapper-send-message--expanded'
		)!;
		const cardBox = card.getBoundingClientRect();
		const recipient = canvasElement
			.querySelector<HTMLElement>('.textarea__audienceSelector')!
			.getBoundingClientRect();
		expect(
			cardBox.top,
			'expanded composer must remain below the viewport top'
		).toBeGreaterThanOrEqual(viewTop - 0.5);
		expect(
			cardBox.bottom,
			'expanded composer must remain above the viewport bottom'
		).toBeLessThanOrEqual(viewBottom + 0.5);
		expect(cardBox.left).toBeGreaterThanOrEqual(viewLeft - 0.5);
		expect(cardBox.right).toBeLessThanOrEqual(viewRight + 0.5);
		expect(
			recipient.bottom,
			'recipient must remain reachable inside the visible viewport'
		).toBeLessThanOrEqual(viewBottom + 0.5);
	});
	const fade = canvasElement.querySelector<HTMLElement>(
		'.session__gameInputFadeTarget'
	);
	if (fade) {
		await expect(getComputedStyle(fade).transform).toBe('none');
		const collapse = Array.from(
			canvasElement.querySelectorAll<HTMLButtonElement>(
				'.textarea__figmaToolbar button'
			)
		).find((button) =>
			/minim|verkleiner/i.test(button.getAttribute('aria-label') || '')
		);
		expect(collapse).toBeTruthy();
		await userEvent.click(collapse!);
		await waitFor(() =>
			expect(
				canvasElement.querySelector(
					'.textarea__wrapper-send-message--expanded'
				)
			).toBeNull()
		);
		await expect(getComputedStyle(fade).transform).not.toBe('none');
	}
}

export const RecipientLayoutPhone: Story = {
	name: 'Recipient layout — 390px All, long target and expanded',
	globals: phone390Globals,
	render: () => <RecipientLayoutScenario />,
	play: async ({ canvasElement }) =>
		recipientLayoutJourney(canvasElement, true)
};
export const RecipientLayoutTablet: Story = {
	name: 'Recipient layout — 820px All, long target and expanded',
	parameters: {
		viewport: {
			options: {
				recipientTablet820: {
					name: 'Recipient tablet 820',
					styles: { width: '820px', height: '1180px' },
					type: 'tablet'
				}
			}
		}
	},
	globals: { viewport: { value: 'recipientTablet820' } },
	render: () => <RecipientLayoutScenario />,
	play: async ({ canvasElement }) =>
		recipientLayoutJourney(canvasElement, true)
};
export const RecipientLayoutDesktop: Story = {
	name: 'Recipient layout — desktop retains the shared control',
	globals: desktop1440Globals,
	render: () => <RecipientLayoutScenario productionSessionFade={false} />,
	play: async ({ canvasElement }) =>
		recipientLayoutJourney(canvasElement, false)
};
