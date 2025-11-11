import * as React from 'react';
import { useContext, useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
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
	const { t: translate } = useTranslation();
	const history = useHistory();
	const { releaseToggles } = useAppConfig();
	const [newStompDirectMessage, setNewStompDirectMessage] =
		useState<boolean>(false);
	const [newStompVideoCallRequest, setNewStompVideoCallRequest] =
		useState<VideoCallRequestProps>();
	const { addNotification } = useContext(NotificationsContext);
	const { setWebsocketConnectionDeactivated } = useContext(
		WebsocketConnectionDeactivatedContext
	);

	const stompClient = Stomp.over(function () {
		return new SockJS(endpoints.liveservice);
	});

	let reconnectAttemptCount = 0;
	const RECONNECT_ATTEMPT_LIMIT = 2;
	const RECONNECT_DELAY = 5000;

	// DEV-NOTE: comment next line to activate debug mode (stomp logging) for development
	stompClient.debug = () => {};

	useEffect(() => {
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
			console.log('Closed', message);
		};

		stompClient.onWebSocketError = (error) => {
			console.log('Error', error);
		};

		// MATRIX EVENT BRIDGE SETUP (for real-time Matrix events)
		// Listen to Matrix 'directMessage' events
		const handleMatrixDirectMessage = (event: any) => {
			console.log('📬 Matrix directMessage event received:', event);
			setNewStompDirectMessage(true);
		};

	// Listen to Matrix 'videoCallRequest' events
	const handleMatrixCallRequest = (event: any) => {
		console.log('📞 Matrix videoCallRequest event received:', event);
		
		// Use CallContext to trigger floating widget
		const callContext = (window as any).callContext;
		if (callContext) {
			console.log('📞 Triggering incoming call via CallContext');
			callContext.receiveCall(
				event.roomId,
				true, // Assume video for now (we can enhance this later)
				event.callId,
				event.sender
			);
		} else {
			console.error('❌ CallContext not available');
		}
	};

		// Listen to Matrix 'callEnded' events
		const handleMatrixCallEnded = (event: any) => {
			console.log('📴 Matrix callEnded event received:', event);
			
			// Use CallContext to end the call
			const callContext = (window as any).callContext;
			if (callContext) {
				console.log('📴 Ending call via CallContext');
				callContext.hangupCall();
			} else {
				console.error('❌ CallContext not available');
			}
		};

		// Register Matrix event listeners
		matrixLiveEventBridge.on('directMessage', handleMatrixDirectMessage);
		matrixLiveEventBridge.on('videoCallRequest', handleMatrixCallRequest);
		matrixLiveEventBridge.on('callEnded', handleMatrixCallEnded);

		console.log('✅ WebsocketHandler: STOMP + Matrix event listeners registered');

		// Cleanup function
		return () => {
			// Unregister Matrix event listeners
			matrixLiveEventBridge.off('directMessage', handleMatrixDirectMessage);
			matrixLiveEventBridge.off('videoCallRequest', handleMatrixCallRequest);
			matrixLiveEventBridge.off('callEnded', handleMatrixCallEnded);
			console.log('🧹 WebsocketHandler: Event listeners cleaned up');
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
			console.log('🔔 LiveService directMessage event - refreshing open sessions');
			messageEventEmitter.emit({});

			if (
				!releaseToggles.enableNewNotifications ||
				isBrowserNotificationTypeEnabled('newMessage')
			) {
				sendNotification(translate('notifications.message.new'), {
					onclick: () => {
						history.push(`/sessions/consultant/sessionView`);
					}
				});
			}
		}
	}, [newStompDirectMessage]); // eslint-disable-line react-hooks/exhaustive-deps

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
		stompClient.reconnect_delay = RECONNECT_DELAY;
		stompClient.connect({}, (frame) => {
			reconnectAttemptCount = 0;
			stompClient.subscribe('/user/events', function (message) {
				const stompMessageBody = JSON.parse(message.body);
				const stompEventType: LiveService.Schemas.EventType =
					stompMessageBody['eventType'];
				if (stompEventType === 'directMessage') {
					setNewStompDirectMessage(true);
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