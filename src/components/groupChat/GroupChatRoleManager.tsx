import * as React from 'react';
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
		<div className="groupChatInfo__roles">
			<h4>{translate('groupChat.roles.headline')}</h4>
			{items.map((participant) => {
				const isSelf = participant.consultantId === currentUserId;
				const canManageParticipant =
					currentUserIsOwner &&
					!isSelf &&
					participant.role !== 'OWNER';
				const canEditRole = canManageParticipant;
				const canRemove = canManageParticipant;
				return (
					<div
						className="groupChatInfo__roleRow"
						key={participant.consultantId}
					>
						<span>{participant.displayName}</span>
						{canEditRole ? (
							<>
								<select
									aria-label={translate(
										'groupChat.roles.roleLabel',
										{ name: participant.displayName }
									)}
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
								</select>
							</>
						) : (
							<span>
								{translate(
									`groupChat.roles.${participant.role}`
								)}
							</span>
						)}
						{currentUserIsOwner && !isSelf && (
							<button
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
							</button>
						)}
						{canRemove && (
							<button
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
							</button>
						)}
					</div>
				);
			})}
			{error && (
				<p role="alert">{translate(`groupChat.roles.${error}Error`)}</p>
			)}
		</div>
	);
};
