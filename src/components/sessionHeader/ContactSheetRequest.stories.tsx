import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { ContactSheetRequest } from './ContactSheetRequest';
import { ChatMenuDropdown } from '../chatMenuDropdown/ChatMenuDropdown';

const meta: Meta<typeof ContactSheetRequest> = {
	title: 'Session/Contact sheet request',
	component: ContactSheetRequest,
	args: { sessionId: 42, email: 'seeker@example.org' },
	decorators: [
		(Story) => (
			<ChatMenuDropdown style={{ maxWidth: 375 }}>
				<Story />
			</ChatMenuDropdown>
		)
	]
};

export default meta;
type Story = StoryObj<typeof ContactSheetRequest>;

export const WithEmail: Story = {};
export const MissingEmail: Story = { args: { email: undefined } };
