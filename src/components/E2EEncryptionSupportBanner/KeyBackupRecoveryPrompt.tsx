import { UserDataContext } from '../../globalState';
import { Link } from 'react-router-dom';
import * as React from 'react';
import { useCallback, useContext, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMatrixClient } from '../../globalState/context/MatrixClientContext';
import {
	InvalidRecoveryKeyError,
	recoverWithKey
} from '../../services/matrixKeyBackupService';
import {
	usePendingRecoveryKey,
	savePendingRecoveryKey
} from '../../services/pendingRecoveryKeyStore';
import {
	useRecoveryReminder,
	isActionableRecoveryStatus,
	useRecoveryRuntimeStatus,
	useRecoveryRuntimeRevision,
	setRecoveryRuntimeStatus
} from '../../services/recoveryReminderState';
import { executeWithReadyEncryptionClient } from '../profile/EncryptionSettings/encryptionClient';
import { OrisoDialog } from '../modal/OrisoDialog';
import { M3Snackbar } from '../m3Snackbar/M3Snackbar';
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

/*
 * Below 900 px (`$fromLarge`) the app shows its navigation bar at the bottom
 * edge (72 px); the snackbar rests above it instead of covering it. MUI only
 * centres a snackbar from 600 px up, so the phone width is centred here.
 */
const recoverySnackbarPlacement = {
	// A media query, not a plain value or the `md` key: MUI's own `sm` rule would win over a plain
	// value, and this theme puts md at 600 px while the navigation bar stays until 900 px.
	'@media (max-width: 899.98px)': {
		bottom: 'calc(88px + env(safe-area-inset-bottom, 0px))'
	},
	'left': { xs: '50%' },
	'right': { xs: 'auto' },
	'transform': { xs: 'translateX(-50%)' },
	'width': { xs: 'calc(100% - 16px)' }
} as const;

/** Recovery is available inline; opening the restore dialog is always explicit. */
export const KeyBackupRecoveryPrompt = () => {
	const { t } = useTranslation();
	const { matrixClientService } = useMatrixClient();
	const passwordMode =
		useContext(UserDataContext)?.userData?.chatRecoveryMode ===
		'LOGIN_PASSWORD';
	const userId = matrixClientService?.getClient()?.getUserId() ?? '';
	const status = useRecoveryRuntimeStatus(userId);
	const revision = useRecoveryRuntimeRevision(userId);
	const eligible = useRecoveryReminder(userId);
	const key = usePendingRecoveryKey(userId);
	const [openedFor, setOpenedFor] = useState<string | null>(null);
	/* Dismissal lives in component state on purpose: the notice comes back on
	   every reload and every login until the history is readable, but it never
	   blocks the screen while somebody is working. */
	const [dismissedFor, setDismissedFor] = useState<string | null>(null);
	const showRecovery = openedFor === userId;
	if (!isActionableRecoveryStatus(status) || (eligible && !!key)) return null;
	// Scoped to the status revision: any change, even via 'pending' back to the same status, reshows it.
	const dismissKey = `${userId}:${revision}`;
	return (
		<>
			{dismissedFor !== dismissKey && !showRecovery && (
				<M3Snackbar
					role="status"
					testId="key-backup-recovery-action"
					message={
						<>
							{eligible && (
								<span>
									{t(
										'encryption.saveReminder.unavailable'
									)}{' '}
								</span>
							)}
							<span>
								{t('encryption.passwordRecovery.' + status)}
							</span>{' '}
							<Link
								to="/profile/einstellungen/sicherheit"
								className="encryption-recovery-snackbar__link"
							>
								{t('encryption.passwordRecovery.settings')}
							</Link>
						</>
					}
					action={{
						label: t('encryption.keyBackup.dialog.openVault'),
						onClick: () => setOpenedFor(userId),
						testId: 'key-backup-recovery-open'
					}}
					actionOnOwnLine
					onClose={() => setDismissedFor(dismissKey)}
					closeLabel={t('encryption.keyBackup.snackbar.close')}
					containerSx={recoverySnackbarPlacement}
					yieldToOthers
				/>
			)}
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
