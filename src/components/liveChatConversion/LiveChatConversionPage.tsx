import * as React from 'react';
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
	Alert,
	Box,
	Button,
	Stack,
	TextField,
	Typography
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { UserDataContext } from '../../globalState';
import { getCurrentAuthSubject } from '../sessionCookie/getMatrixAccessToken';
import { MATRIX_SESSION_SUBJECT_STORAGE_KEY } from '../../utils/matrixStorageKeys';
import { useMatrixClient } from '../../globalState/context/MatrixClientContext';
import { RecoveryKeySaveStep } from '../profile/EncryptionSettings/RecoveryKeySaveStep';
import { NewRequestDialog } from '../profile/NewRequestDialog/NewRequestDialog';
import { Loading } from '../app/Loading';
import { LiveChatConversionForm } from './LiveChatConversionForm';
import {
	convertLiveChatAccount,
	getConversionStatus,
	type ConversionStatus
} from './liveChatConversionApi';
import { prepareGuestRecovery } from './prepareGuestRecovery';

/** Runs inside AuthenticatedApp: Matrix is bootstrapped for the existing identity first. */
export const LiveChatConversionPage = () => {
	const { t } = useTranslation();
	const location = useLocation();
	const { userData } = useContext(UserDataContext);
	const { matrixClientService } = useMatrixClient();
	const [status, setStatus] = useState<ConversionStatus | null>(null);
	const [key, setKey] = useState<string | null>(null);
	const [keyConfirmed, setKeyConfirmed] = useState(false);
	const [suppliedKey, setSuppliedKey] = useState('');
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [username, setUsername] = useState<string | null>(null);
	const [newRequest, setNewRequest] = useState(false);
	const intent = useRef<string | null>(null);
	const preparedClient =
		useRef<
			ReturnType<NonNullable<typeof matrixClientService>['getClient']>
		>(null);
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

	const prepare = useCallback(async () => {
		setBusy(true);
		setError(null);
		try {
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
			const { client, result } = await service.holdTokenRefreshDuring(
				async () => {
					const client = service.getClient();
					if (
						!client ||
						service.getAuthenticatedSubject() !== fresh.userId
					)
						throw new Error('Matrix not ready');
					const result = await prepareGuestRecovery(
						client,
						suppliedKey
					);
					if (
						service.getClient() !== client ||
						service.getAuthenticatedSubject() !== fresh.userId
					)
						throw new Error('Matrix client changed');
					return { client, result };
				}
			);
			const after = await getConversionStatus();
			if (
				after.userId !== fresh.userId ||
				!currentSubjectMatches(fresh.userId) ||
				service.getClient() !== client ||
				service.getAuthenticatedSubject() !== fresh.userId
			)
				throw new Error('Account changed');
			preparedClient.current = client;
			setKey(result);
		} catch {
			setError('recovery');
		} finally {
			setBusy(false);
		}
	}, [matrixClientService, status, suppliedKey, userData?.userId]);

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
			setError('save');
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
						{tr(
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
					{status.finishedOrigin ? (
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
						open={newRequest}
						onClose={() => setNewRequest(false)}
					/>
				</Stack>
			</Box>
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
					status?.state === 'FINISH_PENDING' ||
					status?.state === 'CLEANUP_STARTED') && (
					<Alert severity="error">
						{tr(
							'unavailable',
							'This account cannot be converted. Please contact your counsellor.'
						)}
					</Alert>
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
						<TextField
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
