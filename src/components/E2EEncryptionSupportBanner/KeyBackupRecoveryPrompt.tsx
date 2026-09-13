import { UserDataContext } from '../../globalState';
import { Link } from 'react-router-dom';
import * as React from 'react';
import { useCallback, useContext, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { useMatrixClient } from '../../globalState/context/MatrixClientContext';
import {
	InvalidRecoveryKeyError,
	recoverWithKey
} from '../../services/matrixKeyBackupService';
import {
	getPendingRecoveryKey,
	savePendingRecoveryKey
} from '../../services/pendingRecoveryKeyStore';
import {
	useRecoveryReminder,
	subscribeRecoveryState,
	isActionableRecoveryStatus,
	useRecoveryRuntimeStatus,
	setRecoveryRuntimeStatus
} from '../../services/recoveryReminderState';
import { executeWithReadyEncryptionClient } from '../profile/EncryptionSettings/encryptionClient';
import { OrisoDialog } from '../modal/OrisoDialog';
import { ReactComponent as RecoverySafeIcon } from '../../resources/img/icons/recovery-safe.svg';
import './E2EEncryptionSupportBanner.styles.scss';

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
					? translate(
							'encryption.keyBackup.dialog.invalidKey',
							'Dieser Ersatzschlüssel ist ungültig. Bitte prüfen Sie die Eingabe.'
						)
					: translate(
							'encryption.keyBackup.dialog.error',
							'Die Wiederherstellung ist fehlgeschlagen. Bitte versuchen Sie es erneut.'
						)
			);
		} finally {
			setBusy(false);
		}
	}, [busy, onClose, onRecover, recoveryKey, translate]);

	return (
		<OrisoDialog
			open
			onClose={onClose}
			title={translate(
				'encryption.keyBackup.dialog.recoveryTitle',
				'Schön, dass Sie wieder da sind'
			)}
			icon={<RecoverySafeIcon />}
			maxWidth="560px"
			height="auto"
			hideActions
		>
			<div
				className="keyBackupDialog"
				data-cy="key-backup-recovery-dialog"
			>
				<p>
					{translate(
						'encryption.keyBackup.dialog.recoveryCopy',
						'Sie sind auf einem neuen Gerät angemeldet. Ihr bisheriger Gesprächsverlauf liegt sicher verschlossen in Ihrem Tresor.'
					)}
				</p>
				<p>
					{translate(
						'encryption.keyBackup.dialog.recoveryInstruction',
						'Geben Sie Ihren Ersatzschlüssel ein, um Ihre Nachrichten hier weiterzulesen.'
					)}
				</p>
				<label className="keyBackupDialog__field">
					<span>
						{translate(
							'encryption.keyBackup.dialog.keyLabel',
							'Ersatzschlüssel'
						)}
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
						{translate(
							'encryption.keyBackup.dialog.later',
							'Später'
						)}
					</button>
					<button
						type="button"
						className="keyBackupDialog__primary"
						onClick={() => void submitRecovery()}
						disabled={!recoveryKey.trim() || busy}
					>
						{busy
							? translate(
									'encryption.keyBackup.dialog.restoring',
									'Wird wiederhergestellt …'
								)
							: translate(
									'encryption.keyBackup.dialog.openVault',
									'Tresor öffnen'
								)}
					</button>
				</div>
			</div>
		</OrisoDialog>
	);
};

/** Recovery is available inline; opening the restore dialog is always explicit. */
export const KeyBackupRecoveryPrompt = () => {
	const { t } = useTranslation();
	const { matrixClientService } = useMatrixClient();
	const passwordMode =
		useContext(UserDataContext)?.userData?.chatRecoveryMode ===
		'LOGIN_PASSWORD';
	const userId = matrixClientService?.getClient()?.getUserId() ?? '';
	const status = useRecoveryRuntimeStatus(userId);
	const eligible = useRecoveryReminder(userId);
	const key = useSyncExternalStore(
		subscribeRecoveryState,
		() => (userId ? getPendingRecoveryKey(userId) : null),
		() => null
	);
	const [openedFor, setOpenedFor] = useState<string | null>(null);
	const showRecovery = openedFor === userId;
	if (!isActionableRecoveryStatus(status) || (eligible && !!key)) return null;
	return (
		<>
			<aside
				className="encryption-recovery-notice"
				aria-live="polite"
				data-cy="key-backup-recovery-action"
			>
				{eligible && <p>{t('encryption.saveReminder.unavailable')}</p>}
				<span>{t('encryption.passwordRecovery.' + status)}</span>
				<button type="button" onClick={() => setOpenedFor(userId)}>
					{t('encryption.keyBackup.dialog.openVault')}
				</button>
				<Link to="/profile/einstellungen/sicherheit">
					{t('encryption.passwordRecovery.settings')}
				</Link>
			</aside>
			{showRecovery && (
				<KeyBackupRecoveryDialog
					onClose={() => setOpenedFor(null)}
					onRecover={async (key) => {
						const result = await executeWithReadyEncryptionClient(
							undefined,
							matrixClientService,
							async (client) => {
								const recovered = await recoverWithKey(
									client,
									key
								);
								const id = client.getUserId();
								if (id) {
									if (passwordMode)
										savePendingRecoveryKey(id, key);
									setRecoveryRuntimeStatus(
										id,
										passwordMode
											? 'needs-password'
											: 'ready'
									);
								}
								return recovered;
							}
						);
						if (!result)
							throw new Error(
								'Matrix recovery client unavailable'
							);
						return result.imported;
					}}
				/>
			)}
		</>
	);
};
