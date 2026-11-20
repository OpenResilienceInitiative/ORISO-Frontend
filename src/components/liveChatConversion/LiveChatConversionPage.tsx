import * as React from 'react';
import {
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState
} from 'react';
import type { MatrixClient } from 'matrix-js-sdk';
import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { UserDataContext } from '../../globalState';
import { getCurrentAuthSubject } from '../sessionCookie/getMatrixAccessToken';
import { MATRIX_SESSION_SUBJECT_STORAGE_KEY } from '../../utils/matrixStorageKeys';
import { useMatrixClient } from '../../globalState/context/MatrixClientContext';
import {
	getChatRecoveryPolicy,
	type ChatRecoveryPolicy
} from '../../services/chatRecoveryPolicy';
import { sealRecoveryUnderFirstPassword } from '../../services/authenticatedChatRecovery';
import { executeWithReadyEncryptionClient } from '../profile/EncryptionSettings/encryptionClient';
import { OrisoTextField } from '../form/OrisoTextField';
import { RecoveryKeySaveStep } from '../profile/EncryptionSettings/RecoveryKeySaveStep';
import { NewRequestDialog } from '../profile/NewRequestDialog/NewRequestDialog';
import { useFurtherCounsellingPrefill } from '../furtherCounselling/useFurtherCounsellingPrefill';
import { Loading } from '../app/Loading';
import { LiveChatConversionForm } from './LiveChatConversionForm';
import {
	convertLiveChatAccount,
	getConversionStatus,
	type ConversionStatus
} from './liveChatConversionApi';
import { prepareGuestRecovery } from './prepareGuestRecovery';

/** FE#2334: an unreadable policy keeps today's recovery-key flow. */
const readRecoveryPolicy = (account: {
	chatRecoveryMode?: string | null;
	chatRecoveryPolicyRevision?: number | null;
}): ChatRecoveryPolicy => {
	try {
		return getChatRecoveryPolicy(account);
	} catch {
		return { mode: 'RECOVERY_KEY' };
	}
};

