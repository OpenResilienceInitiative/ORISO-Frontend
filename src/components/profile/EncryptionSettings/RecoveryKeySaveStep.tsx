import * as React from 'react';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text } from '../../text/Text';
import { Button, BUTTON_TYPES } from '../../button/Button';
import { M3Checkbox } from '../../M3Checkbox';

/**
 * One-time "save your Ersatzschlüssel" step. Shared by the Sicherheit panel
 * and the Zugang-schützen follow-on after 2FA (#1194 Job 2). Crypto stays in
 * the caller — this only shows the key and collects the stored confirmation.
 */
export type RecoveryKeySaveStepProps = {
	recoveryKey: string;
	fromSilentSetup?: boolean;
	onConfirm: () => void;
};

export const RecoveryKeySaveStep: React.FC<RecoveryKeySaveStepProps> = ({
	recoveryKey,
	fromSilentSetup = false,
	onConfirm
}) => {
	const { t } = useTranslation();
	const [copied, setCopied] = useState(false);
	const [keyStoredConfirmed, setKeyStoredConfirmed] = useState(false);

	const onCopyKey = useCallback(async () => {
		try {
			await navigator.clipboard.writeText(recoveryKey);
			setCopied(true);
		} catch {
			// Clipboard may be unavailable; manual copy remains.
		}
	}, [recoveryKey]);

	return (
		<>
			<Text
				text={
					fromSilentSetup
						? t(
								'profile.encryption.showKey.silentExplainer',
								'Ihr Tresor wurde beim Anmelden automatisch eingerichtet. Das ist Ihr Ersatzschlüssel — speichern Sie ihn jetzt an einem sicheren Ort, zum Beispiel in einem Passwort-Manager. Danach zeigen wir ihn nicht mehr an.'
							)
						: t(
								'profile.encryption.showKey.explainer',
								'Das ist Ihr Ersatzschlüssel. Er wird nur dieses eine Mal angezeigt. Speichern Sie ihn jetzt an einem sicheren Ort.'
							)
				}
				type="standard"
			/>
			<div
				className="encryptionSettings__key"
				data-cy="recovery-key-display"
			>
				<code>{recoveryKey}</code>
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
					className="encryptionSettings__fullWidthAction"
				/>
			</div>
			<M3Checkbox
				checked={keyStoredConfirmed}
				onChange={setKeyStoredConfirmed}
				label={t(
					'profile.encryption.showKey.confirmLabel',
					'Ich habe den Schlüssel sicher gespeichert.'
				)}
				dataCy="encryption-key-stored-confirmation"
			/>
			<Button
				item={{
					label: t('profile.encryption.showKey.done', 'Fertig'),
					type: BUTTON_TYPES.PRIMARY,
					disabled: !keyStoredConfirmed
				}}
				buttonHandle={onConfirm}
				className="encryptionSettings__fullWidthAction"
			/>
		</>
	);
};
