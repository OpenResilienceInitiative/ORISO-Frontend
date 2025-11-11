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
				component: 'MessageAttachment component for displaying file attachments in chat messages. Supports image previews for images and document icons for PDFs and other files.'
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
			title_link: 'https://img.freepik.com/free-vector/red-irregular-organic-lines-seamless-pattern_1409-4440.jpg?semt=ais_hybrid&w=740&q=80',
			title_link_download: true,
			type: 'image',
			description: 'Red irregular organic lines seamless pattern',
			image_url: 'https://img.freepik.com/free-vector/red-irregular-organic-lines-seamless-pattern_1409-4440.jpg?semt=ais_hybrid&w=740&q=80',
			image_type: 'image/jpeg',
			image_size: 99045
		},
		file: {
			_id: 'file123',
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
			title_link: '/example.pdf',
			title_link_download: true,
			type: 'file',
			description: 'PDF document',
			image_url: '',
			image_type: '',
			image_size: 70000 // in bytes (70 KB)
		},
		file: {
			_id: 'file456',
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
			title_link: 'https://img.freepik.com/free-vector/red-irregular-organic-lines-seamless-pattern_1409-4440.jpg?semt=ais_hybrid&w=740&q=80',
			title_link_download: true,
			type: 'image',
			description: 'Red irregular organic lines seamless pattern',
			image_url: 'https://img.freepik.com/free-vector/red-irregular-organic-lines-seamless-pattern_1409-4440.jpg?semt=ais_hybrid&w=740&q=80',
			image_type: 'image/jpeg',
			image_size: 99045
		},
		file: {
			_id: 'file789',
			name: 'pattern.jpg',
			type: 'image/jpeg'
		},
		hasRenderedMessage: true,
		rid: 'room123',
		t: undefined
	}
};
