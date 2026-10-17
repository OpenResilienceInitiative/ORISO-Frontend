import { useCallback, useContext, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
	NotificationsContext,
	SessionsDataContext,
	UPDATE_SESSIONS
} from '../../globalState';
import {
	apiCreateInternalSubsetChat,
	InternalSubsetChatError,
	INTERNAL_SUBSET_REASON,
	InternalSubsetReason
} from '../../api/apiCreateInternalSubsetChat';
import { apiGetSessionRoomsByRoomIds } from '../../api/apiGetSessionRooms';
import { getSessionNavigationPath } from '../sessionsListItem/sessionsListItemHelpers';

const SESSION_LIST_PATH = '/sessions/consultant/sessionView';

interface SubsetSubmitInput {
	/** The colleagues picked in the picker — and nobody else. */
	selectedIds: string[];
	agencyId: number;
	name: string;
}

/**
 * Submit path of the internal chat picker (#1772): a chat with chosen
 * colleagues is a dedicated, encrypted, members-only room, created (or, for
 * exactly the same people, reused) by the UserService. The room is opened once
 * it exists. A refusal keeps the counsellor on the picker with the reason, and
 * never falls back to a room that more people can see.
 */
export const useInternalSubsetChatSubmit = () => {
	const navigate = useNavigate();
	const { dispatch } = useContext(SessionsDataContext);
	const notifications = useContext(NotificationsContext);
	const { t: translate } = useTranslation();
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [errorReason, setErrorReason] = useState<InternalSubsetReason | null>(
		null
	);
	// Synchronous guard against a duplicate request: state updates are async,
	// so a rapid second click would slip through `isSubmitting`.
	const inFlightRef = useRef(false);

	const submit = useCallback(
		({ selectedIds, agencyId, name }: SubsetSubmitInput) => {
			if (inFlightRef.current) {
				return;
			}
			inFlightRef.current = true;
			setIsSubmitting(true);
			setErrorReason(null);

			apiCreateInternalSubsetChat({
				consultantIds: selectedIds,
				agencyId,
				topic: name.trim()
			})
				.then(async (room) => {
					try {
						const { sessions } = await apiGetSessionRoomsByRoomIds([
							room.matrixRoomId
						]);
						dispatch({ type: UPDATE_SESSIONS, sessions });
					} catch {
						// The room exists — a failed list refresh must not
						// strand the counsellor on the picker.
					}
					if (room.reused) {
						notifications?.addNotification({
							id: 'internalSubsetReused',
							notificationType: 'info',
							title: translate(
								'groupChat.internal.reusedNotice.title'
							),
							text: translate(
								'groupChat.internal.reusedNotice.text'
							),
							closeable: true,
							announce: 'status'
						});
					}
					navigate(
						getSessionNavigationPath({
							listPath: SESSION_LIST_PATH,
							sessionId: room.chatId,
							groupId: room.matrixRoomId,
							isGroup: true,
							isAsker: false,
							isEmptyEnquiry: false,
							tabSuffix: ''
						})
					);
				})
				.catch((error) => {
					setErrorReason(
						error instanceof InternalSubsetChatError
							? error.reason
							: INTERNAL_SUBSET_REASON.UNKNOWN
					);
				})
				.finally(() => {
					inFlightRef.current = false;
					setIsSubmitting(false);
				});
		},
		[dispatch, navigate, notifications, translate]
	);

	return {
		submit,
		isSubmitting,
		errorReason,
		clearError: () => setErrorReason(null)
	};
};
