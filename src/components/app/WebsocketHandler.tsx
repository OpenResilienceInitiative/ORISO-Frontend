import { useEffect } from 'react';
import { matrixLiveEventBridge } from '../../services/matrixLiveEventBridge';
import { messageEventEmitter } from '../../services/messageEventEmitter';

/** Matrix refresh metadata only; the persisted feed owns announcements. */
export const WebsocketHandler = () => {
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
		};
		matrixLiveEventBridge.on('directMessage', onDirectMessage);
		return () => {
			matrixLiveEventBridge.off('directMessage', onDirectMessage);
		};
	}, []);
	return null;
};
