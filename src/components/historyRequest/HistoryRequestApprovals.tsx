import * as React from 'react';
import { useState } from 'react';
import { HistoryRequestCard } from './HistoryRequestCard';
import { useHistoryRequests } from './useHistoryRequests';

/** The waiting history requests of the open conversation, one card each. */
export const HistoryRequestApprovals: React.FC<{ roomId?: string | null }> = ({
	roomId
}) => {
	const { requests, approve, decline } = useHistoryRequests(roomId);
	const [busyIds, setBusyIds] = useState<ReadonlySet<string>>(new Set());
	const [failedIds, setFailedIds] = useState<ReadonlySet<string>>(new Set());
	const mark = (id: string, on: boolean) =>
		setFailedIds((ids) => {
			const next = new Set(ids);
			if (on) next.add(id);
			else next.delete(id);
			return next;
		});

	if (requests.length === 0) return null;
	return (
		<>
			{requests.map((request) => (
				<HistoryRequestCard
					key={request.requestId}
					reason={request.reason}
					requesterUserId={request.requesterUserId}
					requesterDeviceId={request.requesterDeviceId}
					receivedAt={request.receivedAt}
					busy={busyIds.has(request.requestId)}
					failed={failedIds.has(request.requestId)}
					onDecline={() => decline(request.requestId)}
					onApprove={() => {
						setBusyIds((ids) =>
							new Set(ids).add(request.requestId)
						);
						mark(request.requestId, false);
						void approve(request.requestId)
							.then((sent) => {
								if (!sent) mark(request.requestId, true);
							})
							.catch(() => mark(request.requestId, true))
							.finally(() =>
								setBusyIds((ids) => {
									const next = new Set(ids);
									next.delete(request.requestId);
									return next;
								})
							);
					}}
				/>
			))}
		</>
	);
};
