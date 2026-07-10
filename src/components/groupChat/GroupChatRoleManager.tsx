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

const ROLES: GroupChatParticipantRole[] = [
	'OWNER',
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
	const [error, setError] = React.useState(false);

	React.useEffect(() => setItems(participants), [participants]);

	const currentUserIsOwner = items.some(
		(item) => item.consultantId === currentUserId && item.role === 'OWNER'
	);

	const updateRole = async (
		consultantId: string,
		role: GroupChatParticipantRole
	) => {
		setPendingId(consultantId);
		setError(false);
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
			setError(true);
		} finally {
			setPendingId(null);
		}
	};

	const transferOwnership = async (consultantId: string) => {
		setPendingId(consultantId);
		setError(false);
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
			setError(true);
		} finally {
			setPendingId(null);
		}
	};

	const removeParticipant = async (consultantId: string) => {
		setPendingId(consultantId);
		setError(false);
		try {
			await apiRemoveGroupChatParticipant(seriesId, consultantId);
			setItems((current) =>
				current.filter((item) => item.consultantId !== consultantId)
			);
		} catch {
			setError(true);
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
				const canRemove =
					currentUserIsOwner &&
					!isSelf &&
					participant.role !== 'OWNER';
				return (
					<div
						className="groupChatInfo__roleRow"
						key={participant.consultantId}
					>
						<span>{participant.displayName}</span>
						{currentUserIsOwner && !isSelf ? (
							<>
								<select
									aria-label={`Role for ${participant.displayName}`}
									value={participant.role}
									disabled={
										pendingId === participant.consultantId
									}
									onChange={(event) =>
										void updateRole(
											participant.consultantId,
											event.target
												.value as GroupChatParticipantRole
										)
									}
								>
									{ROLES.map((role) => (
										<option value={role} key={role}>
											{translate(
												`groupChat.roles.${role}`
											)}
										</option>
									))}
								</select>
								<button
									type="button"
									disabled={
										pendingId === participant.consultantId
									}
									onClick={() =>
										void transferOwnership(
											participant.consultantId
										)
									}
									aria-label={`${translate(
										'groupChat.roles.transfer'
									)} ${participant.displayName}`}
								>
									{translate('groupChat.roles.transfer')}
								</button>
								{canRemove && (
									<button
										type="button"
										disabled={
											pendingId ===
											participant.consultantId
										}
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
							</>
						) : (
							<span>
								{translate(
									`groupChat.roles.${participant.role}`
								)}
							</span>
						)}
					</div>
				);
			})}
			{error && (
				<p role="alert">{translate('groupChat.roles.updateError')}</p>
			)}
		</div>
	);
};
