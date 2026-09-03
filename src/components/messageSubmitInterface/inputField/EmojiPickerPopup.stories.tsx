import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { EmojiPickerPopup } from './EmojiPickerPopup';

const meta = {
	title: 'Components/Composer/EmojiPicker',
	component: EmojiPickerPopup,
	tags: ['autodocs'],
	parameters: {
		layout: 'centered',
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

/** #835: picker must stay fully visible above a clipping `.session` shell. */
export const DockedUpInsideClippingSession: StoryObj = {
	name: 'Docked up inside clipping session (#835)',
	render: () => <PickerDemo direction="up" />
};

export const FullscreenDown: StoryObj = {
	name: 'Fullscreen down',
	render: () => <PickerDemo direction="down" />
};
