import { Meta, StoryObj } from '@storybook/react';
import { Notice } from './Notice';
import {
	NOTICE_TYPE_INFO,
	NOTICE_TYPE_SUCCESS,
	NOTICE_TYPE_WARNING,
	NOTICE_TYPE_ERROR
} from './types';

const meta = {
	title: 'FEEDBACK/Notice',
	component: Notice,
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component: 'Notice component for displaying informational messages with different types.'
			}
		}
	}
} satisfies Meta<typeof Notice>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Info: Story = {
	args: {
		title: 'Information',
		type: NOTICE_TYPE_INFO,
		children: 'This is an informational notice.'
	}
};

export const Success: Story = {
	args: {
		title: 'Success',
		type: NOTICE_TYPE_SUCCESS,
		children: 'Operation completed successfully.'
	}
};

export const Warning: Story = {
	args: {
		title: 'Warning',
		type: NOTICE_TYPE_WARNING,
		children: 'Please be aware of this warning.'
	}
};

export const Error: Story = {
	args: {
		title: 'Error',
		type: NOTICE_TYPE_ERROR,
		children: 'An error has occurred.'
	}
};
