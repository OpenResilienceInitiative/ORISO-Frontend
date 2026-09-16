import * as React from 'react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { sendNotification } from '../../utils/notificationHelpers';
import { useTranslation } from 'react-i18next';
import { matrixLiveEventBridge } from '../../services/matrixLiveEventBridge';
import { messageEventEmitter } from '../../services/messageEventEmitter';

/**
 * Bridges real-time Matrix events into the app-wide message event emitter
 * and the browser notification.
 *
 * The STOMP/SockJS connection to the retired LiveService used to live here.
 * That service is gone from the platform (no chart, no ingress), so the
 * socket only ever hit the SPA fallback: `/service/live/info` answered with
 * `index.html`, SockJS threw `SyntaxError: Unexpected token '<'`, the
 * transports 404ed and the client gave up after two attempts. The remaining
 * LiveService event types (`newAnonymousEnquiry`, `anonymousConversation-
 * Finished`, `videoCallRequest`) had no sender any more; their Matrix-side
 * replacements are tracked separately.
 */
export const WebsocketHandler = () => {
	const { t: translate } = useTranslation();
	const navigate = useNavigate();
	const [newDirectMessage, setNewDirectMessage] = useState<boolean>(false);

	useEffect(() => {
		const handleMatrixDirectMessage = (event: any) => {
			messageEventEmitter.emit({
				roomId: event?.roomId,
				timestamp: event?.timestamp
			});
			if (!event?.isOwnMessage) {
				setNewDirectMessage(true);
			}
		};

		matrixLiveEventBridge.on('directMessage', handleMatrixDirectMessage);

		return () => {
			matrixLiveEventBridge.off(
				'directMessage',
				handleMatrixDirectMessage
			);
		};
	}, []);

	useEffect(() => {
		if (newDirectMessage) {
			setNewDirectMessage(false);

			// Refresh open sessions
			messageEventEmitter.emit({});

			// Whether the user wants this popup is `sendNotification`'s call
			// alone (#1211) — it knows the family, the event type and which
			// settings panel is actually routed. Repeating the check here is
			// what broke new-message popups for the cross-device panel.
			sendNotification(translate('notifications.message.new'), {
				// Route the banner to its config row (#576 harmonised
				// model): Gespräch → Standard-Benachrichtigung.
				family: 'messages',
				eventType: 'message.new',
				onclick: () => {
					navigate(`/sessions/consultant/sessionView`);
				}
			});
		}
	}, [newDirectMessage]); // eslint-disable-line react-hooks/exhaustive-deps

	return <></>;
};
