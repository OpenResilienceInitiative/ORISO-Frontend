import { useEffect } from 'react';
import { matrixLiveEventBridge } from '../../services/matrixLiveEventBridge';
import { messageEventEmitter } from '../../services/messageEventEmitter';
import { bindFeedUpdateSignal } from '../../services/feedUpdateSignalBridge';

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
		const unbindFeedSignal = bindFeedUpdateSignal();
		return () => {
			matrixLiveEventBridge.off('directMessage', onDirectMessage);
			unbindFeedSignal();
		};
	}, []);
	return null;
};
