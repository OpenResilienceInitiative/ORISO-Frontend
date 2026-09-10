import * as React from 'react';
import { Alert, Box, Button, Chip, TextField, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import {
	apiChangeGroupChatParticipantRole,
	apiRemoveGroupChatParticipant,
	apiTransferGroupChatOwnership,
	GroupChatParticipantRole
} from '../../api/apiGroupChatRoles';

interface GroupChatRoleManagerProps {
	seriesId: number;
	currentUserId: string;
	participants: UserService.Schemas.GroupChatParticipantDTO[];
}

const EDITABLE_ROLES: GroupChatParticipantRole[] = [
	'CO_MODERATOR',
	'PARTICIPANT'
];

export const GroupChatRoleManager = ({
	seriesId,
	currentUserId,
	participants
}: GroupChatRoleManagerProps) => {
	const { t: translate } = useTranslation();
	const [items, setItems] = React.useState(participants);
	const [pendingId, setPendingId] = React.useState<string | null>(null);
	const [error, setError] = React.useState<
		'update' | 'transfer' | 'remove' | null
	>(null);
	const lastAppliedParticipants = React.useRef(participants);

	React.useEffect(() => {
		if (
			pendingId === null &&
			participants !== lastAppliedParticipants.current
		) {
			setItems(participants);
			lastAppliedParticipants.current = participants;
		}
	}, [participants, pendingId]);

	const currentUserIsOwner = items.some(
		(item) => item.consultantId === currentUserId && item.role === 'OWNER'
	);

	const updateRole = async (
		consultantId: string,
		role: GroupChatParticipantRole
	) => {
		setPendingId(consultantId);
		setError(null);
		try {
			await apiChangeGroupChatParticipantRole(
				seriesId,
				consultantId,
				role
			);
			setItems((current) =>
				current.map((item) =>
					item.consultantId === consultantId
						? { ...item, role }
						: item
				)
			);
		} catch {
			setError('update');
		} finally {
			setPendingId(null);
		}
	};

	const transferOwnership = async (consultantId: string) => {
		setPendingId(consultantId);
		setError(null);
		try {
			await apiTransferGroupChatOwnership(seriesId, consultantId);
			setItems((current) =>
				current.map((item) => {
					if (item.consultantId === currentUserId) {
						return { ...item, role: 'CO_MODERATOR' };
					}
					if (item.consultantId === consultantId) {
						return { ...item, role: 'OWNER' };
					}
					return item;
				})
			);
		} catch {
			setError('transfer');
		} finally {
			setPendingId(null);
		}
	};

	const removeParticipant = async (consultantId: string) => {
		setPendingId(consultantId);
		setError(null);
		try {
			await apiRemoveGroupChatParticipant(seriesId, consultantId);
			setItems((current) =>
				current.filter((item) => item.consultantId !== consultantId)
			);
		} catch {
			setError('remove');
		} finally {
			setPendingId(null);
		}
	};

	if (items.length === 0) {
		return null;
	}

	return (
		<Box sx={{ display: 'grid', gap: 2 }}>
			<Typography component="h3" variant="subtitle1">
				{translate('groupChat.roles.headline')}
			</Typography>
			{items.map((participant) => {
				const isSelf = participant.consultantId === currentUserId;
				const canManageParticipant =
					currentUserIsOwner &&
					!isSelf &&
					participant.role !== 'OWNER';
				const canEditRole = canManageParticipant;
				const canRemove = canManageParticipant;
				return (
					<Box
						sx={{
							display: 'flex',
							flexWrap: 'wrap',
							alignItems: 'center',
							gap: 1.5,
							py: 1.5,
							borderBottom: '1px solid',
							borderColor: 'divider'
						}}
						key={participant.consultantId}
					>
						<Typography
							sx={{ flex: '1 1 120px', overflowWrap: 'anywhere' }}
						>
							{participant.displayName}
						</Typography>
						{canEditRole ? (
							<>
								<TextField
									select
									size="small"
									sx={{
										'minWidth': 0,
										'maxWidth': '100%',
										'flex': '1 1 180px',
										'& .MuiInputBase-root': {
											minHeight: 44
										}
									}}
									SelectProps={{ native: true }}
									inputProps={{
										'aria-label': translate(
											'groupChat.roles.roleLabel',
											{ name: participant.displayName }
										)
									}}
									value={participant.role}
									disabled={pendingId !== null}
									onChange={(event) =>
										void updateRole(
											participant.consultantId,
											event.target
												.value as GroupChatParticipantRole
										)
									}
								>
									{EDITABLE_ROLES.map((role) => (
										<option value={role} key={role}>
											{translate(
												`groupChat.roles.${role}`
											)}
										</option>
									))}
								</TextField>
							</>
						) : (
							<Chip
								size="small"
								label={translate(
									`groupChat.roles.${participant.role}`
								)}
							/>
						)}
						{currentUserIsOwner && !isSelf && (
							<Button
								variant="text"
								sx={{
									textTransform: 'none',
									minHeight: 44,
									whiteSpace: 'normal',
									lineHeight: 1.4,
									maxWidth: '100%'
								}}
								size="small"
								type="button"
								disabled={pendingId !== null}
								onClick={() =>
									void transferOwnership(
										participant.consultantId
									)
								}
								aria-label={translate(
									'groupChat.roles.transferLabel',
									{ name: participant.displayName }
								)}
							>
								{translate('groupChat.roles.transfer')}
							</Button>
						)}
						{canRemove && (
							<Button
								variant="text"
								sx={{
									textTransform: 'none',
									minHeight: 44,
									whiteSpace: 'normal',
									lineHeight: 1.4,
									maxWidth: '100%'
								}}
								size="small"
								type="button"
								disabled={pendingId !== null}
								onClick={() =>
									void removeParticipant(
										participant.consultantId
									)
								}
								aria-label={`${translate(
									'groupChat.roles.remove'
								)} ${participant.displayName}`}
							>
								{translate('groupChat.roles.remove')}
							</Button>
						)}
					</Box>
				);
			})}
			{error && (
				<Alert severity="error">
					{translate(`groupChat.roles.${error}Error`)}
				</Alert>
			)}
		</Box>
	);
};