/** Runs inside AuthenticatedApp: Matrix is bootstrapped for the existing identity first. */
export const LiveChatConversionPage = () => {
	const { t } = useTranslation();
	const location = useLocation();
	const { userData } = useContext(UserDataContext);
	const { matrixClientService } = useMatrixClient();
	// FE#2251: same prefill as the 1:1 card; the live chat's placeholder
	// postcode is never offered (pickPrefilledPostcode).
	const { prefilledPostcode, knownAgencyIds } =
		useFurtherCounsellingPrefill();
	const [status, setStatus] = useState<ConversionStatus | null>(null);
	const [key, setKey] = useState<string | null>(null);
	const [keyConfirmed, setKeyConfirmed] = useState(false);
	const [suppliedKey, setSuppliedKey] = useState('');
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [username, setUsername] = useState<string | null>(null);
	const [newRequest, setNewRequest] = useState(false);
	const [signInRequired, setSignInRequired] = useState(false);
	/* Shown only when sealing under the new password failed after the account
	   was converted: the key is then the only way back to the history. */
	const [fallbackKey, setFallbackKey] = useState<string | null>(null);
	const intent = useRef<string | null>(null);
	const preparedClient = useRef<MatrixClient | null>(null);
	const policy = useMemo(
		() =>
			readRecoveryPolicy({
				chatRecoveryMode: userData?.chatRecoveryMode,
				chatRecoveryPolicyRevision: userData?.chatRecoveryPolicyRevision
			}),
		[userData?.chatRecoveryMode, userData?.chatRecoveryPolicyRevision]
	);
	const passwordRecovery = policy.mode === 'LOGIN_PASSWORD';
	const tr = (name: string, fallback: string) =>
		t(`liveChatConversion.${name}`, fallback);
	const currentSubjectMatches = (id: string) =>
		getCurrentAuthSubject() === id &&
		localStorage.getItem(MATRIX_SESSION_SUBJECT_STORAGE_KEY) === id;

	useEffect(() => {
		let active = true;
		getConversionStatus()
			.then((next) => {
				if (!active) return;
				if (!userData?.userId || next.userId !== userData.userId) {
					setError('account');
					return;
				}
				intent.current = next.intentId;
				setStatus(next);
				if (next.state === 'PROMOTED') setUsername(next.username);
			})
			.catch(() => {
				if (active) setError('status');
			});
		return () => {
			active = false;
		};
	}, [userData?.userId, userData?.userName]);

	/**
	 * Back the guest's chat keys up on this device, on the synced client only:
	 * the first click used to fail on a client that had not finished its first
	 * sync (FE#2334). Resolves with the client and the recovery key it proved.
	 */
	const prepareOnReadyClient = useCallback(async () => {
		if (!status || !userData?.userId)
			throw new Error('Account unavailable');
		const fresh = await getConversionStatus();
		if (
			fresh.userId !== status.userId ||
			fresh.userId !== userData.userId ||
			!currentSubjectMatches(fresh.userId)
		)
			throw new Error('Account changed');
		const service = matrixClientService;
		if (!service) throw new Error('Matrix not ready');
		const prepared = await executeWithReadyEncryptionClient(
			undefined,
			service,
			async (client) => {
				if (service.getAuthenticatedSubject() !== fresh.userId)
					throw new Error('Matrix not ready');
				const key = await prepareGuestRecovery(client, suppliedKey);
				if (
					service.getClient() !== client ||
					service.getAuthenticatedSubject() !== fresh.userId
				)
					throw new Error('Matrix client changed');
				return { client, key };
			}
		);
		if (!prepared) throw new Error('Matrix not ready');
		const after = await getConversionStatus();
		if (
			after.userId !== fresh.userId ||
			!currentSubjectMatches(fresh.userId) ||
			service.getClient() !== prepared.client ||
			service.getAuthenticatedSubject() !== fresh.userId
		)
			throw new Error('Account changed');
		return prepared;
	}, [matrixClientService, status, suppliedKey, userData?.userId]);

	const prepare = useCallback(async () => {
		setBusy(true);
		setError(null);
		try {
			const { client, key: provenKey } = await prepareOnReadyClient();
			preparedClient.current = client;
			setKey(provenKey);
		} catch {
			setError('recovery');
		} finally {
			setBusy(false);
		}
	}, [prepareOnReadyClient]);

	/**
	 * LOGIN_PASSWORD (FE#2334): no recovery key is shown. Back the history up
	 * first — no conversion without it —, convert, then seal the backup under
	 * the password just accepted (same contract as keeping a temporary
	 * account, US#1662). Sealing before the server accepted the password
	 * could lock the backup under a password that never became the login.
	 */
	const submitWithPasswordRecovery = async (password: string) => {
		if (busy || policy.mode !== 'LOGIN_PASSWORD') return;
		setBusy(true);
		setError(null);
		let prepared: Awaited<ReturnType<typeof prepareOnReadyClient>>;
		try {
			prepared = await prepareOnReadyClient();
		} catch {
			setError('recovery');
			setBusy(false);
			return;
		}
		try {
			const fresh = await getConversionStatus();
			if (
				!status ||
				fresh.userId !== status.userId ||
				!currentSubjectMatches(fresh.userId) ||
				matrixClientService?.getClient() !== prepared.client
			)
				throw new Error('Account changed');
			const currentIntent = intent.current ?? crypto.randomUUID();
			intent.current = currentIntent;
			const loginName = await convertLiveChatAccount(
				status.userId,
				currentIntent,
				password
			);
			const sealed = await sealRecoveryUnderFirstPassword(
				prepared.client,
				policy,
				password,
				(operation) =>
					matrixClientService
						? matrixClientService.holdTokenRefreshDuring(operation)
						: operation()
			);
			if (sealed !== 'ready') setFallbackKey(prepared.key);
			const finishedOrigin =
				fresh.finishedOrigin || fresh.state === 'ANONYMOUS_FINISHED';
			setUsername(loginName);
			setSignInRequired(finishedOrigin);
			setStatus({
				userId: status.userId,
				username: loginName,
				state: 'PROMOTED',
				intentId: currentIntent,
				finishedOrigin
			});
			setSuppliedKey('');
		} catch {
			setError('save');
		} finally {
			setBusy(false);
		}
	};

	const submit = async (password: string) => {
		if (!key || !keyConfirmed || busy) return;
		setBusy(true);
		setError(null);
		try {
			if (
				!status ||
				!userData?.userId ||
				status.userId !== userData.userId ||
				!preparedClient.current ||
				matrixClientService?.getClient() !== preparedClient.current ||
				matrixClientService?.getAuthenticatedSubject() !== status.userId
			)
				throw new Error('Account changed');
			const fresh = await getConversionStatus();
			if (
				fresh.userId !== status.userId ||
				!currentSubjectMatches(fresh.userId) ||
				matrixClientService?.getClient() !== preparedClient.current ||
				matrixClientService?.getAuthenticatedSubject() !== status.userId
			)
				throw new Error('Account changed');
			const currentIntent = intent.current ?? crypto.randomUUID();
			intent.current = currentIntent;
			const loginName = await convertLiveChatAccount(
				status.userId,
				currentIntent,
				password
			);
			setUsername(loginName);
			setSignInRequired(
				fresh.finishedOrigin || fresh.state === 'ANONYMOUS_FINISHED'
			);
			setStatus({
				userId: status.userId,
				username: loginName,
				state: 'PROMOTED',
				intentId: currentIntent,
				finishedOrigin:
					fresh.finishedOrigin || fresh.state === 'ANONYMOUS_FINISHED'
			});
			setKey(null);
			setSuppliedKey('');
		} catch {
			if (
				preparedClient.current &&
				(matrixClientService?.getClient() !== preparedClient.current ||
					matrixClientService?.getAuthenticatedSubject() !==
						status?.userId)
			) {
				preparedClient.current = null;
				setKey(null);
				setKeyConfirmed(false);
				setError('recovery');
			} else {
				setError('save');
			}
		} finally {
			setBusy(false);
		}
	};

	const retryFinishStatus = async () => {
		if (
			!status ||
			!userData?.userId ||
			!currentSubjectMatches(status.userId)
		) {
			setError('account');
			return;
		}
		setBusy(true);
		try {
			const next = await getConversionStatus();
			if (
				next.userId !== status.userId ||
				next.userId !== userData.userId ||
				!currentSubjectMatches(next.userId)
			)
				throw new Error('Account changed');
			intent.current = next.intentId;
			setStatus(next);
			setError(null);
		} catch {
			setError('status');
		} finally {
			setBusy(false);
		}
	};

	const startRequest = async () => {
		try {
			if (
				!status ||
				!userData?.userId ||
				!currentSubjectMatches(status.userId)
			)
				throw new Error('Account changed');
			const fresh = await getConversionStatus();
			if (
				fresh.userId !== status.userId ||
				fresh.userId !== userData.userId ||
				!currentSubjectMatches(fresh.userId) ||
				!['PROMOTED', 'ALREADY_REGISTERED'].includes(fresh.state)
			) {
				throw new Error('Account changed');
			}
			setNewRequest(true);
		} catch {
			setError('account');
		}
	};

	if (!status && !error) return <Loading delayMs={0} />;

	if (fallbackKey && status?.state === 'PROMOTED') {
		return (
			<Box sx={{ maxWidth: 560, mx: 'auto', p: 3 }}>
				<Typography component="h1" variant="h4">
					{tr('title', 'Keep your conversation')}
				</Typography>
				<Typography>
					{tr(
						'fallbackKeyHelp',
						'Your account is ready, but your chat history could not be linked to your password yet. Save this recovery key: you need it to read this conversation on a new device.'
					)}
				</Typography>
				<RecoveryKeySaveStep
					recoveryKey={fallbackKey}
					onConfirm={() => setFallbackKey(null)}
				/>
			</Box>
		);
	}

	if (
		status?.state === 'ALREADY_REGISTERED' ||
		status?.state === 'PROMOTED'
	) {
		return (
			<Box sx={{ maxWidth: 560, mx: 'auto', p: 3 }}>
				<Stack spacing={2}>
					<Typography component="h1" variant="h4">
						{tr('readyTitle', 'Your account is ready')}
					</Typography>
					{username && (
						<Typography>
							{tr('loginName', 'Your login name:')}{' '}
							<strong>{username}</strong>
						</Typography>
					)}
					<Typography>
						{status.state === 'ALREADY_REGISTERED'
							? tr(
									'ownAccountHelp',
									'You can start a written request from this account.'
								)
							: tr(
									'readyHelp',
									'Your Live Chat stays in this account. You can now start a written request.'
								)}
					</Typography>
					{error === 'account' && (
						<Alert severity="error">
							{tr(
								'accountChanged',
								'The signed-in account changed. Reload to continue safely.'
							)}
						</Alert>
					)}
					{signInRequired ? (
						<>
							<Typography>
								{tr(
									'signInAgain',
									'Sign in again with this login name and your new password.'
								)}
							</Typography>
							<Button variant="contained" href="/login">
								{t('accountInvite.toLogin', 'Go to sign in')}
							</Button>
						</>
					) : (
						<Button variant="contained" onClick={startRequest}>
							{tr('startRequest', 'Start a written request')}
						</Button>
					)}
					<NewRequestDialog
						preselectedTopicId={
							typeof location.state?.topicId === 'number'
								? location.state.topicId
								: undefined
						}
						prefilledPostcode={prefilledPostcode}
						knownAgencyIds={knownAgencyIds}
						open={newRequest}
						onClose={() => setNewRequest(false)}
					/>
				</Stack>
			</Box>
		);
	}
	if (
		passwordRecovery &&
		(status?.state === 'ELIGIBLE' ||
			status?.state === 'ANONYMOUS_FINISHED' ||
			status?.state === 'PROMOTION_PENDING')
	) {
		return (
			<LiveChatConversionForm
				loginName={status.username}
				busy={busy}
				notice={
					status.state === 'PROMOTION_PENDING'
						? tr(
								'pending',
								'A previous attempt is pending. Use the same password to finish it.'
							)
						: null
				}
				error={
					error === 'save'
						? tr(
								'saveError',
								'The account could not be saved. Please retry with the same password.'
							)
						: error === 'recovery'
							? tr(
									'historyError',
									'Your chat history could not be secured yet. Please try again.'
								)
							: null
				}
				onSubmit={submitWithPasswordRecovery}
			/>
		);
	}
	if (key && !keyConfirmed) {
		return (
			<Box sx={{ maxWidth: 560, mx: 'auto', p: 3 }}>
				<Typography component="h1" variant="h4">
					{tr('title', 'Keep your conversation')}
				</Typography>
				<Typography>
					{tr(
						'keyHelp',
						'Save this recovery key somewhere safe. You need it and your password to read this conversation on a new device.'
					)}
				</Typography>
				<RecoveryKeySaveStep
					recoveryKey={key}
					onConfirm={() => setKeyConfirmed(true)}
				/>
			</Box>
		);
	}
	if (
		key &&
		(status?.state === 'ELIGIBLE' ||
			status?.state === 'ANONYMOUS_FINISHED' ||
			status?.state === 'PROMOTION_PENDING')
	) {
		return (
			<LiveChatConversionForm
				loginName={status.username}
				busy={busy}
				error={
					error === 'save'
						? tr(
								'saveError',
								'The account could not be saved. Please retry with the same password.'
							)
						: null
				}
				onSubmit={submit}
			/>
		);
	}
	return (
		<Box sx={{ maxWidth: 560, mx: 'auto', p: 3 }}>
			<Stack spacing={2}>
				<Typography component="h1" variant="h4">
					{tr('title', 'Keep your conversation')}
				</Typography>
				{(error === 'status' || error === 'account') && (
					<Alert severity="error">
						{tr(
							'statusError',
							'Account status is unavailable. Reload to try again.'
						)}
					</Alert>
				)}
				{(status?.state === 'NOT_ELIGIBLE' ||
					status?.state === 'CLEANUP_STARTED') && (
					<Alert severity="error">
						{tr(
							'unavailable',
							'This account cannot be converted. Please contact your counsellor.'
						)}
					</Alert>
				)}
				{status?.state === 'FINISH_PENDING' && (
					<>
						<Alert severity="info">
							{t('app.wait', 'Please wait')}
						</Alert>
						<Button disabled={busy} onClick={retryFinishStatus}>
							{t('attachments.gate.retry', 'Try again')}
						</Button>
					</>
				)}
				{(status?.state === 'ELIGIBLE' ||
					status?.state === 'ANONYMOUS_FINISHED' ||
					status?.state === 'PROMOTION_PENDING') && (
					<>
						<Typography>
							{tr(
								'recoveryIntro',
								'First prepare the recovery key for your existing conversation. This keeps your messages accessible on a new device.'
							)}
						</Typography>
						{status.state === 'PROMOTION_PENDING' && (
							<Alert severity="info">
								{tr(
									'pending',
									'A previous attempt is pending. Use the same password to finish it.'
								)}
							</Alert>
						)}
						{error === 'recovery' && (
							<Alert severity="error">
								{tr(
									'recoveryError',
									'The recovery key is not available yet. Retry, or enter the key you saved previously.'
								)}
							</Alert>
						)}
						<OrisoTextField
							type="password"
							autoComplete="off"
							label={tr(
								'existingKey',
								'Previously saved recovery key (if needed)'
							)}
							value={suppliedKey}
							onChange={(event) =>
								setSuppliedKey(event.target.value)
							}
						/>
						<Button
							variant="contained"
							onClick={prepare}
							disabled={busy}
						>
							{tr('prepare', 'Prepare recovery key')}
						</Button>
					</>
				)}
			</Stack>
		</Box>
	);
};
