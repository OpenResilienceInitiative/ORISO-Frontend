import * as React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMatrixClient } from '../../globalState/context/MatrixClientContext';
import {
	canBootstrapSilently,
	getEncryptionStatus,
	InvalidRecoveryKeyError,
	recoverWithKey,
	setUpRecovery
} from '../../services/matrixKeyBackupService';
import {
	RecoverySetupBusyError,
	savePendingRecoveryKey,
	withRecoverySetupLock
} from '../../services/pendingRecoveryKeyStore';
import { executeWithReadyEncryptionClient } from '../profile/EncryptionSettings/encryptionClient';
import { OrisoDialog } from '../modal/OrisoDialog';
import { ReactComponent as RecoverySafeIcon } from '../../resources/img/icons/recovery-safe.svg';
import './E2EEncryptionSupportBanner.styles.scss';

const DISMISS_KEY = 'hideKeyBackupPrompt';

type KeyBackupRecoveryDialogProps = {
	onClose: () => void;
	onRecover: (recoveryKey: string) => Promise<number>;
};

export const KeyBackupRecoveryDialog = ({
	onClose,
	onRecover
}: KeyBackupRecoveryDialogProps) => {
	const { t: translate } = useTranslation();
	const [recoveryKey, setRecoveryKey] = useState('');
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const submitRecovery = useCallback(async () => {
		if (!recoveryKey.trim() || busy) {
			return;
		}
		setBusy(true);
		setError(null);
		try {
			await onRecover(recoveryKey);
			onClose();
		} catch (recoverError) {
			setError(
				recoverError instanceof InvalidRecoveryKeyError
					? translate('encryption.keyBackup.dialog.invalidKey')
					: translate('encryption.keyBackup.dialog.error')
			);
		} finally {
			setBusy(false);
		}
	}, [busy, onClose, onRecover, recoveryKey, translate]);

	return (
		<OrisoDialog
			open
			onClose={onClose}
			title={translate('encryption.keyBackup.dialog.recoveryTitle')}
			icon={<RecoverySafeIcon />}
			maxWidth="560px"
			height="auto"
			hideActions
		>
			<div
				className="keyBackupDialog"
				data-cy="key-backup-recovery-dialog"
			>
				<p>{translate('encryption.keyBackup.dialog.recoveryCopy')}</p>
				<p>
					{translate(
						'encryption.keyBackup.dialog.recoveryInstruction'
					)}
				</p>
				<label className="keyBackupDialog__field">
					<span>
						{translate('encryption.keyBackup.dialog.keyLabel')}
					</span>
					<input
						type="text"
						value={recoveryKey}
						onChange={(event) => setRecoveryKey(event.target.value)}
						autoComplete="off"
						disabled={busy}
					/>
				</label>
				{error && (
					<p className="keyBackupDialog__error" role="alert">
						{error}
					</p>
				)}

				<div className="keyBackupDialog__actions">
					<button
						type="button"
						className="keyBackupDialog__later"
						onClick={onClose}
						disabled={busy}
					>
						{translate('encryption.keyBackup.dialog.later')}
					</button>
					<button
						type="button"
						className="keyBackupDialog__primary"
						onClick={() => void submitRecovery()}
						disabled={!recoveryKey.trim() || busy}
					>
						{busy
							? translate('encryption.keyBackup.dialog.restoring')
							: translate(
									'encryption.keyBackup.dialog.openVault'
								)}
					</button>
				</div>
			</div>
		</OrisoDialog>
	);
};

/**
 * #437 login-time key-backup handling. Two situations, deliberately handled
 * very differently:
 *
 * - **New device, backup on the server** — only the user can unlock it, so we
 *   ask: the recovery dialog opens and takes their recovery key.
 * - **Fresh account, no backup yet** — nothing to ask about. The Tresor is
 *   bootstrapped silently in the background and the generated recovery key is
 *   parked for the Sicherheit panel, which shows it when the user gets there.
 *   Nobody is stopped mid-Anfrage by a modal they cannot act on usefully.
 *
 * Probes once per mount, only after sync reaches PREPARED. Dismissal is
 * session-scoped *and* bound to the user who dismissed, so we do not nag on
 * every navigation but a different account logging into the same tab still
 * gets its own answer. It only ever silences the dialog — the background
 * setup is not something the user dismissed, so it always gets to run.
 */
export const KeyBackupRecoveryPrompt = () => {
	const { matrixClientService } = useMatrixClient();
	const [showRecovery, setShowRecovery] = useState(false);
	const probedRef = useRef(false);
	const userIdRef = useRef<string | null>(null);

	useEffect(() => {
		if (!matrixClientService) {
			return undefined;
		}

		let cancelled = false;

		/**
		 * Best-effort bootstrap. Every failure path stays silent: the user did
		 * not ask for this, so an error here must not become their problem —
		 * the Sicherheit panel still offers the explicit setup.
		 */
		const bootstrapSilently = async (userId: string) => {
			try {
				// The lock keeps a second tab — or the panel's manual setup —
				// from creating a rival recovery key while this one runs.
				const encodedKey = await withRecoverySetupLock(userId, () =>
					executeWithReadyEncryptionClient(
						undefined,
						matrixClientService,
						setUpRecovery
					)
				);
				if (encodedKey) {
					savePendingRecoveryKey(userId, encodedKey);
				}
			} catch (setupError) {
				if (setupError instanceof RecoverySetupBusyError) {
					// Someone else is already on it; theirs wins, ours is a no-op.
					return;
				}
				console.warn('Silent key-backup setup failed', setupError);
			}
		};

		const unsubscribe = matrixClientService.onSyncStateChange(
			(state: string | null) => {
				if (state !== 'PREPARED' || probedRef.current) {
					return;
				}
				probedRef.current = true;
				const client = matrixClientService.getClient();
				if (!client) {
					return;
				}
				const userId = client.getUserId();
				userIdRef.current = userId;
				getEncryptionStatus(client)
					.then((status) => {
						if (cancelled) {
							return;
						}
						if (status.keyStorageOutOfSync) {
							if (
								sessionStorage.getItem(DISMISS_KEY) !== userId
							) {
								setShowRecovery(true);
							}
							return;
						}
						if (userId && canBootstrapSilently(status)) {
							void bootstrapSilently(userId);
						}
					})
					.catch(() => {
						// Best-effort nudge — never surface crypto probe errors.
					});
			}
		);

		return () => {
			cancelled = true;
			unsubscribe();
		};
	}, [matrixClientService]);

	if (!showRecovery) {
		return null;
	}

	const closePrompt = () => {
		// Remember *who* dismissed: the next account in this tab has not.
		sessionStorage.setItem(DISMISS_KEY, userIdRef.current ?? 'true');
		setShowRecovery(false);
	};

	return (
		<KeyBackupRecoveryDialog
			onClose={closePrompt}
			onRecover={async (recoveryKey) => {
				const result = await executeWithReadyEncryptionClient(
					undefined,
					matrixClientService,
					(client) => recoverWithKey(client, recoveryKey)
				);
				if (!result) {
					throw new Error('Matrix recovery client unavailable');
				}
				return result.imported;
			}}
		/>
	);
};
