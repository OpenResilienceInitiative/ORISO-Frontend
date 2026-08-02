import * as React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { MatrixClient } from 'matrix-js-sdk';
import { Headline } from '../../headline/Headline';
import { Text } from '../../text/Text';
import { Button, BUTTON_TYPES } from '../../button/Button';
import { InputField, InputFieldItem } from '../../inputField/InputField';
import { getMatrixClientService } from '../../../services/matrixClientRegistry';
import {
	EncryptionSetupStatus,
	getEncryptionStatus,
	setUpRecovery,
	recoverWithKey,
	resetCryptoIdentity,
	InvalidRecoveryKeyError,
	RecoverySetupPhase,
	RecoverySetupPhaseError
} from '../../../services/matrixKeyBackupService';
import './encryptionSettings.styles.scss';
import {
	EncryptionClientReadinessError,
	executeWithReadyEncryptionClient,
	resolveReadyEncryptionClient
} from './encryptionClient';

/**
 * #437 Key backup + recovery UX — profile "Sicherheit" panel.
 *
 * UX pattern adapted from element-web's Encryption settings tab (v1.11.91+,
 * AGPL — reimplemented on ORISO primitives, no source copied); the crypto
 * itself is matrix-js-sdk (Apache-2.0) via matrixKeyBackupService.
 *
 * States: loading → not set up (setup flow with one-time key display) →
 * healthy (change key / reset identity) → out of sync (recovery-key repair).
 */

type PanelPhase =
	| 'loading'
	| 'unavailable'
	| 'notSetUp'
	| 'showKey'
	| 'healthy'
	| 'outOfSync'
	| 'resetConfirm';

export type EncryptionSettingsPanelProps = {
	/** Storybook/tests: inject a client instead of the singleton service. */
	clientOverride?: MatrixClient | null;
	/** Storybook: start in a fixed phase instead of probing the client. */
	initialStatusOverride?: EncryptionSetupStatus | null;
};

