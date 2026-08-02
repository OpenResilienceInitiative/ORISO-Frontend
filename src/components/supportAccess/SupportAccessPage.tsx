import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Box, Container, Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import {
	apiGetActiveSupportSessions,
	SupportAccessSession
} from '../../api/apiSupportHandshake';
import { SupportRoomConversation } from './SupportRoomConversation';

const POLL_INTERVAL_MS = 4000;

/**
 * The whole counselling app for a Global Support Admin (ADR-018 §7).
 *
 * <p>There is deliberately nothing to initiate here: a support request is raised in the Admin board
 * with fresh password and OTP, so this view can only ever show what already exists. It carries the
 * session, its chat and its call — no enquiries, no cases, no advice-seeker data, no handover.
 *
 * <p>What is shown is driven entirely by the server. {@code /sessions/active} returns a session only
 * while it is genuinely usable, so a session vanishing from that list is what ends this view — a
 * reload cannot resurrect it and no local state can keep it alive.
 */
export const SupportAccessPage = () => {
	const { t } = useTranslation();
	const [sessions, setSessions] = useState<SupportAccessSession[]>([]);
	const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
		'loading'
	);
	const [ended, setEnded] = useState(false);
	const hadSessionRef = useRef(false);

	const refresh = useCallback(async () => {
		const active = await apiGetActiveSupportSessions();
		setSessions(active);
		setStatus('ready');
		if (hadSessionRef.current && active.length === 0) {
			setEnded(true);
		}
		hadSessionRef.current = active.length > 0;
	}, []);

	useEffect(() => {
		const run = () => void refresh().catch(() => setStatus('error'));
		run();
		const interval = window.setInterval(run, POLL_INTERVAL_MS);
		const onFocus = () => run();
		window.addEventListener('focus', onFocus);
		document.addEventListener('visibilitychange', onFocus);
		return () => {
			window.clearInterval(interval);
			window.removeEventListener('focus', onFocus);
			document.removeEventListener('visibilitychange', onFocus);
		};
	}, [refresh]);

	const session = sessions[0];

	return (
		<Container maxWidth="md" sx={{ py: 6 }}>
			<Stack spacing={3}>
				<Box>
					<Typography variant="h3">
						{t('supportAccess.title')}
					</Typography>
					<Typography color="text.secondary">
						{t('supportAccess.subtitle')}
					</Typography>
				</Box>

				{status === 'error' && (
					<Alert severity="error">{t('supportAccess.error')}</Alert>
				)}

				{status === 'ready' && !session && (
					<Alert
						severity={ended ? 'info' : 'info'}
						data-cy="support-no-session"
					>
						{ended
							? t('supportAccess.ended')
							: t('supportAccess.none')}
					</Alert>
				)}

				{session && session.status === 'PROVISIONING' && (
					<Alert
						severity="info"
						data-cy="support-session-provisioning"
					>
						{t('supportAccess.provisioning')}
					</Alert>
				)}

				{session && session.status === 'ACTIVE' && (
					<>
						<Alert
							severity="success"
							data-cy="support-session-active"
						>
							{t('supportAccess.active', {
								expiry: new Date(
									session.expiryDate
								).toLocaleTimeString()
							})}
						</Alert>
						{session.matrixRoomId && (
							<SupportRoomConversation
								roomId={session.matrixRoomId}
								sessionId={session.id}
							/>
						)}
					</>
				)}
			</Stack>
		</Container>
	);
};
