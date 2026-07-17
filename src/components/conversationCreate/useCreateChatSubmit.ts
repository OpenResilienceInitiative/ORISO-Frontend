import { useCallback, useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
	SessionsDataContext,
	UPDATE_SESSIONS
} from '../../globalState';
import {
	apiCreateGroupChat,
	groupChatSettings
} from '../../api/apiGroupChatSettings';
import { apiGetSessionRoomsByGroupIds } from '../../api/apiGetSessionRooms';

/**
 * Shared submit path for both conversation formats. Creates the chat via
 * UserService, refreshes the session list and navigates back to the session
 * view. The caller builds the format-specific payload:
 * - internal chat: repetitive false, no repeatCount (a repeatCount would
 *   flip the modality heuristic in getModality to SELF_HELP)
 * - Gesprächskreis: series payload via buildGroupChatSeriesRequest
 */
export const useCreateChatSubmit = () => {
	const navigate = useNavigate();
	const { dispatch } = useContext(SessionsDataContext);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [hasError, setHasError] = useState(false);

	const submit = useCallback(
		(payload: groupChatSettings, { onSuccess }: { onSuccess?: () => void } = {}) => {
			if (isSubmitting) {
				return;
			}
			setIsSubmitting(true);
			setHasError(false);
			apiCreateGroupChat(payload)
				.then((response) => {
					onSuccess?.();
					return apiGetSessionRoomsByGroupIds([response.groupId])
						.then(({ sessions }) => {
							dispatch({
								type: UPDATE_SESSIONS,
								sessions: sessions
							});
						})
						.catch(() => {
							// The chat was created — a failed list refresh must
							// not strand the user on the create screen.
						})
						.finally(() => {
							navigate('/sessions/consultant/sessionView');
						});
				})
				.catch(() => {
					setHasError(true);
				})
				.finally(() => {
					setIsSubmitting(false);
				});
		},
		[dispatch, isSubmitting, navigate]
	);

	return { submit, isSubmitting, hasError, clearError: () => setHasError(false) };
};
