import * as React from 'react';
import {
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState
} from 'react';
import { useParams, useHistory } from 'react-router-dom';
import { Loading } from '../app/Loading';
import { SessionItemComponent } from './SessionItemComponent';
import {
	AUTHORITIES,
	ConsultantListContext,
	E2EEContext,
	hasUserAuthority,
	RocketChatContext,
	RocketChatGlobalSettingsContext,
	SessionTypeContext,
	UserDataContext,
	ActiveSessionContext
} from '../../globalState';
import {
	apiGetAgencyConsultantList,
	apiGetSessionData,
	fetchData,
	FETCH_METHODS,
	FETCH_ERRORS
} from '../../api';
import { apiUrl } from '../../resources/scripts/endpoints';
import {
	prepareMessages,
	SESSION_LIST_TAB,
	SESSION_LIST_TYPES
} from './sessionHelpers';
import { getValueFromCookie } from '../sessionCookie/accessSessionCookie';
import { Overlay, OVERLAY_FUNCTIONS, OverlayItem } from '../overlay/Overlay';
import { BUTTON_TYPES } from '../button/Button';
import { logout } from '../logout/logout';
import { ReactComponent as CheckIcon } from '../../resources/img/illustrations/check.svg';
import useTyping from '../../utils/useTyping';
import './session.styles';
import { useE2EE } from '../../hooks/useE2EE';
import {
	EVENT_SUBSCRIPTIONS_CHANGED,
	SUB_STREAM_NOTIFY_USER,
	SUB_STREAM_ROOM_MESSAGES
} from '../app/RocketChat';
import useUpdatingRef from '../../hooks/useUpdatingRef';
import useDebounceCallback from '../../hooks/useDebounceCallback';
import { useSearchParam } from '../../hooks/useSearchParams';
import { useTranslation } from 'react-i18next';
import { prepareConsultantDataForSelect } from '../sessionAssign/sessionAssignHelper';
import {
	IArraySetting,
	SETTING_HIDE_SYSTEM_MESSAGES
} from '../../api/apiRocketChatSettingsPublic';
import { messageEventEmitter } from '../../services/messageEventEmitter';

interface SessionStreamProps {
	readonly: boolean;
	checkMutedUserForThisSession: () => void;
	bannedUsers: string[];
}

