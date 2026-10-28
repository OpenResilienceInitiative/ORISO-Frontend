import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, waitFor, within } from 'storybook/test';
import { AUTHORITIES } from '../../globalState';
import { MessageItemComponent } from './MessageItemComponent';
import { MessageContextShell } from './messageStoryShell';
import {
	MOCK_ASKER_MATRIX_ID,
	mockActiveSession1on1,
	mockMessageItemComponentProps,
	mockUserData
} from './MessageItemComponent.mocks';

const ALIAS = 'katze_mika_1234';
const EVENT_NAME = 'Original Matrix event name';
const renderSession =
	(
		assigned: boolean,
		own: boolean,
		modality: 'LIVE_CHAT' | 'AGENCY_COUNSELLING'
	) =>
	() => {
		const session = mockActiveSession1on1();
		return (
			<div>
				<p style={{ padding: 12, fontSize: 14 }}>
					Local Storybook fixture — {assigned ? 'after' : 'before'}{' '}
					this session's alias assignment. The historical message
					event is unchanged.
				</p>
				<MessageContextShell
					activeSession={{
						...session,
						item: { ...session.item, conversationType: modality },
						user: {
							...session.user,
							displayName: assigned ? ALIAS : ''
						}
					}}
					userData={mockUserData(
						own
							? {
									userId: MOCK_ASKER_MATRIX_ID,
									userName: 'unchanged_login_1234',
									displayName:
										'Account name from another session',
									grantedAuthorities: [
										AUTHORITIES.ASKER_DEFAULT
									]
								}
							: {}
					)}
				>
					<MessageItemComponent
						{...mockMessageItemComponentProps({
							userId: MOCK_ASKER_MATRIX_ID,
							username: 'unchanged_login_1234',
							displayName: EVENT_NAME,
							message:
								'The name above this message belongs to this conversation.',
							isMyMessage: own
						})}
					/>
				</MessageContextShell>
			</div>
		);
	};
const meta = {
	title: 'Messages/Session alias',
	component: MessageItemComponent,
	args: mockMessageItemComponentProps(),
	parameters: { layout: 'padded' },
	tags: ['autodocs']
} satisfies Meta<typeof MessageItemComponent>;
export default meta;
type Story = StoryObj<typeof meta>;
const assignedAlias = async ({
	canvasElement
}: {
	canvasElement: HTMLElement;
}) => {
	const canvas = within(canvasElement);
	await waitFor(() => expect(canvas.getByText(ALIAS)).toBeVisible());
	await expect(canvas.queryByText(EVENT_NAME)).toBeNull();
};
export const BeforeAssignment: Story = {
	render: renderSession(false, false, 'AGENCY_COUNSELLING'),
	play: async ({ canvasElement }) => {
		await waitFor(() =>
			expect(within(canvasElement).getByText(EVENT_NAME)).toBeVisible()
		);
	}
};
export const AfterAssignment: Story = {
	render: renderSession(true, false, 'AGENCY_COUNSELLING'),
	play: assignedAlias
};
export const IncomingLiveChat: Story = {
	render: renderSession(true, false, 'LIVE_CHAT'),
	play: assignedAlias
};
export const OwnLiveChat: Story = {
	render: renderSession(true, true, 'LIVE_CHAT'),
	play: assignedAlias
};
export const OwnCounselling: Story = {
	render: renderSession(true, true, 'AGENCY_COUNSELLING'),
	play: assignedAlias
};
