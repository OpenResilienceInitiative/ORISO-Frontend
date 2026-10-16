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
	const [failedId, setFailedId] = useState<string | null>(null);

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
					failed={failedId === request.requestId}
					onDecline={() => decline(request.requestId)}
					onApprove={() => {
						setBusyIds((ids) =>
							new Set(ids).add(request.requestId)
						);
						setFailedId(null);
						void approve(request.requestId)
							.then((sent) => {
								if (!sent) setFailedId(request.requestId);
							})
							.catch(() => setFailedId(request.requestId))
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
