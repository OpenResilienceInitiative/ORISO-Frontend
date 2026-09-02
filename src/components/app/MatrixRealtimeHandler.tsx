import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAppConfig } from '../../hooks/useAppConfig';
import { matrixLiveEventBridge } from '../../services/matrixLiveEventBridge';
import { messageEventEmitter } from '../../services/messageEventEmitter';
import {
	isBrowserNotificationTypeEnabled,
	sendNotification
} from '../../utils/notificationHelpers';

export const MatrixRealtimeHandler = () => {
	const { t: translate } = useTranslation();
	const navigate = useNavigate();
	const { releaseToggles } = useAppConfig();
	const [newDirectMessage, setNewDirectMessage] = useState(false);

	useEffect(() => {
		const handleDirectMessage = (event: {
			roomId?: string;
			timestamp?: number;
			isOwnMessage?: boolean;
		}) => {
			messageEventEmitter.emit({
				roomId: event.roomId,
				timestamp: event.timestamp
			});
			if (!event.isOwnMessage) {
				setNewDirectMessage(true);
			}
		};

		matrixLiveEventBridge.on('directMessage', handleDirectMessage);
		return () => {
			matrixLiveEventBridge.off('directMessage', handleDirectMessage);
		};
	}, []);

	useEffect(() => {
		if (!newDirectMessage) {
			return;
		}

		setNewDirectMessage(false);
		messageEventEmitter.emit({});

		if (
			!releaseToggles.enableNewNotifications ||
			isBrowserNotificationTypeEnabled('newMessage')
		) {
			sendNotification(translate('notifications.message.new'), {
				family: 'messages',
				eventType: 'message.new',
				onclick: () => {
					navigate('/sessions/consultant/sessionView');
				}
			});
		}
	}, [newDirectMessage]); // eslint-disable-line react-hooks/exhaustive-deps

	return null;
};
