/**
 * How an appointment opens its conversation. The calendar ("Zum Chat",
 * "Video-Call starten") and the overview card ("Ihre nächsten Termine")
 * open it the same way: by the conversation's room, looked up by the
 * appointment's session id when the page does not hold the conversation.
 */
import { apiGetSessionRoomBySessionId } from '../../api/apiGetSessionRooms';
import { resolveSessionRoomRouteId } from '../../utils/matrixRoomUtils';

/** The route of an appointment's conversation. */
export const appointmentConversationPath = (
	roomId: string,
	sessionId: number,
	consultant: boolean
) =>
	`${consultant ? '/sessions/consultant/sessionView' : '/sessions/user/view'}/${roomId}/${sessionId}`;

/**
 * The room of the conversation with this session id. Rejects when there is
 * none, so the caller can say so (review 4577642137).
 */
export const appointmentRoomOf = (sessionId: number): Promise<string> =>
	apiGetSessionRoomBySessionId(sessionId).then(({ sessions }) => {
		const roomId = resolveSessionRoomRouteId(sessions?.[0]?.session);
		if (!roomId) throw new Error('conversation without room');
		return roomId;
	});
