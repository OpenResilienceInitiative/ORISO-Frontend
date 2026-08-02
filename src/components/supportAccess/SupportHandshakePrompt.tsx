import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
	Alert,
	Box,
	Button,
	Dialog,
	DialogActions,
	DialogContent,
	DialogTitle,
	TextField
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import {
	apiConfirmSupportHandshake,
	apiDeclineSupportHandshake,
	apiGetActiveSupportSessions,
	apiGetPendingSupportHandshakes,
	apiTerminateSupportSession,
	SupportAccessSession,
	SupportHandshake
} from '../../api/apiSupportHandshake';
import { SupportRoomConversation } from './SupportRoomConversation';

const POLL_INTERVAL_MS = 4000;

/**
 * The backend serialises LocalDateTime in UTC without a zone suffix. Parsed as local time east of
 * Greenwich that instant is already in the past, so the consultant would be told the request had
 * lapsed the moment it arrived. A zoneless value is therefore read as UTC.
 */
const secondsLeft = (expiryDate?: string) => {
	if (!expiryDate) return 0;
	const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(expiryDate);
	const remaining = Math.floor(
		(new Date(hasZone ? expiryDate : `${expiryDate}Z`).getTime() -
			Date.now()) /
			1000
	);
	return remaining > 0 ? remaining : 0;
};

