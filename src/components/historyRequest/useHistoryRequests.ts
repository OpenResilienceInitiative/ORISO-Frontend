import { useCallback, useEffect, useState } from 'react';
import {
	MATRIX_HISTORY_REQUEST_PENDING_EVENT,
	MATRIX_HISTORY_REQUEST_RESOLVED_EVENT,
	matrixRoomHistoryKeyTransfer,
	PendingHistoryRequest
} from '../../services/matrixRoomHistoryKeyTransfer';

/**
 * The requests for the history of one conversation that wait for this
 * person's decision. The list is read from the key-transfer service and
 * refreshed whenever it announces a new or a resolved request.
 */
export const useHistoryRequests = (roomId?: string | null) => {
	const read = useCallback(
		() =>
			roomId
				? matrixRoomHistoryKeyTransfer.getPendingApprovals(roomId)
				: [],
		[roomId]
	);
	const [requests, setRequests] = useState<PendingHistoryRequest[]>(read);

	useEffect(() => {
		const refresh = () => setRequests(read());
		refresh();
		window.addEventListener(MATRIX_HISTORY_REQUEST_PENDING_EVENT, refresh);
		window.addEventListener(MATRIX_HISTORY_REQUEST_RESOLVED_EVENT, refresh);
		return () => {
			window.removeEventListener(
				MATRIX_HISTORY_REQUEST_PENDING_EVENT,
				refresh
			);
			window.removeEventListener(
				MATRIX_HISTORY_REQUEST_RESOLVED_EVENT,
				refresh
			);
		};
	}, [read]);

	return {
		requests,
		approve: (requestId: string) =>
			matrixRoomHistoryKeyTransfer.approveRequest(requestId),
		decline: (requestId: string) =>
			matrixRoomHistoryKeyTransfer.declineRequest(requestId)
	};
};
