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
	/**
	 * Called once the session list has been refreshed, with the Series id of
	 * the chat just saved (null when the refresh did not return it). Return
	 * `true` to stay on the screen — e.g. to show the share dialog (#1499) —
	 * and call `leave()` when done; otherwise the hook navigates as before.
	 */
	holdAfterSuccess?: (saved: { seriesId: number | null }) => boolean;
}

const SESSION_VIEW_PATH = '/sessions/consultant/sessionView';

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
			{ onSuccess, groupChatId, holdAfterSuccess }: SubmitOptions = {}
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
					let seriesId: number | null = null;
					return apiGetSessionRoomsByRoomIds([response.matrixRoomId])
						.then(({ sessions }) => {
							dispatch({
								type: UPDATE_SESSIONS,
								sessions: sessions
							});
							const saved =
								sessions?.find(
									(session) =>
										session.chat?.matrixRoomId ===
										response.matrixRoomId
								) ?? sessions?.[0];
							seriesId = saved?.chat?.id ?? null;
						})
						.catch(() => {
							// The chat was created — a failed list refresh must
							// not strand the user on the create screen.
						})
						.finally(() => {
							if (holdAfterSuccess?.({ seriesId })) {
								return;
							}
							navigate(SESSION_VIEW_PATH);
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
		/** Leave the create screen after a held success (see holdAfterSuccess). */
		leave: () => navigate(SESSION_VIEW_PATH),
		isSubmitting,
		hasError,
		clearError: () => setHasError(false)
	};
};
