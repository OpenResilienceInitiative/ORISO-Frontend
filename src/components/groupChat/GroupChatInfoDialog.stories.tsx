import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Box, Button, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { GroupChatInfoDialog } from './GroupChatInfoDialog';
import { GroupChatRoleManager } from './GroupChatRoleManager';
import { GroupChatCopyLinks } from './GroupChatCopyLinks';
import { GroupChatCalendarMenu } from './GroupChatCalendarMenu';
import { phone390Globals } from '../message/messageStoryShell';

const people: UserService.Schemas.GroupChatParticipantDTO[] = [
	{ consultantId: 'owner', displayName: 'Anna Beispiel', role: 'OWNER' },
	{ consultantId: 'co', displayName: 'Samira Muster', role: 'CO_MODERATOR' },
	{
		consultantId: 'participant',
		displayName: 'Alex Beispiel',
		role: 'PARTICIPANT'
	}
];
function Preview({
	owner = false,
	empty = false,
	long = false,
	kind = 'circle'
}: {
	owner?: boolean;
	empty?: boolean;
	long?: boolean;
	kind?: 'circle' | 'team';
}) {
	const { t } = useTranslation();
	const [open, setOpen] = useState(true);
	const title =
		kind === 'team'
			? 'Abstimmung im Beratungsteam'
			: long
				? 'Gesprächskreis für Familien und Angehörige – gemeinsam neue Perspektiven entwickeln'
				: 'Gemeinsam den Alltag meistern';
	const rows = [
		['topic', title],
		['startDate', '09.09.2026'],
		['startTime', '16:00'],
		['duration', '60 min'],
		['repetition.label', t('groupChat.info.settings.repetition.weekly')],
		['agency', 'Beratungsstelle Mitte']
	];
	return (
		<Box sx={{ p: 3, minHeight: '100vh', bgcolor: 'var(--m3-surface)' }}>
			<Typography variant="h6">{title}</Typography>
			<Button onClick={() => setOpen(true)}>
				{t('chatFlyout.groupChatInfo')}
			</Button>
			{open && (
				<GroupChatInfoDialog
					kind={kind}
					isOwner={owner}
					title={title}
					active
					onClose={() => setOpen(false)}
					settings={rows.map(([key, value]) => ({
						label: t(`groupChat.info.settings.${key}`),
						value
					}))}
					participants={
						empty ? (
							<Typography variant="body2">
								{t('groupChat.info.subscribers.empty')}
							</Typography>
						) : (
							<GroupChatRoleManager
								seriesId={42}
								currentUserId={owner ? 'owner' : 'participant'}
								participants={people}
							/>
						)
					}
					invitation={<GroupChatCopyLinks seriesId={42} />}
					actions={
						<GroupChatCalendarMenu
							start={new Date('2026-09-09T14:00:00Z')}
							durationMinutes={60}
							eventId={42}
						/>
					}
				/>
			)}
		</Box>
	);
}
const meta = {
	title: 'GroupChat/ChatInfoDialog',
	component: Preview,
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component:
					'Chat info as the existing M3Dialog over a session. Uses production invitation, role and calendar components. Synthetic participants; role mutations require the app API. The supplied Figma node 7633:34734 is the format picker, not a chat-info specification.'
			}
		}
	}
} satisfies Meta<typeof Preview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Participant: Story = {};
export const Owner: Story = { args: { owner: true } };
export const Empty: Story = { args: { empty: true } };
export const Mobile: Story = { globals: phone390Globals };
export const LongTitle: Story = { args: { long: true } };

export const InternalGroup: Story = { args: { kind: 'team' } };
