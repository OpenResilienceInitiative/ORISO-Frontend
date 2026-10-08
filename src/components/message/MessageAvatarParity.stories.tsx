import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, waitFor, within } from 'storybook/test';
import { MessageItemComponent } from './MessageItemComponent';
import {
	MessageContextShell,
	desktop1440Globals,
	tablet834Globals,
	phone390Globals
} from './messageStoryShell';
import {
	mockActiveSessionGroup,
	mockMessageItemComponentProps,
	mockUserData
} from './MessageItemComponent.mocks';
import './message.styles.scss';

const author = '@author:example.org';
const AvatarChat = ({ compact = false }: { compact?: boolean }) => (
	<MessageContextShell
		compact={compact}
		activeSession={mockActiveSessionGroup()}
		userData={mockUserData({ avatarKind: 'ICON', avatarId: 'fox' })}
		avatarMembers={[
			{
				_id: '@assigned:example.org',
				avatarKind: 'ICON',
				avatarId: 'fox'
			},
			{ _id: author, avatarKind: 'ICON', avatarId: 'owl' }
		]}
	>
		<MessageItemComponent
			{...mockMessageItemComponentProps({
				userId: author,
				username: 'Alexandra',
				displayName: 'Alexandra Charlotte Beispiel-Mustermann',
				message:
					'Der ausgewählte Avatar bleibt in diesem Gruppenchat bei der richtigen Person.'
			})}
		/>
		<MessageItemComponent
			{...mockMessageItemComponentProps({
				isMyMessage: true,
				userId: '@self:example.org',
				message:
					'My selected avatar also stays consistent when I reply.'
			})}
		/>
	</MessageContextShell>
);
const meta = {
	title: 'Chat/Avatar parity',
	component: AvatarChat,
	tags: ['autodocs'],
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await waitFor(() =>
			expect(
				canvas
					.getAllByTestId('counsellor-avatar')
					.map((el) => el.getAttribute('data-avatar-id'))
			).toEqual(['owl', 'fox'])
		);
	}
} satisfies Meta<typeof AvatarChat>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Desktop: Story = { globals: desktop1440Globals };
export const Tablet: Story = { globals: tablet834Globals };
export const Mobile: Story = {
	args: { compact: true },
	globals: phone390Globals
};
export const EnglishStress: Story = {
	globals: { ...desktop1440Globals, locale: 'en' }
};
