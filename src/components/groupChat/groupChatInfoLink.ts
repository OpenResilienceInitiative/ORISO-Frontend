import { generatePath } from 'react-router-dom';

/**
 * Path of a group's Chat-Info ("Informationen & Einstellungen"), shared by
 * the session menu and the member row in the chat header (#107). Empty for
 * a chat without a Matrix room.
 */
export const getGroupChatInfoLink = (
	listPath: string,
	matrixRoomId: string | undefined,
	chatId: number | string,
	sessionListTab: string
): string =>
	matrixRoomId
		? generatePath(
				`${listPath}/:groupId/:id/:subRoute?/:extraPath?${sessionListTab}`,
				{
					groupId: matrixRoomId,
					id: String(chatId),
					subRoute: 'groupChatInfo'
				}
			)
		: '';
