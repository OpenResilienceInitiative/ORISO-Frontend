import { Meta, StoryObj } from '@storybook/react';
import { MessageAttachment } from './MessageAttachment';
import './message.styles.scss';
import * as React from 'react';

// Mock apiUrl for Storybook - ensure it's empty so paths work correctly
if (typeof window !== 'undefined') {
	(window as any).REACT_APP_API_URL = '';
}

const meta = {
	title: 'Components/Chat/MessageAttachment',
	component: MessageAttachment,
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component:
					'MessageAttachment component for displaying file attachments in chat messages. Supports image previews for images and document icons for PDFs and other files.'
			}
		}
	},
	decorators: [
		(Story) => {
			return React.createElement(
				'div',
				{ style: { padding: '20px', maxWidth: '500px' } },
				React.createElement(Story)
			);
		}
	]
} satisfies Meta<typeof MessageAttachment>;

export default meta;
type Story = StoryObj<typeof MessageAttachment>;

// Example image attachment
export const ImageAttachment: Story = {
	args: {
		attachment: {
			title: 'pattern.jpg',
			downloadUrl:
				'https://img.freepik.com/free-vector/red-irregular-organic-lines-seamless-pattern_1409-4440.jpg?semt=ais_hybrid&w=740&q=80',
			type: 'image',
			description: 'Red irregular organic lines seamless pattern',
			mediaType: 'image/jpeg',
			size: 99045
		},
		file: {
			id: 'file123',
			name: 'pattern.jpg',
			type: 'image/jpeg'
		},
		hasRenderedMessage: false,
		rid: 'room123',
		t: undefined
	}
};

// Example PDF document attachment
export const DocumentAttachment: Story = {
	args: {
		attachment: {
			title: 'ORISO (Repository Guide).pdf',
			downloadUrl: '/example.pdf',
			type: 'file',
			description: 'PDF document',
			mediaType: '',
			size: 70000 // in bytes (70 KB)
		},
		file: {
			id: 'file456',
			name: 'ORISO (Repository Guide).pdf',
			type: 'application/pdf'
		},
		hasRenderedMessage: false,
		rid: 'room123',
		t: undefined
	}
};

// Example with rendered message (text + attachment)
export const WithRenderedMessage: Story = {
	args: {
		attachment: {
			title: 'pattern.jpg',
			downloadUrl:
				'https://img.freepik.com/free-vector/red-irregular-organic-lines-seamless-pattern_1409-4440.jpg?semt=ais_hybrid&w=740&q=80',
			type: 'image',
			description: 'Red irregular organic lines seamless pattern',
			mediaType: 'image/jpeg',
			size: 99045
		},
		file: {
			id: 'file789',
			name: 'pattern.jpg',
			type: 'image/jpeg'
		},
		hasRenderedMessage: true,
		rid: 'room123',
		t: undefined
	}
};

// --- WP-4 media check states (epic ORISO-Admin#366) ------------------------
// Shared state model with the admin editor uploader: uploading / unchecked /
// safe / blocked / error. `safe` is the plain ImageAttachment story above.

const PNG_DATA_URL =
	'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAHgAAABICAYAAAA9HjF/AAAAwElEQVR4nO3RsQkAIBDAwK/dfwXn1DGEeMX1gcyedeia1wEYjMEY/CmD4wyOMzjO4DiD4wyOMzjO4DiD4wyOMzjO4DiD4wyOMzjO4DiD4wyOMzjO4DiD4wyOMzjO4DiD4wyOMzjO4DiD4wyOMzjO4DiD4wyOMzjO4DiD4wyOMzjO4DiD4wyOMzjO4DiD4wyOMzjO4DiD4wyOMzjO4DiD4wyOMzjO4DiD4wyOMzjO4DiD4wyOMzjO4DiD4wyOMzjuAl4Hs8nHnWSXAAAAAElFTkSuQmCC';

const uncheckedImageArgs = {
	attachment: {
		title: 'gast-bild.png',
		downloadUrl: PNG_DATA_URL,
		type: 'image',
		mediaType: 'image/png',
		size: 1,
		width: 120,
		height: 72
	} as never,
	file: {
		_id: 'file-guest',
		name: 'gast-bild.png',
		type: 'image/png'
	} as never,
	hasRenderedMessage: false,
	rid: 'room123',
	t: undefined
};

/** Image from an anonymous live-chat guest: unloaded until the counsellor reveals it. */
export const UncheckedBlurred: Story = {
	args: {
		...uncheckedImageArgs,
		mediaCheckState: 'unchecked'
	}
};

/** The content scanner (or a policy) blocked the file: never rendered, never linked. */
export const Blocked: Story = {
	args: {
		...uncheckedImageArgs,
		mediaCheckState: 'blocked'
	}
};

/** featureMediaInlineDisplay* off for this chat type: plain file card, no preview. */
export const FileOnlyInlineDisplayOff: Story = {
	args: {
		...uncheckedImageArgs,
		mediaCheckState: 'safe',
		inlineDisplayEnabled: false
	}
};
