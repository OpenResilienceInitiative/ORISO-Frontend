import * as React from 'react';
import { useState } from 'react';
import { HistoryRequestCard } from './HistoryRequestCard';
import { useHistoryRequests } from './useHistoryRequests';

/** The waiting history requests of the open conversation, one card each. */
export const HistoryRequestApprovals: React.FC<{ roomId?: string | null }> = ({
	roomId
}) => {
	const { requests, approve, decline } = useHistoryRequests(roomId);
	const [busyId, setBusyId] = useState<string | null>(null);
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
					busy={busyId === request.requestId}
					failed={failedId === request.requestId}
					onDecline={() => decline(request.requestId)}
					onApprove={() => {
						setBusyId(request.requestId);
						setFailedId(null);
						void approve(request.requestId)
							.then((sent) => {
								if (!sent) setFailedId(request.requestId);
							})
							.catch(() => setFailedId(request.requestId))
							.finally(() => setBusyId(null));
					}}
				/>
			))}
		</>
	);
};
