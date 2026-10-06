import { useEffect, useState } from 'react';
import { matrixLiveEventBridge } from '../../services/matrixLiveEventBridge';
import { messageEventEmitter } from '../../services/messageEventEmitter';

/** Matrix refresh metadata only; the persisted feed owns announcements. */
export const MatrixRealtimeHandler = () => {
	const [incomingRefreshPending, setIncomingRefreshPending] = useState(false);
	useEffect(() => {
		const onDirectMessage = (event: {
			roomId?: string;
			eventId?: string;
			timestamp?: number;
			isOwnMessage?: boolean;
		}) => {
			messageEventEmitter.emit({
				roomId: event?.roomId,
				matrixEventId: event?.eventId,
				isOwnMessage: event?.isOwnMessage === true,
				timestamp: event?.timestamp
			});
			if (!event?.isOwnMessage) setIncomingRefreshPending(true);
		};
		matrixLiveEventBridge.on('directMessage', onDirectMessage);
		return () => {
			matrixLiveEventBridge.off('directMessage', onDirectMessage);
		};
	}, []);
	useEffect(() => {
		if (!incomingRefreshPending) return;
		setIncomingRefreshPending(false);
		// Keep dev's deferred refresh for other active timeline consumers.
		// The persisted feed still owns notification announcements.
		messageEventEmitter.emit({});
	}, [incomingRefreshPending]);

	return null;
};
