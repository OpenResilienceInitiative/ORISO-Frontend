import type { MessageItem } from '../message/MessageItemComponent';
import { prepareMessages } from './sessionHelpers';
import { formatMatrixTimelineEvent } from '../../utils/matrixTimelineEventFormatter';
import { applyMessageEdits } from '../../utils/messageRelations';
import {
	applyCallLifecycleEdits,
	collapseCallLifecycleMessages
} from '../../utils/callLifecycleMessage';
import { ownReadStatus } from '../../utils/matrixReadReceipts';

/**
 * The one pipeline that turns raw Matrix room events into chat rows.
 *
 * Shared by the chat (`SessionStream`) and the Activity Timeline preview
 * (`ConversationPreview`, #420), so both show the same rows: edits folded,
 * one card per call, date dividers, relations kept.
 *
 * Every item carries the id of the room it came from: `MessageItem.rid` is
 * required, and `MessageItemComponent` compares `callLifecycle.roomRef` with
 * it to tell a call in this room from one in a side room.
 *
 * A call card is a series of REVISIONS: the lifecycle writes an edit per
 * membership change and a terminal one at the end.
 * `applyCallLifecycleEdits` folds those onto the original and
 * `collapseCallLifecycleMessages` keeps one card per call. Plain
 * `applyMessageEdits` alone DROPS every `m.replace` without folding it, so
 * every room — main, supervision, team — must run the full pipeline.
 *
 * Read status (FE#1802): an own message is `unread` until a reader's Matrix
 * read receipt covers it. `readers` names whose receipts count; without it,
 * any other member counts (see `ownReadStatus`).
 */
export const buildRoomTimeline = (
	events: any[],
	roomId: string | null | undefined,
	matrixRoom: any,
	encryptedFallbackText: string,
	readers?: string[]
): MessageItem[] => {
	const isUnread = ownReadStatus(events, matrixRoom, readers);
	return prepareMessages(
		collapseCallLifecycleMessages(
			applyMessageEdits(
				applyCallLifecycleEdits(
					(events || [])
						.map((event: any) => {
							const item = formatMatrixTimelineEvent(
								event,
								matrixRoom,
								encryptedFallbackText
							);
							const unread = isUnread(event);
							return item && unread !== undefined
								? { ...item, unread }
								: item;
						})
						.filter(Boolean)
						.map((item: any) =>
							roomId ? { ...item, rid: roomId } : item
						)
				)
			)
		)
	);
};
