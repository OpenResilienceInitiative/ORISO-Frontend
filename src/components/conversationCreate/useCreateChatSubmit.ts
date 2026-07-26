import { useCallback, useContext, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SessionsDataContext, UPDATE_SESSIONS } from '../../globalState';
import {
	apiCreateGroupChat,
	apiUpdateGroupChat,
	groupChatSettings
} from '../../api/apiGroupChatSettings';
import { apiGetSessionRoomsByRoomIds } from '../../api/apiGetSessionRooms';

/**
 * Shared submit path for both conversation formats. Creates the chat via
 * UserService, refreshes the session list and navigates back to the session
 * view. The caller builds the format-specific payload:
 * - internal chat: repetitive false, no repeatCount (a repeatCount would
 *   flip the modality heuristic in getModality to SELF_HELP)
 * - Gesprächskreis: series payload via buildGroupChatSeriesRequest
 *
 * Passing `groupChatId` in the submit options routes to apiUpdateGroupChat
 * (edit mode) instead of apiCreateGroupChat.
 */
interface SubmitOptions {
	onSuccess?: () => void;
	/** When set, the payload updates this existing chat instead of creating one. */
	groupChatId?: number;
}

export const useCreateChatSubmit = () => {
	const navigate = useNavigate();
	const { dispatch } = useContext(SessionsDataContext);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [hasError, setHasError] = useState(false);
	// Synchronous guard against duplicate POST/PUTs: React state updates are
	// async, so a rapid second click can slip through the `isSubmitting` check
	// before the re-render. The ref flips immediately and is the source of
	// truth for the in-flight lock.
	const inFlightRef = useRef(false);

	const submit = useCallback(
		(
			payload: groupChatSettings,
			{ onSuccess, groupChatId }: SubmitOptions = {}
		) => {
			if (inFlightRef.current) {
				return;
			}
			inFlightRef.current = true;
			setIsSubmitting(true);
			setHasError(false);
			const request =
				groupChatId != null
					? apiUpdateGroupChat(groupChatId, payload)
					: apiCreateGroupChat(payload);
			request
				.then((response) => {
					onSuccess?.();
					return apiGetSessionRoomsByRoomIds([response.matrixRoomId])
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
					inFlightRef.current = false;
					setIsSubmitting(false);
				});
		},
		[dispatch, navigate]
	);

	return {
		submit,
		isSubmitting,
		hasError,
		clearError: () => setHasError(false)
	};
};
