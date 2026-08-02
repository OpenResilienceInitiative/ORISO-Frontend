import React, {
	FormEvent,
	useCallback,
	useEffect,
	useRef,
	useState
} from 'react';
import {
	Alert,
	Box,
	Button,
	CircularProgress,
	Paper,
	Stack,
	TextField,
	Typography
} from '@mui/material';
import {
	MatrixClient,
	MatrixEvent,
	MatrixEventEvent,
	RoomEvent
} from 'matrix-js-sdk';
import { useTranslation } from 'react-i18next';
import { useMatrixClient } from '../../globalState/context/MatrixClientContext';
import {
	getMatrixAccessToken,
	persistMatrixLoginData
} from '../sessionCookie/getMatrixAccessToken';
import { getMatrixHomeserverUrl } from '../../resources/scripts/runtimeConfig';
import { MatrixClientService } from '../../services/matrixClientService';
import { apiRegisterSupportCallRoom } from '../../api/apiSupportHandshake';
import {
	getElementCallBaseUrl,
	getMatrixHomeserverUrl as getConfiguredHomeserverUrl
} from '../../resources/scripts/runtimeConfig';

type TimelineMessage = {
	id: string;
	body: string;
	sender: string;
	own: boolean;
};

type SupportRoomConversationProps = {
	roomId: string;
	/**
	 * Present so a call room created here can be registered with the backend; without it the
	 * four-hour withdrawal would close the signalling room while a call kept running.
	 */
	sessionId?: string;
};

const readMessages = (
	client: MatrixClient,
	roomId: string
): TimelineMessage[] => {
	const room = client.getRoom(roomId);
	if (!room) return [];
	const ownUserId = client.getUserId();

	return room
		.getLiveTimeline()
		.getEvents()
		.filter(
			(event) =>
				event.getType() === 'm.room.message' &&
				event.getContent()?.msgtype === 'm.text'
		)
		.map((event, index) => ({
			id: event.getId() || `${event.getSender()}-${index}`,
			body: event.getContent().body,
			sender: event.getSender() || '',
			own: event.getSender() === ownUserId
		}));
};

