import * as React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { MatrixClient } from 'matrix-js-sdk';
import { Headline } from '../../headline/Headline';
import { Text } from '../../text/Text';
import { Button, BUTTON_TYPES } from '../../button/Button';
import { getMatrixClientService } from '../../../services/matrixClientRegistry';
import {
	getEncryptionStatus,
	RecoverySetupPhaseError,
	setUpRecovery
} from '../../../services/matrixKeyBackupService';
import {
	clearPendingRecoveryKey,
	getPendingRecoveryKey,
	RecoverySetupBusyError,
	savePendingRecoveryKey,
	withRecoverySetupLock
} from '../../../services/pendingRecoveryKeyStore';
import {
	EncryptionClientReadinessError,
	executeWithReadyEncryptionClient
} from './encryptionClient';
import { RecoveryKeySaveStep } from './RecoveryKeySaveStep';
import './encryptionSettings.styles.scss';

/**
 * Follow-on after 2FA when the advice seeker pressed "Zugang schützen"
 * (#1194 Job 2). Reuses the same save-key step as the Sicherheit panel so
 * silent bootstrap (PR #1033) is not duplicated.
 */
export type BackupKeyAfterTwoFactorDialogProps = {
	open: boolean;
	onClose: () => void;
	clientOverride?: MatrixClient | null;
};

const setupFailureDetail = (setupError: unknown): string => {
	if (setupError instanceof RecoverySetupPhaseError) {
		return setupError.phase;
	}
	if (setupError instanceof EncryptionClientReadinessError) {
		return setupError.stage;
	}
	return 'unknown';
};

const UNAVAILABLE_FALLBACK =
	'Die Verschlüsselungseinstellungen sind gerade nicht verfügbar. Bitte laden Sie die Seite neu.';

export const BackupKeyAfterTwoFactorDialog: React.FC<
	BackupKeyAfterTwoFactorDialogProps
> = ({ open, onClose, clientOverride }) => {
	const { t } = useTranslation();
	const [recoveryKey, setRecoveryKey] = useState<string | null>(null);
	const [fromSilentSetup, setFromSilentSetup] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [userId, setUserId] = useState<string | null>(null);
	const [loadAttempt, setLoadAttempt] = useState(0);
	const dialogRef = useRef<HTMLDialogElement>(null);
	const onCloseRef = useRef(onClose);
	onCloseRef.current = onClose;

	useEffect(() => {
		const dialog = dialogRef.current;
		if (!open || !dialog) {
			return;
		}
		if (dialog.open) {
			return;
		}
		if (typeof dialog.showModal === 'function') {
			dialog.showModal();
			return;
		}
		dialog.setAttribute('open', '');
	}, [open]);

	const retryLoad = useCallback(() => {
		setError(null);
		setRecoveryKey(null);
		setFromSilentSetup(false);
		setLoadAttempt((attempt) => attempt + 1);
	}, []);

	useEffect(() => {
		if (!open) {
			setRecoveryKey(null);
			setFromSilentSetup(false);
			setError(null);
			setUserId(null);
			return;
		}

		let cancelled = false;

		const load = async () => {
			try {
				const statusResult = await executeWithReadyEncryptionClient(
					clientOverride,
					getMatrixClientService(),
					async (client) => {
						const currentUserId = client.getUserId();
						const pending = currentUserId
							? getPendingRecoveryKey(currentUserId)
							: null;
						const status = await getEncryptionStatus(client);
						return { client, currentUserId, pending, status };
					}
				);

				if (cancelled) {
					return;
				}
				if (!statusResult) {
					setError(
						t(
							'profile.encryption.unavailable',
							UNAVAILABLE_FALLBACK
						)
					);
					return;
				}

				setUserId(statusResult.currentUserId);
				if (
					statusResult.pending &&
					!statusResult.status.keyStorageOutOfSync
				) {
					setRecoveryKey(statusResult.pending);
					setFromSilentSetup(true);
					return;
				}

				if (statusResult.status.secretStorageReady) {
					onCloseRef.current();
					return;
				}

				const runSetup = () =>
					executeWithReadyEncryptionClient(
						clientOverride,
						getMatrixClientService(),
						setUpRecovery
					);
				const encodedKey = statusResult.currentUserId
					? await withRecoverySetupLock(
							statusResult.currentUserId,
							runSetup
						)
					: await runSetup();

				if (!encodedKey) {
					if (!cancelled) {
						setError(
							t(
								'profile.encryption.unavailable',
								UNAVAILABLE_FALLBACK
							)
						);
					}
					return;
				}
				if (statusResult.currentUserId) {
					savePendingRecoveryKey(
						statusResult.currentUserId,
						encodedKey
					);
				}
				if (cancelled) {
					return;
				}
				setRecoveryKey(encodedKey);
				setFromSilentSetup(false);
			} catch (setupError) {
				if (cancelled) {
					return;
				}
				if (setupError instanceof RecoverySetupBusyError) {
					setError(
						t(
							'profile.encryption.setup.busy',
							'Ihr Tresor wird gerade schon eingerichtet — in einem anderen Tab oder im Hintergrund. Bitte warten Sie einen Moment und laden Sie die Seite neu.'
						)
					);
					return;
				}
				console.warn(
					'Backup-key step after 2FA failed',
					setupFailureDetail(setupError)
				);
				setError(
					t(
						'profile.encryption.setup.error',
						'Die Einrichtung ist fehlgeschlagen. Bitte versuchen Sie es erneut.'
					)
				);
			}
		};

		void load();
		return () => {
			cancelled = true;
		};
	}, [clientOverride, loadAttempt, open, t]);

	const onConfirm = useCallback(() => {
		if (userId) {
			clearPendingRecoveryKey(userId);
		}
		onClose();
	}, [onClose, userId]);

	if (!open) {
		return null;
	}

	return (
		<dialog
			ref={dialogRef}
			aria-label={t(
				'profile.encryption.showKey.headline',
				'Ersatzschlüssel speichern'
			)}
			aria-modal="true"
			className="encryptionSettings backupKeyAfterTwoFactor"
			onCancel={(event) => {
				event.preventDefault();
				onClose();
			}}
		>
			<Headline
				semanticLevel="3"
				text={t(
					'profile.encryption.showKey.headline',
					'Ersatzschlüssel speichern'
				)}
			/>
			{error && (
				<>
					<Text text={error} type="standard" />
					<div className="encryptionSettings__keyActions">
						<Button
							item={{
								label: t(
									'registration.topic.loadErrorRetry',
									'Erneut versuchen'
								),
								type: BUTTON_TYPES.SECONDARY
							}}
							buttonHandle={retryLoad}
							className="encryptionSettings__fullWidthAction"
						/>
						<Button
							item={{
								label: t(
									'furtherSteps.email.overlay.button2.label',
									'Close'
								),
								type: BUTTON_TYPES.PRIMARY
							}}
							buttonHandle={onClose}
							className="encryptionSettings__fullWidthAction"
						/>
					</div>
				</>
			)}
			{recoveryKey && !error && (
				<RecoveryKeySaveStep
					fromSilentSetup={fromSilentSetup}
					recoveryKey={recoveryKey}
					onConfirm={onConfirm}
				/>
			)}
		</dialog>
	);
};
