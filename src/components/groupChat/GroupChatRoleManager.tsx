import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
	Avatar,
	Box,
	Button,
	List,
	ListItem,
	ListItemAvatar,
	NativeSelect,
	Typography
} from '@mui/material';
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
	/** Chat-Info M3 draws the heading on its section card (#1499). */
	hideHeadline?: boolean;
}

const avatarSx = {
	width: 40,
	height: 40,
	fontSize: 16,
	fontWeight: 500,
	bgcolor: 'var(--m3-surface-container-highest)',
	color: 'var(--m3-on-surface-variant)'
};

const textActionSx = {
	textTransform: 'none',
	borderRadius: '20px',
	fontSize: 14,
	lineHeight: '20px',
	fontWeight: 500,
	color: 'var(--m3-primary)'
} as const;

const initialsOf = (name: string) =>
	name
		.split(/[\s_.-]+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((part) => part[0]?.toUpperCase() ?? '')
		.join('');

const EDITABLE_ROLES: GroupChatParticipantRole[] = [
	'CO_MODERATOR',
	'PARTICIPANT'
];

export const GroupChatRoleManager = ({
	seriesId,
	currentUserId,
	participants,
	hideHeadline = false
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
		<div className="groupChatInfo__roles">
			{!hideHeadline && <h4>{translate('groupChat.roles.headline')}</h4>}
			<List disablePadding>
				{items.map((participant) => {
					const isSelf = participant.consultantId === currentUserId;
					const canManageParticipant =
						currentUserIsOwner &&
						!isSelf &&
						participant.role !== 'OWNER';
					const canTransfer = currentUserIsOwner && !isSelf;
					return (
						<ListItem
							className="groupChatInfo__roleRow"
							key={participant.consultantId}
							sx={{
								px: 2,
								minHeight: 56,
								alignItems: 'flex-start',
								flexWrap: 'wrap'
							}}
						>
							<ListItemAvatar sx={{ mt: 0.5 }}>
								<Avatar sx={avatarSx} aria-hidden="true">
									{initialsOf(participant.displayName)}
								</Avatar>
							</ListItemAvatar>
							<Box
								sx={{
									flex: '1 1 160px',
									minWidth: 0,
									my: 0.75
								}}
							>
								<Typography
									component="span"
									sx={{
										display: 'block',
										fontSize: 16,
										lineHeight: '24px',
										color: 'var(--m3-on-surface)',
										overflowWrap: 'anywhere'
									}}
								>
									{participant.displayName}
								</Typography>
								{canManageParticipant ? (
									<NativeSelect
										disableUnderline
										value={participant.role}
										disabled={pendingId !== null}
										inputProps={{
											'aria-label': translate(
												'groupChat.roles.roleLabel',
												{
													name: participant.displayName
												}
											)
										}}
										onChange={(event) =>
											void updateRole(
												participant.consultantId,
												event.target
													.value as GroupChatParticipantRole
											)
										}
										sx={{
											fontSize: 14,
											lineHeight: '20px',
											color: 'var(--m3-on-surface-variant)'
										}}
									>
										{EDITABLE_ROLES.map((role) => (
											<option value={role} key={role}>
												{translate(
													`groupChat.roles.${role}`
												)}
											</option>
										))}
									</NativeSelect>
								) : (
									<Typography
										component="span"
										sx={{
											display: 'block',
											fontSize: 14,
											lineHeight: '20px',
											color: 'var(--m3-on-surface-variant)'
										}}
									>
										{translate(
											`groupChat.roles.${participant.role}`
										)}
									</Typography>
								)}
							</Box>
							{(canTransfer || canManageParticipant) && (
								<Box
									sx={{
										display: 'flex',
										flexWrap: 'wrap',
										gap: 0.5,
										pl: 7,
										width: '100%'
									}}
								>
									{canTransfer && (
										<Button
											variant="text"
											size="small"
											disabled={pendingId !== null}
											onClick={() =>
												void transferOwnership(
													participant.consultantId
												)
											}
											aria-label={translate(
												'groupChat.roles.transferLabel',
												{
													name: participant.displayName
												}
											)}
											sx={textActionSx}
										>
											{translate(
												'groupChat.roles.transfer'
											)}
										</Button>
									)}
									{canManageParticipant && (
										<Button
											variant="text"
											size="small"
											disabled={pendingId !== null}
											onClick={() =>
												void removeParticipant(
													participant.consultantId
												)
											}
											aria-label={`${translate(
												'groupChat.roles.remove'
											)} ${participant.displayName}`}
											sx={{
												...textActionSx,
												color: 'var(--m3-error)'
											}}
										>
											{translate(
												'groupChat.roles.remove'
											)}
										</Button>
									)}
								</Box>
							)}
						</ListItem>
					);
				})}
			</List>
			{error && (
				<Typography
					role="alert"
					sx={{
						px: 2,
						py: 1,
						fontSize: 14,
						lineHeight: '20px',
						color: 'var(--m3-error)'
					}}
				>
					{translate(`groupChat.roles.${error}Error`)}
				</Typography>
			)}
		</div>
	);
};
