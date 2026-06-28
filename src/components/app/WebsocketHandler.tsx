import * as React from 'react';
import { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Stomp } from '@stomp/stompjs';
import * as SockJS from 'sockjs-client';
import { endpoints } from '../../resources/scripts/endpoints';
import { getValueFromCookie } from '../sessionCookie/accessSessionCookie';
import {
	NOTIFICATION_TYPE_CALL,
	VideoCallRequestProps
} from '../incomingVideoCall/IncomingVideoCall';
import {
	NotificationsContext,
	NOTIFICATION_TYPE_SUCCESS,
	WebsocketConnectionDeactivatedContext
} from '../../globalState';
import {
	isBrowserNotificationTypeEnabled,
	sendNotification
} from '../../utils/notificationHelpers';
import { useTranslation } from 'react-i18next';
import { useAppConfig } from '../../hooks/useAppConfig';
import { matrixLiveEventBridge } from '../../services/matrixLiveEventBridge';
import { messageEventEmitter } from '../../services/messageEventEmitter';

interface WebsocketHandlerProps {
	disconnect: boolean;
}

export const WebsocketHandler = ({ disconnect }: WebsocketHandlerProps) => {
	const liveWebsocketDisabled =
		process.env.REACT_APP_DISABLE_LIVE_WEBSOCKET === '1';
	const { t: translate } = useTranslation();
	const navigate = useNavigate();
	const { releaseToggles } = useAppConfig();
	const [newStompDirectMessage, setNewStompDirectMessage] =
		useState<boolean>(false);
	const [newStompAnonymousEnquiry, setNewStompAnonymousEnquiry] =
		useState<boolean>(false);
	const [
		newStompAnonymousConversationFinished,
		setNewStompAnonymousConversationFinished
	] = useState<boolean>(false);
	const [newStompVideoCallRequest, setNewStompVideoCallRequest] =
		useState<VideoCallRequestProps>();
	const { addNotification } = useContext(NotificationsContext);
	const { setWebsocketConnectionDeactivated } = useContext(
		WebsocketConnectionDeactivatedContext
	);

	const stompClient = React.useMemo(
		() =>
			liveWebsocketDisabled
				? undefined
				: Stomp.over(function () {
						return new SockJS(endpoints.liveservice);
					}),
		[liveWebsocketDisabled]
	);

	let reconnectAttemptCount = 0;
	const RECONNECT_ATTEMPT_LIMIT = 2;
	const RECONNECT_DELAY = 5000;

	// DEV-NOTE: comment next line to activate debug mode (stomp logging) for development
	if (stompClient) {
		stompClient.debug = () => {};
	}

	useEffect(() => {
		if (!stompClient) {
			return;
		}

		// STOMP WebSocket setup (for LiveService)
		stompClient.beforeConnect = () => {
			stompClient.connectHeaders = {
				accessToken: getValueFromCookie('keycloak')
			};
			reconnectAttemptCount++;

			if (reconnectAttemptCount >= RECONNECT_ATTEMPT_LIMIT) {
				stompClient.deactivate();
				setWebsocketConnectionDeactivated(true);
			}
		};

		stompClient.onConnect = () => {};

		stompConnect();

		stompClient.onWebSocketClose = (message) => {
			// console.log('Closed', message);
		};

		stompClient.onWebSocketError = (error) => {
			// console.log('Error', error);
		};

		// MATRIX EVENT BRIDGE SETUP (for real-time Matrix events)
		// Listen to Matrix 'directMessage' events
		const handleMatrixDirectMessage = (event: any) => {
			// console.log('📬 Matrix directMessage event received:', event);
			messageEventEmitter.emit({
				roomId: event?.roomId,
				timestamp: event?.timestamp
			});
			if (!event?.isOwnMessage) {
				setNewStompDirectMessage(true);
			}
		};

		// Register Matrix event listeners
		matrixLiveEventBridge.on('directMessage', handleMatrixDirectMessage);

		// console.log('✅ WebsocketHandler: STOMP + Matrix event listeners registered');

		// Cleanup function
		return () => {
			// Unregister Matrix event listeners
			matrixLiveEventBridge.off(
				'directMessage',
				handleMatrixDirectMessage
			);
			// console.log('🧹 WebsocketHandler: Event listeners cleaned up');
		};
	}, []); // eslint-disable-line react-hooks/exhaustive-deps

	useEffect(() => {
		if (disconnect) {
			stompClient?.disconnect();
		}
	}, [stompClient, disconnect]);

	useEffect(() => {
		if (newStompDirectMessage) {
			setNewStompDirectMessage(false);

			// CRITICAL: Emit event to refresh open sessions
			// console.log('🔔 LiveService directMessage event - refreshing open sessions');
			messageEventEmitter.emit({});

			if (
				!releaseToggles.enableNewNotifications ||
				isBrowserNotificationTypeEnabled('newMessage')
			) {
				sendNotification(translate('notifications.message.new'), {
					onclick: () => {
						navigate(`/sessions/consultant/sessionView`);
					}
				});
			}
		}
	}, [newStompDirectMessage]); // eslint-disable-line react-hooks/exhaustive-deps

	useEffect(() => {
		if (newStompAnonymousEnquiry) {
			setNewStompAnonymousEnquiry(false);
			messageEventEmitter.emit({ refreshEnquiryList: true });
		}
	}, [newStompAnonymousEnquiry]); // eslint-disable-line react-hooks/exhaustive-deps

	useEffect(() => {
		if (newStompAnonymousConversationFinished) {
			setNewStompAnonymousConversationFinished(false);
			messageEventEmitter.emit({
				refreshEnquiryList: true,
				refreshSessionList: true
			});
			messageEventEmitter.emit({});
			addNotification({
				notificationType: NOTIFICATION_TYPE_SUCCESS,
				title: translate(
					'profile.notifications.conversationFinished.title'
				),
				text: translate(
					'profile.notifications.conversationFinished.description'
				)
			});
		}
	}, [newStompAnonymousConversationFinished]); // eslint-disable-line react-hooks/exhaustive-deps

	useEffect(() => {
		if (newStompVideoCallRequest) {
			addNotification({
				id: newStompVideoCallRequest.rcGroupId,
				notificationType: NOTIFICATION_TYPE_CALL,
				videoCall: newStompVideoCallRequest
			});
		}
	}, [newStompVideoCallRequest]); // eslint-disable-line react-hooks/exhaustive-deps

	const stompConnect = () => {
		if (!stompClient) {
			return;
		}

		stompClient.reconnect_delay = RECONNECT_DELAY;
		stompClient.connect({}, (frame) => {
			reconnectAttemptCount = 0;
			stompClient.subscribe('/user/events', function (message) {
				const stompMessageBody = JSON.parse(message.body);
				const stompEventType = String(
					stompMessageBody['eventType'] ?? ''
				);
				if (stompEventType === 'directMessage') {
					setNewStompDirectMessage(true);
				} else if (
					stompEventType === 'newAnonymousEnquiry' ||
					stompEventType === 'NEWANONYMOUSENQUIRY'
				) {
					setNewStompAnonymousEnquiry(true);
				} else if (
					stompEventType === 'anonymousEnquiryAccepted' ||
					stompEventType === 'ANONYMOUSENQUIRYACCEPTED'
				) {
					addNotification({
						notificationType: NOTIFICATION_TYPE_SUCCESS,
						title: translate(
							'profile.notifications.inquiryAccepted.title'
						),
						text: translate(
							'profile.notifications.inquiryAccepted.description'
						)
					});
				} else if (
					stompEventType === 'anonymousConversationFinished' ||
					stompEventType === 'ANONYMOUSCONVERSATIONFINISHED'
				) {
					setNewStompAnonymousConversationFinished(true);
				} else if (stompEventType === 'videoCallRequest') {
					const stompEventContent: VideoCallRequestProps =
						stompMessageBody['eventContent'];
					setNewStompVideoCallRequest(stompEventContent);
				}
				message.ack({ 'message-id': message.headers.id });
			});
		});
	};

	return <></>;
};
