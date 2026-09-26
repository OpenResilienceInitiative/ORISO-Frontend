import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { ContactSheetRequest } from './ContactSheetRequest';
import './sessionHeader.styles.scss';

const meta: Meta<typeof ContactSheetRequest> = {
	title: 'Session/Contact sheet request',
	component: ContactSheetRequest,
	args: { sessionId: 42, email: 'seeker@example.org' },
	decorators: [
		(Story) => (
			<div style={{ maxWidth: 375, padding: 16, background: '#fff' }}>
				<Story />
			</div>
		)
	]
};

export default meta;
type Story = StoryObj<typeof ContactSheetRequest>;

export const WithEmail: Story = {};
export const MissingEmail: Story = { args: { email: undefined } };
