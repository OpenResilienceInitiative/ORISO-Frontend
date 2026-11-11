import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, waitFor, within } from 'storybook/test';
import { a11yExcept } from '../../../../.storybook/a11yExceptions';
import { EmojiPickerPopup } from './EmojiPickerPopup';

const meta = {
	title: 'Components/Composer/EmojiPicker',
	component: EmojiPickerPopup,
	tags: ['autodocs'],
	parameters: {
		layout: 'centered',
		// #1338: emoji-picker-react's search field points aria-controls at an id
		// it never renders (epr-search-id); the library owns that markup.
		a11y: a11yExcept({
			'aria-valid-attr-value': ['input[aria-controls="epr-search-id"]']
		}),
		docs: {
			description: {
				component:
					'Full emoji picker (emoji-picker-react) with categories, search and skin ' +
					'tones, themed to the M3 palette. Portalled to document.body and anchored ' +
					'with floating-ui so `.session { overflow: hidden }` cannot clip a dark ' +
					'fragment over the docked toolbar (#835).'
			}
		}
	}
} satisfies Meta<typeof EmojiPickerPopup>;

export default meta;

function PickerDemo({ direction }: { direction: 'up' | 'down' }) {
	const buttonRef = useRef<HTMLButtonElement | null>(null);
	const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
	const [picked, setPicked] = useState<string[]>([]);
	const [open, setOpen] = useState(true);

	useEffect(() => {
		setAnchorEl(buttonRef.current);
	}, []);

	return (
		<div
			className="session"
			style={{
				position: 'relative',
				width: 420,
				height: 520,
				overflow: 'hidden',
				display: 'flex',
				alignItems: direction === 'up' ? 'flex-end' : 'flex-start',
				padding: 24,
				background: '#eae7e8',
				borderRadius: 28,
				boxSizing: 'border-box'
			}}
		>
			<button
				ref={buttonRef}
				type="button"
				data-emoji-picker-toggle=""
				onClick={() => setOpen((value) => !value)}
				style={{
					width: 38,
					height: 32,
					borderRadius: 12,
					border: 0,
					background: '#ffdad5'
				}}
			>
				😀
			</button>
			{open && (
				<EmojiPickerPopup
					direction={direction}
					anchorEl={anchorEl}
					onPick={(emoji) => setPicked((prev) => [...prev, emoji])}
					onClose={() => setOpen(false)}
				/>
			)}
			<output
				data-testid="picked"
				style={{
					position: 'absolute',
					bottom: 8,
					left: 24,
					font: '16px system-ui'
				}}
			>
				{picked.join(' ')}
			</output>
		</div>
	);
}

const waitForPickerKeyboardTarget: NonNullable<StoryObj['play']> = async ({
	canvasElement
}) => {
	const popup = await within(canvasElement.ownerDocument.body).findByTestId(
		'emoji-picker-popup'
	);

	// The library renders the scroll container before its lazy emoji buttons.
	await waitFor(
		() => {
			const button = popup.querySelector<HTMLButtonElement>(
				'button[data-unified]'
			);
			expect(button).toBeVisible();
			expect(button).toBeEnabled();
			expect(button?.tabIndex).toBe(0);
		},
		{ timeout: 10_000 }
	);
};

/** #835: picker must stay fully visible above a clipping `.session` shell. */
export const DockedUpInsideClippingSession: StoryObj = {
	name: 'Docked up inside clipping session (#835)',
	render: () => <PickerDemo direction="up" />,
	play: waitForPickerKeyboardTarget
};

export const FullscreenDown: StoryObj = {
	name: 'Fullscreen down',
	render: () => <PickerDemo direction="down" />,
	play: waitForPickerKeyboardTarget
};

/** Phone composer: the toggle sits near the bottom, like the "+" button. */
function PhoneComposerDemo() {
	const buttonRef = useRef<HTMLButtonElement | null>(null);
	const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

	useEffect(() => {
		setAnchorEl(buttonRef.current);
	}, []);

	return (
		<div style={{ position: 'fixed', inset: 0, background: '#eae7e8' }}>
			<button
				ref={buttonRef}
				type="button"
				data-emoji-picker-toggle=""
				style={{
					position: 'absolute',
					bottom: 64,
					left: '55%',
					width: 44,
					height: 44,
					borderRadius: 22,
					border: 0,
					background: '#ffdad5'
				}}
			>
				+
			</button>
			<EmojiPickerPopup
				direction="up"
				anchorEl={anchorEl}
				onPick={() => {}}
				onClose={() => {}}
			/>
		</div>
	);
}

/** #1251: the whole picker stays on screen, above its button. */
const staysInsideVisibleRoom: NonNullable<StoryObj['play']> = async (
	context
) => {
	await waitForPickerKeyboardTarget(context);
	const doc = context.canvasElement.ownerDocument;
	const view = doc.defaultView as Window;
	await waitFor(() => {
		const popup = doc
			.querySelector('[data-testid="emoji-picker-popup"]')
			?.getBoundingClientRect();
		const toggle = doc
			.querySelector('[data-emoji-picker-toggle]')
			?.getBoundingClientRect();
		expect(popup && toggle).toBeTruthy();
		expect(popup!.top).toBeGreaterThanOrEqual(0);
		expect(popup!.left).toBeGreaterThanOrEqual(0);
		expect(popup!.right).toBeLessThanOrEqual(view.innerWidth);
		expect(popup!.bottom).toBeLessThanOrEqual(toggle!.top);
	});
};

/** #1251: a 320px picker plus its padding is wider than a 320px phone. */
export const Phone320: StoryObj = {
	name: 'Phone 320 (#1251)',
	parameters: { layout: 'fullscreen' },
	globals: { viewport: { value: 'phone320', isRotated: false } },
	render: () => <PhoneComposerDemo />,
	play: staysInsideVisibleRoom
};

/**
 * #1251: little room above the composer, as on a phone in landscape or
 * with the soft keyboard up — the picker shrinks instead of leaving the top.
 */
export const PhoneShortRoom: StoryObj = {
	name: 'Phone, short room above the composer (#1251)',
	parameters: { layout: 'fullscreen' },
	globals: { viewport: { value: 'phone390Landscape', isRotated: false } },
	render: () => <PhoneComposerDemo />,
	play: staysInsideVisibleRoom
};