export const EncryptionSettingsPanel = ({
	clientOverride,
	initialStatusOverride
}: EncryptionSettingsPanelProps = {}) => {
	const { t } = useTranslation();
	const [phase, setPhase] = useState<PanelPhase>('loading');
	const [status, setStatus] = useState<EncryptionSetupStatus | null>(
		initialStatusOverride ?? null
	);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [setupFailurePhase, setSetupFailurePhase] = useState<
		| RecoverySetupPhase
		| 'initial-readiness'
		| 'replacement-readiness'
		| 'unknown'
		| null
	>(null);
	const [recoveryKeyToShow, setRecoveryKeyToShow] = useState<string | null>(
		null
	);
	const [keyStoredConfirmed, setKeyStoredConfirmed] = useState(false);
	const [recoveryInput, setRecoveryInput] = useState('');
	const [recoveredCount, setRecoveredCount] = useState<number | null>(null);
	const [copied, setCopied] = useState(false);

	const getReadyClient = useCallback(
		(): Promise<MatrixClient | null> =>
			resolveReadyEncryptionClient(
				clientOverride,
				getMatrixClientService()
			),
		[clientOverride]
	);

	const phaseForStatus = (s: EncryptionSetupStatus): PanelPhase => {
		if (s.keyStorageOutOfSync) {
			return 'outOfSync';
		}
		return s.secretStorageReady ? 'healthy' : 'notSetUp';
	};

	const refreshStatus = useCallback(async () => {
		try {
			const client = await getReadyClient();
			if (!client) {
				setPhase('unavailable');
				return;
			}
			const nextStatus = await getEncryptionStatus(client);
			setStatus(nextStatus);
			setPhase(phaseForStatus(nextStatus));
		} catch (setupError) {
			console.warn(
				'Matrix recovery setup failed at phase',
				setupError instanceof RecoverySetupPhaseError
					? setupError.phase
					: 'unknown'
			);
			setPhase('unavailable');
		}
	}, [getReadyClient]);

	useEffect(() => {
		if (initialStatusOverride) {
			setPhase(phaseForStatus(initialStatusOverride));
			return;
		}
		void refreshStatus();
	}, [refreshStatus, initialStatusOverride]);

	const onSetUp = useCallback(async () => {
		setBusy(true);
		setError(null);
		setSetupFailurePhase(null);
		try {
			const encodedKey = await executeWithReadyEncryptionClient(
				clientOverride,
				getMatrixClientService(),
				setUpRecovery
			);
			if (!encodedKey) {
				return;
			}
			setRecoveryKeyToShow(encodedKey);
			setKeyStoredConfirmed(false);
			setCopied(false);
			setPhase('showKey');
		} catch (setupError) {
			setSetupFailurePhase(
				setupError instanceof RecoverySetupPhaseError
					? setupError.phase
					: setupError instanceof EncryptionClientReadinessError
						? setupError.stage
						: 'unknown'
			);
			setError(
				t(
					'profile.encryption.setup.error',
					'Die Einrichtung ist fehlgeschlagen. Bitte versuchen Sie es erneut.'
				)
			);
		} finally {
			setBusy(false);
		}
	}, [clientOverride, t]);

	const onConfirmKeyStored = useCallback(() => {
		// One-time display: drop the key from memory the moment the user
		// confirms it is stored safely.
		setRecoveryKeyToShow(null);
		setKeyStoredConfirmed(false);
		void refreshStatus();
	}, [refreshStatus]);

	const onCopyKey = useCallback(async () => {
		if (!recoveryKeyToShow) {
			return;
		}
		try {
			await navigator.clipboard.writeText(recoveryKeyToShow);
			setCopied(true);
		} catch {
			// Clipboard may be unavailable (permissions); manual copy remains.
		}
	}, [recoveryKeyToShow]);

	const onRecover = useCallback(async () => {
		if (!recoveryInput.trim()) {
			return;
		}
		setBusy(true);
		setError(null);
		setSetupFailurePhase(null);
		try {
			const result = await executeWithReadyEncryptionClient(
				clientOverride,
				getMatrixClientService(),
				(client) => recoverWithKey(client, recoveryInput)
			);
			if (!result) {
				return;
			}
			setRecoveredCount(result.imported);
			setRecoveryInput('');
			await refreshStatus();
		} catch (recoverError) {
			setError(
				recoverError instanceof InvalidRecoveryKeyError
					? t(
							'profile.encryption.recover.invalidKey',
							'Dieser Wiederherstellungsschlüssel ist ungültig. Bitte prüfen Sie die Eingabe.'
						)
					: t(
							'profile.encryption.recover.error',
							'Die Wiederherstellung ist fehlgeschlagen. Bitte versuchen Sie es erneut.'
						)
			);
		} finally {
			setBusy(false);
		}
	}, [clientOverride, recoveryInput, refreshStatus, t]);

	const onReset = useCallback(async () => {
		setBusy(true);
		setError(null);
		setSetupFailurePhase(null);
		try {
			await executeWithReadyEncryptionClient(
				clientOverride,
				getMatrixClientService(),
				resetCryptoIdentity
			);
			await refreshStatus();
		} catch {
			setError(
				t(
					'profile.encryption.reset.error',
					'Das Zurücksetzen ist fehlgeschlagen. Bitte versuchen Sie es erneut.'
				)
			);
		} finally {
			setBusy(false);
		}
	}, [clientOverride, refreshStatus, t]);

	const recoveryInputItem: InputFieldItem = {
		id: 'encryptionRecoveryKey',
		name: 'encryptionRecoveryKey',
		type: 'text',
		label: t(
			'profile.encryption.recover.inputLabel',
			'Wiederherstellungsschlüssel'
		),
		content: recoveryInput
	};

	const renderHeader = () => (
		<div className="profile__content__title">
			<Headline
				text={t(
					'profile.encryption.title',
					'Verschlüsselung & Wiederherstellung'
				)}
				semanticLevel="5"
			/>
			<Text
				text={t(
					'profile.encryption.description',
					'Ihre Nachrichten sind Ende-zu-Ende verschlüsselt. Mit einem Wiederherstellungsschlüssel können Sie Ihren Gesprächsverlauf auch auf einem neuen Gerät weiterlesen.'
				)}
				type="standard"
				className="tertiary"
			/>
		</div>
	);

	if (phase === 'loading') {
		return (
			<div className="encryptionSettings">
				{renderHeader()}
				<Text
					text={t('profile.encryption.loading', 'Wird geladen …')}
					type="standard"
					className="tertiary"
				/>
			</div>
		);
	}

	if (phase === 'unavailable') {
		return (
			<div className="encryptionSettings">
				{renderHeader()}
				<Text
					text={t(
						'profile.encryption.unavailable',
						'Die Verschlüsselungseinstellungen sind gerade nicht verfügbar. Bitte laden Sie die Seite neu.'
					)}
					type="standard"
					className="tertiary"
				/>
			</div>
		);
	}

	return (
		<div className="encryptionSettings">
			{renderHeader()}

			{error && (
				<div
					className="encryptionSettings__error"
					role="alert"
					data-cy="encryption-setup-error"
					data-setup-phase={setupFailurePhase ?? undefined}
				>
					<Text text={error} type="standard" />
				</div>
			)}

			{phase === 'notSetUp' && (
				<>
					<Text
						text={t(
							'profile.encryption.setup.explainer',
							'Richten Sie einmalig einen Wiederherstellungsschlüssel ein. Bewahren Sie ihn sicher auf — zum Beispiel in einem Passwort-Manager. Ohne ihn ist Ihr Verlauf bei Geräteverlust nicht wiederherstellbar.'
						)}
						type="standard"
					/>
					<Button
						item={{
							label: t(
								'profile.encryption.setup.cta',
								'Wiederherstellungsschlüssel einrichten'
							),
							type: BUTTON_TYPES.PRIMARY,
							disabled: busy
						}}
						buttonHandle={onSetUp}
					/>
				</>
			)}

			{phase === 'showKey' && recoveryKeyToShow && (
				<>
					<Text
						text={t(
							'profile.encryption.showKey.explainer',
							'Das ist Ihr Wiederherstellungsschlüssel. Er wird nur dieses eine Mal angezeigt. Speichern Sie ihn jetzt an einem sicheren Ort.'
						)}
						type="standard"
					/>
					<div
						className="encryptionSettings__key"
						data-cy="recovery-key-display"
					>
						<code>{recoveryKeyToShow}</code>
					</div>
					<div className="encryptionSettings__keyActions">
						<Button
							item={{
								label: copied
									? t(
											'profile.encryption.showKey.copied',
											'Kopiert ✓'
										)
									: t(
											'profile.encryption.showKey.copy',
											'Schlüssel kopieren'
										),
								type: BUTTON_TYPES.SECONDARY
							}}
							buttonHandle={onCopyKey}
						/>
					</div>
					<label className="encryptionSettings__confirm">
						<input
							type="checkbox"
							checked={keyStoredConfirmed}
							onChange={(event) =>
								setKeyStoredConfirmed(event.target.checked)
							}
						/>
						<span>
							{t(
								'profile.encryption.showKey.confirmLabel',
								'Ich habe den Schlüssel sicher gespeichert.'
							)}
						</span>
					</label>
					<Button
						item={{
							label: t(
								'profile.encryption.showKey.done',
								'Fertig'
							),
							type: BUTTON_TYPES.PRIMARY,
							disabled: !keyStoredConfirmed
						}}
						buttonHandle={onConfirmKeyStored}
					/>
				</>
			)}

			{phase === 'healthy' && (
				<>
					<div
						className="encryptionSettings__status encryptionSettings__status--ok"
						data-cy="encryption-status-ok"
					>
						<Text
							text={t(
								'profile.encryption.status.ok',
								'✓ Schlüsselsicherung ist aktiv. Ihr Verlauf bleibt auf neuen Geräten lesbar.'
							)}
							type="standard"
						/>
					</div>
					{recoveredCount !== null && (
						<Text
							text={t(
								'profile.encryption.recover.success',
								'{{count}} Nachrichtenschlüssel wiederhergestellt.',
								{ count: recoveredCount }
							)}
							type="standard"
							className="tertiary"
						/>
					)}
					<Button
						item={{
							label: t(
								'profile.encryption.changeKey.cta',
								'Wiederherstellungsschlüssel ändern'
							),
							type: BUTTON_TYPES.SECONDARY,
							disabled: busy
						}}
						buttonHandle={onSetUp}
					/>
					<hr />
					<Text
						text={t(
							'profile.encryption.reset.explainer',
							'Wiederherstellungsschlüssel vergessen? Sie können Ihre Verschlüsselungsidentität zurücksetzen. Achtung: Bisher verschlüsselter Verlauf kann danach dauerhaft unlesbar sein.'
						)}
						type="standard"
						className="tertiary"
					/>
					<Button
						item={{
							label: t(
								'profile.encryption.reset.cta',
								'Verschlüsselung zurücksetzen'
							),
							type: BUTTON_TYPES.TERTIARY,
							disabled: busy
						}}
						buttonHandle={() => {
							setError(null);
							setPhase('resetConfirm');
						}}
					/>
				</>
			)}

			{phase === 'outOfSync' && (
				<>
					<div
						className="encryptionSettings__status encryptionSettings__status--warning"
						role="alert"
						data-cy="encryption-status-out-of-sync"
					>
						<Text
							text={t(
								'profile.encryption.outOfSync.warning',
								'Die Schlüsselsicherung ist auf diesem Gerät nicht eingerichtet. Geben Sie Ihren Wiederherstellungsschlüssel ein, damit Ihr Verlauf hier lesbar wird.'
							)}
							type="standard"
						/>
					</div>
					<InputField
						item={recoveryInputItem}
						inputHandle={(event) =>
							setRecoveryInput(event.target.value)
						}
					/>
					<Button
						item={{
							label: t(
								'profile.encryption.recover.cta',
								'Verlauf wiederherstellen'
							),
							type: BUTTON_TYPES.PRIMARY,
							disabled: busy || !recoveryInput.trim()
						}}
						buttonHandle={onRecover}
					/>
					<hr />
					<Text
						text={t(
							'profile.encryption.reset.explainer',
							'Wiederherstellungsschlüssel vergessen? Sie können Ihre Verschlüsselungsidentität zurücksetzen. Achtung: Bisher verschlüsselter Verlauf kann danach dauerhaft unlesbar sein.'
						)}
						type="standard"
						className="tertiary"
					/>
					<Button
						item={{
							label: t(
								'profile.encryption.reset.cta',
								'Verschlüsselung zurücksetzen'
							),
							type: BUTTON_TYPES.TERTIARY,
							disabled: busy
						}}
						buttonHandle={() => {
							setError(null);
							setPhase('resetConfirm');
						}}
					/>
				</>
			)}

			{phase === 'resetConfirm' && (
				<div
					className="encryptionSettings__resetConfirm"
					data-cy="encryption-reset-confirm"
				>
					<Text
						text={t(
							'profile.encryption.reset.confirmWarning',
							'Sind Sie sicher? Das Zurücksetzen erstellt eine neue Verschlüsselungsidentität. Nachrichten, die nur mit der alten Sicherung lesbar waren, bleiben dauerhaft unlesbar.'
						)}
						type="standard"
					/>
					<div className="encryptionSettings__resetActions">
						<Button
							item={{
								label: t(
									'profile.encryption.reset.confirmCta',
									'Ja, zurücksetzen'
								),
								type: BUTTON_TYPES.PRIMARY,
								disabled: busy
							}}
							buttonHandle={onReset}
						/>
						<Button
							item={{
								label: t(
									'profile.encryption.reset.cancel',
									'Abbrechen'
								),
								type: BUTTON_TYPES.SECONDARY,
								disabled: busy
							}}
							buttonHandle={() =>
								status && setPhase(phaseForStatus(status))
							}
						/>
					</div>
				</div>
			)}
		</div>
	);
};
