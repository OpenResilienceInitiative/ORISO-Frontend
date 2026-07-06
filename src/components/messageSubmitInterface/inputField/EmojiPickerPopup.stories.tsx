import * as React from 'react';
import { useState } from 'react';
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
					'tones, themed to the M3 palette. Replaces the previous hardcoded 8-emoji ' +
					'strip. Anchors above (docked/mobile) or below (fullscreen) the emoji button.'
			}
		}
	}
} satisfies Meta<typeof EmojiPickerPopup>;

export default meta;
type Story = StoryObj<typeof meta>;

function PickerDemo() {
	const [picked, setPicked] = useState<string[]>([]);
	return (
		<div style={{ position: 'relative', width: 340, height: 460 }}>
			<div style={{ position: 'absolute', top: 0, left: 0 }}>
				<EmojiPickerPopup
					direction="down"
					onPick={(e) => setPicked((p) => [...p, e])}
					onClose={() => {}}
				/>
			</div>
			<output
				data-testid="picked"
				style={{
					position: 'absolute',
					bottom: 0,
					left: 0,
					font: '16px system-ui'
				}}
			>
				{picked.join(' ')}
			</output>
		</div>
	);
}

export const Picker: Story = {
	render: () => <PickerDemo />
};
