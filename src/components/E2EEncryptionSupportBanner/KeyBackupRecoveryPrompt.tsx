import * as React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useMatrixClient } from '../../globalState/context/MatrixClientContext';
import {
	getEncryptionStatus,
	InvalidRecoveryKeyError,
	recoverWithKey
} from '../../services/matrixKeyBackupService';
import { executeWithReadyEncryptionClient } from '../profile/EncryptionSettings/encryptionClient';
import { OrisoDialog } from '../modal/OrisoDialog';
import { ReactComponent as RecoverySafeIcon } from '../../resources/img/icons/recovery-safe.svg';
import './E2EEncryptionSupportBanner.styles.scss';
import { TWO_FACTOR_SETTINGS_PATH } from '../../hooks/useOpenTwoFactorSettings';

const DISMISS_KEY = 'hideKeyBackupPrompt';
/* One source of truth for the profile security tab — `useOpenTwoFactorSettings`
   exports it precisely so a route change stays a single edit. */
const SECURITY_SETTINGS_PATH = TWO_FACTOR_SETTINGS_PATH;
export type KeyBackupPromptMode = 'setup' | 'recovery';

type KeyBackupRecoveryDialogProps = {
	mode: KeyBackupPromptMode;
	onClose: () => void;
	onRecover: (recoveryKey: string) => Promise<number>;
};

export const KeyBackupRecoveryDialog = ({
	mode,
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
							'Dieser Wiederherstellungsschlüssel ist ungültig. Bitte prüfen Sie die Eingabe.'
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
			title={
				mode === 'recovery'
					? translate(
							'encryption.keyBackup.dialog.recoveryTitle',
							'Schön, dass Sie wieder da sind'
						)
					: translate(
							'encryption.keyBackup.dialog.setupTitle',
							'Ihre Nachrichten sicher aufbewahren'
						)
			}
			icon={<RecoverySafeIcon />}
			maxWidth="560px"
			height="auto"
			hideActions
		>
			<div
				className="keyBackupDialog"
				data-cy={`key-backup-${mode}-dialog`}
			>
				{mode === 'recovery' ? (
					<>
						<p>
							{translate(
								'encryption.keyBackup.dialog.recoveryCopy',
								'Sie sind auf einem neuen Gerät angemeldet. Ihr bisheriger Gesprächsverlauf liegt sicher verschlossen in Ihrem Tresor.'
							)}
						</p>
						<p>
							{translate(
								'encryption.keyBackup.dialog.recoveryInstruction',
								'Geben Sie Ihren Wiederherstellungsschlüssel ein, um Ihre Nachrichten hier weiterzulesen.'
							)}
						</p>
						<label className="keyBackupDialog__field">
							<span>
								{translate(
									'encryption.keyBackup.dialog.keyLabel',
									'Wiederherstellungsschlüssel'
								)}
							</span>
							<input
								type="text"
								value={recoveryKey}
								onChange={(event) =>
									setRecoveryKey(event.target.value)
								}
								autoComplete="off"
								disabled={busy}
							/>
						</label>
						{error && (
							<p className="keyBackupDialog__error" role="alert">
								{error}
							</p>
						)}
					</>
				) : (
					<p>
						{translate(
							'encryption.keyBackup.dialog.setupCopy',
							'Ihre Nachrichten sind Ende-zu-Ende verschlüsselt. Richten Sie einen Wiederherstellungsschlüssel ein, damit Ihr Gesprächsverlauf auch auf einem neuen Gerät lesbar bleibt.'
						)}
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
					{mode === 'recovery' ? (
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
					) : (
						<Link
							className="keyBackupDialog__primary"
							to={SECURITY_SETTINGS_PATH}
							onClick={onClose}
						>
							{translate(
								'encryption.keyBackup.dialog.setup',
								'Tresor einrichten'
							)}
						</Link>
					)}
				</div>
			</div>
		</OrisoDialog>
	);
};

/**
 * #437 login-time recovery prompt. On a new device the user's key backup is
 * "out of sync" — a server backup exists but this device holds no backup key,
 * so encrypted case history stays unreadable until they enter their recovery
 * key. Rather than making them hunt in profile settings, surface a dismissible
 * banner right after the Matrix client is ready that deep-links into the
 * Sicherheit panel (which owns the recovery-key input).
 *
 * Probes once per session, only after sync reaches PREPARED; dismissal is
 * session-scoped so we do not nag on every navigation.
 */
export const KeyBackupRecoveryPrompt = () => {
	const { matrixClientService } = useMatrixClient();
	const [bannerMode, setBannerMode] = useState<KeyBackupPromptMode | null>(
		null
	);
	const probedRef = useRef(false);

	useEffect(() => {
		if (!matrixClientService) {
			return undefined;
		}
		if (sessionStorage.getItem(DISMISS_KEY)) {
			return undefined;
		}

		let cancelled = false;

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
				getEncryptionStatus(client)
					.then((status) => {
						const setupRequired =
							!status.serverBackupExists ||
							!status.secretStorageReady ||
							!status.crossSigningReady;
						if (!cancelled && status.keyStorageOutOfSync) {
							setBannerMode('recovery');
						} else if (!cancelled && setupRequired) {
							setBannerMode('setup');
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

	if (!bannerMode) {
		return null;
	}

	const closePrompt = () => {
		sessionStorage.setItem(DISMISS_KEY, 'true');
		setBannerMode(null);
	};

	return (
		<KeyBackupRecoveryDialog
			mode={bannerMode}
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