export const SupportRoomConversation = ({
	roomId,
	sessionId
}: SupportRoomConversationProps) => {
	const { t } = useTranslation();
	const { matrixClientService, setMatrixClientService } = useMatrixClient();
	const bootstrapStarted = useRef(false);
	const [messages, setMessages] = useState<TimelineMessage[]>([]);
	const [draft, setDraft] = useState('');
	const [connectionError, setConnectionError] = useState(false);
	const [sending, setSending] = useState(false);

	useEffect(() => {
		if (matrixClientService || bootstrapStarted.current) return;
		bootstrapStarted.current = true;
		let active = true;
		let createdService: MatrixClientService | null = null;

		void (async () => {
			try {
				const loginData = await getMatrixAccessToken();
				const homeserverUrl = getMatrixHomeserverUrl();
				if (!homeserverUrl)
					throw new Error('Matrix homeserver is not configured');
				persistMatrixLoginData(loginData);
				createdService = new MatrixClientService();
				await createdService.initializeClient({
					...loginData,
					homeserverUrl
				});
				if (!active) {
					createdService.stopAndCleanup();
					return;
				}
				setMatrixClientService(createdService);
			} catch {
				if (active) setConnectionError(true);
			}
		})();

		return () => {
			active = false;
		};
	}, [matrixClientService, setMatrixClientService]);

	/**
	 * Opens Element Call for this room and tells the backend which room the call runs in, so the
	 * four-hour withdrawal closes the media room too rather than only the signalling room.
	 */
	const startCall = useCallback(async () => {
		const client = matrixClientService?.getClient?.();
		const homeserverUrl =
			client?.getHomeserverUrl() || getConfiguredHomeserverUrl();
		const elementCallBase = getElementCallBaseUrl();
		if (!homeserverUrl || !elementCallBase || !sessionId) {
			return;
		}

		// Registered before the window opens: a call that the backend does not know about would
		// survive revocation, so failing to register must prevent the call, not follow it.
		await apiRegisterSupportCallRoom(sessionId, roomId);

		const params = new URLSearchParams();
		params.set('roomId', roomId);
		params.set('homeserver', homeserverUrl);
		window.open(
			`${elementCallBase}/room/#?${params.toString()}`,
			'ElementCall',
			'width=1200,height=800,resizable=yes,scrollbars=yes'
		);
	}, [matrixClientService, roomId, sessionId]);

	const refresh = useCallback(
		(client: MatrixClient) => setMessages(readMessages(client, roomId)),
		[roomId]
	);

	useEffect(() => {
		if (!matrixClientService) return;
		let client: MatrixClient | null = null;
		const watchedEvents = new Set<MatrixEvent>();

		const onDecrypted = () => {
			if (client) refresh(client);
		};

		const refreshAndWatch = (nextClient: MatrixClient) => {
			nextClient
				.getRoom(roomId)
				?.getLiveTimeline()
				.getEvents()
				.forEach((event) => {
					if (watchedEvents.has(event)) return;
					watchedEvents.add(event);
					(event as any).on?.(
						MatrixEventEvent.Decrypted,
						onDecrypted
					);
				});
			refresh(nextClient);
		};

		const onTimeline = (
			event: MatrixEvent,
			room: { roomId?: string } | undefined
		) => {
			if (room?.roomId !== roomId || !client) return;
			if (!watchedEvents.has(event)) {
				watchedEvents.add(event);
				(event as any).on?.(MatrixEventEvent.Decrypted, onDecrypted);
			}
			refresh(client);
		};

		const attach = (nextClient: MatrixClient | null) => {
			if (client) (client as any).off(RoomEvent.Timeline, onTimeline);
			client = nextClient;
			if (!client) return;
			(client as any).on(RoomEvent.Timeline, onTimeline);
			if (client.getRoom(roomId)) {
				refreshAndWatch(client);
			} else {
				void client
					.joinRoom(roomId)
					.then(() => client && refreshAndWatch(client))
					.catch(() => setConnectionError(true));
			}
		};

		attach(matrixClientService.getClient());
		const unsubscribe = matrixClientService.onClientChange(attach);
		return () => {
			unsubscribe();
			if (client) (client as any).off(RoomEvent.Timeline, onTimeline);
			watchedEvents.forEach((event) =>
				(event as any).off?.(MatrixEventEvent.Decrypted, onDecrypted)
			);
		};
	}, [matrixClientService, refresh, roomId]);

	const submit = async (event: FormEvent) => {
		event.preventDefault();
		const message = draft.trim();
		if (!matrixClientService || !message) return;
		setSending(true);
		setConnectionError(false);
		try {
			await matrixClientService.sendMessage(roomId, message);
			setDraft('');
		} catch {
			setConnectionError(true);
		} finally {
			setSending(false);
		}
	};

	if (!matrixClientService && !connectionError) {
		return (
			<Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
				<CircularProgress
					aria-label={t('supportAccess.chat.connecting')}
				/>
			</Box>
		);
	}

	return (
		<Paper variant="outlined" sx={{ p: 2 }}>
			<Stack spacing={2}>
				<Stack
					direction="row"
					justifyContent="space-between"
					alignItems="center"
				>
					<Typography variant="h5">
						{t('supportAccess.chat.title')}
					</Typography>
					{sessionId && (
						<Button
							onClick={() => void startCall()}
							variant="outlined"
							data-cy="support-start-call"
						>
							{t('supportAccess.call.start')}
						</Button>
					)}
				</Stack>
				{connectionError && (
					<Alert severity="error">
						{t('supportAccess.chat.error')}
					</Alert>
				)}
				<Box
					aria-live="polite"
					sx={{
						bgcolor: 'background.default',
						borderRadius: 1,
						minHeight: 180,
						maxHeight: 360,
						overflowY: 'auto',
						p: 2
					}}
				>
					{messages.length === 0 ? (
						<Typography color="text.secondary">
							{t('supportAccess.chat.empty')}
						</Typography>
					) : (
						<Stack spacing={1}>
							{messages.map((message) => (
								<Box
									key={message.id}
									sx={{
										alignSelf: message.own
											? 'flex-end'
											: 'flex-start',
										bgcolor: message.own
											? 'primary.light'
											: 'background.paper',
										borderRadius: 2,
										maxWidth: '85%',
										px: 2,
										py: 1
									}}
								>
									<Typography>{message.body}</Typography>
								</Box>
							))}
						</Stack>
					)}
				</Box>
				<Box
					component="form"
					onSubmit={(event) => void submit(event)}
					sx={{ display: 'flex', gap: 1 }}
				>
					<TextField
						fullWidth
						label={t('supportAccess.chat.message')}
						onChange={(event) => setDraft(event.target.value)}
						value={draft}
					/>
					<Button
						disabled={
							!draft.trim() || sending || !matrixClientService
						}
						type="submit"
						variant="contained"
					>
						{t('supportAccess.chat.send')}
					</Button>
				</Box>
			</Stack>
		</Paper>
	);
};