export const SessionStream = ({
	readonly,
	checkMutedUserForThisSession,
	bannedUsers
}: SessionStreamProps) => {
	const { t: translate } = useTranslation();
	const history = useHistory();

	const { type, path: listPath } = useContext(SessionTypeContext);
	const { userData } = useContext(UserDataContext);
	const { subscribe, unsubscribe } = useContext(RocketChatContext);
	const { getSetting } = useContext(RocketChatGlobalSettingsContext);
	const { rcGroupId } = useParams<{ rcGroupId: string }>();

	// MATRIX MIGRATION: Track component mount/unmount
	useEffect(() => {
		console.log('🔥 SessionStream MOUNTED');
		return () => {
			console.log('🔥 SessionStream UNMOUNTED - Component is being destroyed!');
		};
	}, []);

	const subscribed = useRef(false);
	const [messagesItem, setMessagesItem] = useState(null);
	const [isOverlayActive, setIsOverlayActive] = useState(false);
	const [loading, setLoading] = useState(true);
	const [overlayItem, setOverlayItem] = useState(null);

	const { activeSession, readActiveSession } =
		useContext(ActiveSessionContext);

	const { addNewUsersToEncryptedRoom } = useE2EE(activeSession?.rid);
	const { isE2eeEnabled } = useContext(E2EEContext);
	const { setConsultantList } = useContext(ConsultantListContext);

	const abortController = useRef<AbortController>(null);
	const hasUserInitiatedStopOrLeaveRequest = useRef<boolean>(false);

	const displayName = userData.displayName || userData.userName;

	const { subscribeTyping, unsubscribeTyping, handleTyping, typingUsers } =
		useTyping(activeSession?.rid, userData.userName, displayName);

	const sessionListTab = useSearchParam<SESSION_LIST_TAB>('sessionListTab');

	const fetchSessionMessages = useCallback(() => {
		if (abortController.current) {
			abortController.current.abort();
		}

		abortController.current = new AbortController();

		// MATRIX MIGRATION: Use Matrix API if no rcGroupId
		if (!activeSession.rid && activeSession.item?.id) {
			const sessionId = activeSession.item.id;
			const apiUrlBase = (window as any).Cypress
				? (window as any).Cypress.env('REACT_APP_API_URL')
				: process.env.REACT_APP_API_URL || '';
			const matrixUrl = `${apiUrlBase}/service/matrix/sessions/${sessionId}/messages`;
			
			console.log('🚀 MATRIX: Fetching messages from Matrix API:', matrixUrl);
			
			// Use raw fetch to see actual response
			const accessToken = getValueFromCookie('keycloak');
			const csrfToken = document.cookie.split('; ').find(row => row.startsWith('CSRF-TOKEN='))?.split('=')[1];
			
			console.log('🔑 MATRIX: Auth token exists?', !!accessToken);
			console.log('🔑 MATRIX: CSRF token exists?', !!csrfToken);
			
			return fetch(matrixUrl, {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${accessToken}`,
					'X-CSRF-TOKEN': csrfToken || '',
					'X-WHITELIST-HEADER': csrfToken || ''
				},
				credentials: 'include'
			}).then(async (response) => {
				console.log('🚀 MATRIX: Response status:', response.status);
				
				const responseText = await response.text();
				console.log('🚀 MATRIX: Response body:', responseText);
				
				if (response.status === 200) {
					const responseData = responseText ? JSON.parse(responseText) : {};
					console.log('🚀 MATRIX: Parsed response:', responseData);
					
					// Convert Matrix messages to frontend format
					const matrixMessages = responseData?.messages || [];
					console.log('🚀 MATRIX: Matrix messages array:', matrixMessages);
					
					// MATRIX MIGRATION: Reverse message order - Matrix returns newest first, we want oldest first
					const reversedMessages = [...matrixMessages].reverse();
					
					const formattedMessages = reversedMessages.map((msg: any) => {
						const baseMessage: any = {
							_id: msg.event_id,
							msg: msg.content?.body || '',
							ts: new Date(msg.origin_server_ts || Date.now()),
							u: {
								_id: msg.sender,
								username: msg.sender?.split(':')[0]?.substring(1) || 'unknown'
							}
						};
						
						// Handle file/image messages
						if (msg.content?.url && msg.content?.msgtype !== 'm.text') {
							// Convert mxc:// URL to download path directly through Nginx to Matrix
							// mxc://server/mediaId -> /_matrix/media/r0/download/server/mediaId
							let downloadPath = msg.content.url;
							if (downloadPath.startsWith('mxc://')) {
								const mxcParts = downloadPath.substring(6).split('/'); // Remove 'mxc://' and split
								const serverName = mxcParts[0];
								const mediaId = mxcParts[1];
								// Direct to Matrix via Nginx (no auth needed for media downloads)
								downloadPath = `/_matrix/media/r0/download/${serverName}/${mediaId}`;
							}
							
							baseMessage.file = {
								name: msg.content.body,
								type: msg.content.info?.mimetype || 'application/octet-stream'
							};
							baseMessage.attachments = [{
								title: msg.content.body,
								title_link: downloadPath,
								image_url: msg.content.msgtype === 'm.image' ? downloadPath : undefined,
								type: msg.content.msgtype === 'm.image' ? 'image' : 'file',
								image_type: msg.content.info?.mimetype,
								image_size: msg.content.info?.size
							}];
							console.log('🖼️ MATRIX: File/image message detected:', msg.content.body, 'Path:', downloadPath);
						}
						
						return baseMessage;
					});
					
					console.log('🚀 MATRIX: Formatted messages:', formattedMessages);
					
					// Apply prepareMessages to format messages correctly for the UI
					const preparedMessages = prepareMessages(formattedMessages);
					console.log('🚀 MATRIX: Prepared messages:', preparedMessages);
					
					setMessagesItem({ messages: preparedMessages });
					setLoading(false);
				} else {
					console.error('🚀 MATRIX: Non-200 response:', response.status, responseText);
					setLoading(false);
					setMessagesItem(null);
				}
			}).catch((error) => {
				console.error('🚀 MATRIX: Failed to fetch messages:', error);
				setLoading(false);
				setMessagesItem(null);
			});
		}

		// Legacy RocketChat path
		return apiGetSessionData(
			activeSession.rid,
			abortController.current.signal
		).then((messagesData) => {
			const hiddenSystemMessages = getSetting<IArraySetting>(
				SETTING_HIDE_SYSTEM_MESSAGES
			);
			setMessagesItem(
				messagesData
					? prepareMessages(
							messagesData.messages.filter(
								(message) =>
									!hiddenSystemMessages ||
									!hiddenSystemMessages.value.includes(
										message.t
									)
							)
						)
					: null
			);
		});
	}, [activeSession.rid, activeSession.item, getSetting]);

	const setSessionRead = useCallback(() => {
		if (readonly) {
			return;
		}

		readActiveSession();
	}, [readActiveSession, readonly]);

	/**
	 * ToDo: roomMessageBounce is just a temporary fix because currently
	 * every message gets marked but on every changed message we are loading all
	 * messages. Maybe in future we will only update single message as it changes
	 */
	const handleRoomMessage = useCallback(
		(args) => {
			if (args.length === 0) return;

			args
				// Map collected from debounce callback
				.map(([[message]]) => message)
				.forEach((message) => {
					if (message.t === 'user-muted') {
						checkMutedUserForThisSession();
						return;
					}

					if (message.t === 'au') {
						// Handle this event only for groups because on session assigning its already handled
						if (isE2eeEnabled && activeSession.isGroup) {
							addNewUsersToEncryptedRoom().then();
						}
						return;
					}

					if (message.u?.username !== 'rocket-chat-technical-user') {
						fetchSessionMessages()
							.then(() => {
								setSessionRead();
							})
							.catch(() => {
								// prevent error from leaking to console
							});
					}
				});
		},

		[
			checkMutedUserForThisSession,
			isE2eeEnabled,
			activeSession.isGroup,
			addNewUsersToEncryptedRoom,
			fetchSessionMessages,
			setSessionRead
		]
	);

	const onDebounceMessage = useUpdatingRef(
		useDebounceCallback(handleRoomMessage, 500, true)
	);

	const groupChatStoppedOverlay: OverlayItem = useMemo(
		() => ({
			svg: CheckIcon,
			headline: translate('groupChat.stopped.overlay.headline'),
			buttonSet: [
				{
					label: translate('groupChat.stopped.overlay.button1Label'),
					function: OVERLAY_FUNCTIONS.REDIRECT,
					type: BUTTON_TYPES.PRIMARY
				},
				{
					label: translate('groupChat.stopped.overlay.button2Label'),
					function: OVERLAY_FUNCTIONS.LOGOUT,
					type: BUTTON_TYPES.SECONDARY
				}
			]
		}),
		[translate]
	);

	const handleChatStopped = useUpdatingRef(
		useCallback(
			([event]) => {
				if (event === 'removed') {
					// If the user has initiated the stop or leave request, he/she is already
					// shown an appropriate overlay during the process via the SessionMenu component.
					// Thus, there is no need for an additional notification.
					if (hasUserInitiatedStopOrLeaveRequest.current) {
						hasUserInitiatedStopOrLeaveRequest.current = false;
					} else {
						setOverlayItem(groupChatStoppedOverlay);
						setIsOverlayActive(true);
					}
				}
			},
			[groupChatStoppedOverlay]
		)
	);

	const handleSubscriptionChanged = useUpdatingRef(
		useCallback(
			([event]) => {
				if (event === 'removed') {
					// user was removed from the session and is still in a session view
					// then redirect him to the listview
					if (type === SESSION_LIST_TYPES.MY_SESSION) {
						if (activeSession?.item?.groupId === rcGroupId) {
							history.push(listPath);
						}
					}
				}
			},
			[activeSession, rcGroupId, listPath, type, history]
		)
	);

	// MATRIX MIGRATION: Real-time message sync for Matrix sessions
	useEffect(() => {
		// Only for Matrix sessions (no Rocket.Chat rid)
		if (!activeSession.rid && activeSession.item?.matrixRoomId && activeSession.item?.id) {
			const matrixRoomId = activeSession.item.matrixRoomId;
			const sessionId = activeSession.item.id;
			console.log('🔷 Setting up Matrix real-time listener for room:', matrixRoomId);

			// STEP 1: Register this room with backend for LiveService notifications
			const csrfToken = getValueFromCookie('csrfToken');
			const accessToken = getValueFromCookie('keycloak');
			
			fetch(`${apiUrl}/service/matrix/sync/register/${sessionId}`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${accessToken}`,
					'X-CSRF-TOKEN': csrfToken || '',
					'X-CSRF-Bypass': 'true',  // Bypass CSRF for this endpoint
					'X-WHITELIST-HEADER': csrfToken || ''
				},
				credentials: 'include'
			}).then(response => {
				if (response.ok) {
					console.log('✅ Matrix room registered with backend for LiveService notifications');
					return response.json();
				} else {
					console.error('❌ Failed to register room with backend, status:', response.status);
					throw new Error(`Registration failed: ${response.status}`);
				}
			}).then(data => {
				console.log('✅ Registration response:', data);
			}).catch(e => {
				console.error('❌ Error registering room:', e);
			});

			// STEP 2: Listen to LiveService events (PRIMARY - instant via WebSocket!)
			const handleLiveServiceMessage = (data: any) => {
				console.log('🔔 LiveService event received - refreshing messages!');
				fetchSessionMessages().then(() => {
					console.log('✅ Messages refreshed via LiveService');
				}).catch((e) => {
					console.error('❌ Failed to refresh:', e);
				});
			};

			// Register with message event emitter
			messageEventEmitter.on(handleLiveServiceMessage);
			console.log('📡 Listening to LiveService events');

			// STEP 3: Get Matrix client for frontend real-time events (BACKUP)
			const matrixClientService = (window as any).matrixClientService;
			if (!matrixClientService) {
				console.warn('⚠️ Matrix client not initialized - will rely on LiveService only');
			} else {
				const matrixClient = matrixClientService.getClient();
				if (matrixClient) {
					// Handler for Room.timeline events (BACKUP if LiveService fails)
					const handleMatrixTimeline = (event: any, room: any, toStartOfTimeline: boolean) => {
						if (toStartOfTimeline || room.roomId !== matrixRoomId) {
							return;
						}

						const eventType = event.getType();
						if (eventType !== 'm.room.message') {
							return;
						}

						console.log('📬 Matrix message received (frontend backup)!');
						
						// Refresh messages (backup)
						fetchSessionMessages().then(() => {
							console.log('✅ Messages refreshed (via frontend Matrix)');
						}).catch((e) => {
							console.error('❌ Failed to refresh:', e);
						});
					};

					// Subscribe to Matrix Room.timeline events (as backup)
					console.log('📡 Subscribing to Matrix Room.timeline (backup)');
					(matrixClient as any).on('Room.timeline', handleMatrixTimeline);

					// Cleanup Matrix listener
					return () => {
						console.log('🧹 Cleaning up Matrix and LiveService listeners');
						(matrixClient as any).off('Room.timeline', handleMatrixTimeline);
						messageEventEmitter.off(handleLiveServiceMessage);
						
						// Unregister room from backend
						fetch(`${apiUrl}/service/matrix/sync/register/${sessionId}`, {
							method: 'DELETE',
							headers: {
								'Authorization': `Bearer ${accessToken}`,
								'X-CSRF-TOKEN': csrfToken || ''
							},
							credentials: 'include'
						}).catch(e => console.warn('Could not unregister room:', e));
					};
				}
			}

			// Cleanup just LiveService listener
			return () => {
				console.log('🧹 Cleaning up LiveService listener');
				messageEventEmitter.off(handleLiveServiceMessage);
				
				// Unregister room from backend
				fetch(`${apiUrl}/service/matrix/sync/register/${sessionId}`, {
					method: 'DELETE',
					headers: {
						'Authorization': `Bearer ${accessToken}`,
						'X-CSRF-TOKEN': csrfToken || '',
						'X-CSRF-Bypass': 'true'
					},
					credentials: 'include'
				}).catch(e => console.warn('Could not unregister room:', e));
			};
		}
	}, [activeSession.rid, activeSession.item?.matrixRoomId, activeSession.item?.id, fetchSessionMessages]);

	useEffect(() => {
		if (subscribed.current) {
			setLoading(false);
		} else {
			subscribed.current = true;

			// check if any user needs to be added when opening session view
			addNewUsersToEncryptedRoom().then();

			fetchSessionMessages()
				.then(() => {
					setSessionRead();

					// MATRIX MIGRATION: Skip RocketChat subscriptions for Matrix sessions
					if (activeSession.rid) {
						subscribe(
							{
								name: SUB_STREAM_ROOM_MESSAGES,
								roomId: activeSession.rid
							},
							onDebounceMessage
						);

						subscribe(
							{
								name: SUB_STREAM_NOTIFY_USER,
								event: EVENT_SUBSCRIPTIONS_CHANGED,
								userId: getValueFromCookie('rc_uid')
							},
							activeSession.isGroup
								? handleChatStopped
								: handleSubscriptionChanged
						);

						if (activeSession.isGroup) {
							subscribeTyping();
						}
					} else {
						console.log('🔷 Matrix session detected - using Matrix real-time events (no RocketChat subscription)');
					}

					setLoading(false);
				})
				.catch((e) => {
					if (e.message !== FETCH_ERRORS.ABORT) {
						console.error('error fetchSessionMessages', e);
					}
					// MATRIX MIGRATION: Still show UI even if messages fail to load
					setLoading(false);
					setMessagesItem({ messages: [] });
				});
		}

		return () => {
			if (abortController.current) {
				abortController.current.abort();
				abortController.current = null;
			}

			setMessagesItem(null);

			if (subscribed.current && activeSession) {
				subscribed.current = false;

				unsubscribe(
					{
						name: SUB_STREAM_ROOM_MESSAGES,
						roomId: activeSession.rid
					},
					onDebounceMessage
				);

				unsubscribe(
					{
						name: SUB_STREAM_NOTIFY_USER,
						event: EVENT_SUBSCRIPTIONS_CHANGED,
						userId: getValueFromCookie('rc_uid')
					},
					activeSession.isGroup
						? handleChatStopped
						: handleSubscriptionChanged
				);

				if (activeSession.isGroup) {
					unsubscribeTyping();
				}
			}
		};
	}, [
		activeSession,
		// MATRIX MIGRATION: Removed function dependencies to prevent infinite loop
		// Functions are stable and don't need to be in dependencies
		// addNewUsersToEncryptedRoom,
		// fetchSessionMessages,
		// handleChatStopped,
		// handleSubscriptionChanged,
		// onDebounceMessage,
		// setSessionRead,
		// subscribe,
		// subscribeTyping,
		type,
		// unsubscribe,
		// unsubscribeTyping,
		userData
	]);

	useEffect(() => {
		if (
			activeSession.isGroup ||
			hasUserAuthority(AUTHORITIES.ASKER_DEFAULT, userData)
		) {
			return;
		}
		const agencyId = activeSession.item.agencyId.toString();
		apiGetAgencyConsultantList(agencyId)
			.then((response) => {
				const consultants = prepareConsultantDataForSelect(response);
				setConsultantList(consultants);
			})
			.catch((error) => {
				console.log(error);
			});
	}, [
		activeSession.isGroup,
		activeSession.item.agencyId,
		setConsultantList,
		userData
	]);

	const handleOverlayAction = (buttonFunction: string) => {
		if (buttonFunction === OVERLAY_FUNCTIONS.REDIRECT) {
			history.push(
				listPath +
					(sessionListTab ? `?sessionListTab=${sessionListTab}` : '')
			);
		} else if (buttonFunction === OVERLAY_FUNCTIONS.LOGOUT) {
			logout();
		}
	};

	console.log('🔥 SessionStream RENDER:', {
		loading,
		hasMessages: !!messagesItem,
		messageCount: messagesItem?.messages?.length,
		activeSessionId: activeSession?.item?.id
	});

	if (loading) {
		console.log('🔥 SessionStream: Showing loading spinner');
		return <Loading />;
	}

	console.log('🔥 SessionStream: Rendering session content');

	return (
		<div className="session__wrapper">
			<SessionItemComponent
				hasUserInitiatedStopOrLeaveRequest={
					hasUserInitiatedStopOrLeaveRequest
				}
				isTyping={handleTyping}
				typingUsers={typingUsers}
				messages={messagesItem?.messages}
				bannedUsers={bannedUsers}
				refreshMessages={fetchSessionMessages}
			/>
			{isOverlayActive && (
				<Overlay
					item={overlayItem}
					handleOverlay={handleOverlayAction}
				/>
			)}
		</div>
	);
};