const formatCountdown = (seconds: number) =>
	`${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

/**
 * The consultant side of the live handshake (ADR-018 §7).
 *
 * <p>Two properties matter more than the layout. Not reacting must grant nothing — there is no
 * cancel that confirms, and closing the dialog is impossible, so the only ways out are confirming,
 * declining, or letting the five minutes run out. And the local view is driven purely by what the
 * server still reports: {@code /sessions/active} only ever returns a genuinely usable session, so a
 * session disappearing from that list is what tears the room and any running call down here — no
 * client-side timer can keep it alive.
 */
export const SupportHandshakePrompt = () => {
	const { t } = useTranslation();
	const [pending, setPending] = useState<SupportHandshake[]>([]);
	const [sessions, setSessions] = useState<SupportAccessSession[]>([]);
	const [password, setPassword] = useState('');
	const [otp, setOtp] = useState('');
	const [error, setError] = useState(false);
	const [submitting, setSubmitting] = useState(false);
	const [countdown, setCountdown] = useState(0);
	const [justRevoked, setJustRevoked] = useState(false);
	const hadSessionRef = useRef(false);

	const refresh = useCallback(async () => {
		const [nextPending, nextSessions] = await Promise.all([
			apiGetPendingSupportHandshakes(),
			apiGetActiveSupportSessions()
		]);
		setPending(nextPending);
		setSessions(nextSessions);

		// A session that is no longer reported has lost access server-side — whether by expiry, by
		// the support admin being blocked, or by an early termination somewhere else.
		if (hadSessionRef.current && nextSessions.length === 0) {
			setJustRevoked(true);
		}
		hadSessionRef.current = nextSessions.length > 0;
	}, []);

	useEffect(() => {
		const run = () => void refresh().catch(() => setError(true));
		run();
		const interval = window.setInterval(run, POLL_INTERVAL_MS);
		// Coming back to the tab must not cost up to a full interval: a request only lives five
		// minutes, so a stale popup is worse than an extra request.
		const onFocus = () => run();
		window.addEventListener('focus', onFocus);
		document.addEventListener('visibilitychange', onFocus);
		return () => {
			window.clearInterval(interval);
			window.removeEventListener('focus', onFocus);
			document.removeEventListener('visibilitychange', onFocus);
		};
	}, [refresh]);

	useEffect(() => {
		setCountdown(secondsLeft(pending[0]?.expiryDate));
		if (!pending.length) return undefined;
		const timer = window.setInterval(
			() => setCountdown(secondsLeft(pending[0]?.expiryDate)),
			1000
		);
		return () => window.clearInterval(timer);
	}, [pending]);

	const confirm = async () => {
		setSubmitting(true);
		setError(false);
		try {
			await apiConfirmSupportHandshake(pending[0].id, password, otp);
			setPassword('');
			setOtp('');
			await refresh();
		} catch {
			setError(true);
		} finally {
			setSubmitting(false);
		}
	};

	const decline = async () => {
		setSubmitting(true);
		setError(false);
		try {
			await apiDeclineSupportHandshake(pending[0].id);
			setPassword('');
			setOtp('');
			await refresh();
		} catch {
			setError(true);
		} finally {
			setSubmitting(false);
		}
	};

	const terminate = async (sessionId: string) => {
		setSubmitting(true);
		setError(false);
		try {
			await apiTerminateSupportSession(sessionId);
			await refresh();
		} catch {
			setError(true);
		} finally {
			setSubmitting(false);
		}
	};

	const session = sessions[0];
	const lapsed = pending.length > 0 && countdown === 0;

	return (
		<>
			{justRevoked && !session && (
				<Alert
					severity="info"
					data-cy="support-session-ended"
					onClose={() => setJustRevoked(false)}
					sx={{
						position: 'fixed',
						zIndex: 1400,
						right: 24,
						bottom: 24
					}}
				>
					{t('supportAccess.ended')}
				</Alert>
			)}
			{session && (
				<Box
					sx={{
						position: 'fixed',
						zIndex: 1400,
						right: 24,
						bottom: 24,
						width: { xs: 'calc(100% - 32px)', sm: 520 },
						maxHeight: 'calc(100vh - 48px)',
						overflowY: 'auto'
					}}
					data-cy="support-session-panel"
				>
					<Alert
						severity="warning"
						action={
							<Button
								color="inherit"
								disabled={submitting}
								onClick={() => void terminate(session.id)}
								data-cy="support-session-terminate"
							>
								{t('supportAccess.terminate')}
							</Button>
						}
					>
						{session.status === 'PROVISIONING'
							? t('supportAccess.provisioning')
							: t('supportAccess.active', {
									expiry: new Date(
										session.expiryDate
									).toLocaleTimeString()
								})}
					</Alert>
					{session.status === 'ACTIVE' && session.matrixRoomId && (
						<SupportRoomConversation
							roomId={session.matrixRoomId}
							sessionId={session.id}
						/>
					)}
				</Box>
			)}
			<Dialog
				open={pending.length > 0}
				disableEscapeKeyDown
				aria-labelledby="support-handshake-title"
				data-cy="support-handshake-dialog"
			>
				<DialogTitle id="support-handshake-title">
					{t('supportAccess.request.title')}
				</DialogTitle>
				<DialogContent>
					<Box
						sx={{
							display: 'grid',
							gap: 2,
							minWidth: { sm: 420 },
							pt: 1
						}}
					>
						<Alert severity={lapsed ? 'warning' : 'info'}>
							{lapsed
								? t('supportAccess.request.lapsed')
								: t('supportAccess.request.description', {
										countdown: formatCountdown(countdown)
									})}
						</Alert>
						{error && (
							<Alert severity="error">
								{t('supportAccess.error')}
							</Alert>
						)}
						<TextField
							autoComplete="current-password"
							autoFocus
							fullWidth
							disabled={lapsed}
							label={t('supportAccess.password')}
							onChange={(event) =>
								setPassword(event.target.value)
							}
							type="password"
							value={password}
							inputProps={{
								'data-cy': 'support-confirm-password'
							}}
						/>
						<TextField
							autoComplete="one-time-code"
							fullWidth
							disabled={lapsed}
							label={t('supportAccess.otp')}
							onChange={(event) => setOtp(event.target.value)}
							value={otp}
							inputProps={{
								'inputMode': 'numeric',
								'maxLength': 16,
								'data-cy': 'support-confirm-otp'
							}}
						/>
					</Box>
				</DialogContent>
				<DialogActions>
					<Button
						disabled={submitting}
						onClick={() => void decline()}
						data-cy="support-handshake-decline"
					>
						{t('supportAccess.decline')}
					</Button>
					<Button
						disabled={!password || !otp || submitting || lapsed}
						onClick={() => void confirm()}
						variant="contained"
						data-cy="support-handshake-confirm"
					>
						{t('supportAccess.approve')}
					</Button>
				</DialogActions>
			</Dialog>
		</>
	);
};
