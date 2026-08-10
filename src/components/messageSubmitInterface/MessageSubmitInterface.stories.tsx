import * as React from 'react';
import { StrictMode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { MessageSubmitInterfaceComponent } from './messageSubmitInterfaceComponent';
import {
	buildMockActiveSession,
	buildMockGroupSession,
	ComposerStoryDecorator,
	storybookGroupRoomMembers
} from './__storybook__/composerStoryDecorator';
import './messageSubmitInterface.styles.scss';
import '../session/session.styles.scss';
import { focusSessionChromeOnPointerDown } from '../session/focusSessionChrome';
import { phone390Globals } from '../message/messageStoryShell';

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
	...composerProps
}: {
	activeSession?: any;
	roomMembers?: Array<{ userId: string; name: string }>;
} & Partial<React.ComponentProps<typeof MessageSubmitInterfaceComponent>>) {
	return (
		<div
			className="session"
			tabIndex={-1}
			onMouseDown={focusSessionChromeOnPointerDown}
			style={shellStyle}
		>
			<ComposerStoryDecorator
				activeSession={activeSession}
				roomMembers={roomMembers}
			>
				<MessageSubmitInterfaceComponent
					placeholder="Nachricht an Klient:in schreiben"
					onSendButton={() => {}}
					isTyping={() => {}}
					language="de"
					{...composerProps}
				/>
			</ComposerStoryDecorator>
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

export const Default: Story = {
	name: 'Default (empty)',
	render: () => <ComposerShell />
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
		const emojiButton = await canvas.findByRole('button', {
			name: /emoji/i
		});
		const mentionButton = await canvas.findByRole('button', {
			name: /mention/i
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
	render: () => <ComposerShell />,
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

		await waitFor(() => {
			const shell = canvasElement.querySelector<HTMLElement>(
				'.textarea__wrapper-send-message'
			);
			expect(Math.round(shell?.getBoundingClientRect().height || 0)).toBe(
				436
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
			name: /drag to resize composer/i
		});
		dragHandle.focus();
		await userEvent.keyboard('{End}');
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
				eventId: '$orig:matrix.oriso.org',
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
				eventId: '$orig:matrix.oriso.org',
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
				eventId: '$orig:matrix.oriso.org',
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
	render: () => <ComposerShell />
};
