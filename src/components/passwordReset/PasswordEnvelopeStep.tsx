import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Button, BUTTON_TYPES } from '../button/Button';
import { RecoveryKeyField } from '../profile/EncryptionSettings/RecoveryKeyField';
import './passwordReset.styles';

export interface PasswordEnvelopeStepProps {
	busy?: boolean;
	/** Already translated. */
	errorMessage?: string;
	onRecoveryKeyChange: (value: string) => void;
	onSkip: () => void;
	onSubmit: () => void;
	recoveryKey: string;
	variant?: 'profile' | 'dialog';
}

/**
 * Shown right after a password change that left no password envelope (#1917):
 * the change is done, but the new password does not unlock the chat history
 * on a new device until the recovery key has been sealed under it once.
 */
export const PasswordEnvelopeStep = ({
	busy = false,
	errorMessage,
	onRecoveryKeyChange,
	onSkip,
	onSubmit,
	recoveryKey,
	variant = 'profile'
}: PasswordEnvelopeStepProps) => {
	const { t: translate } = useTranslation();
	return (
		<div
			id="passwordReset"
			className={[
				'passwordReset',
				'passwordReset__envelopeStep',
				variant === 'dialog' && 'passwordReset--dialog'
			]
				.filter(Boolean)
				.join(' ')}
			data-cy="password-envelope-step"
		>
			<p role="status">
				<strong>
					{translate('encryption.passwordRecovery.afterChange.title')}
				</strong>
			</p>
			<p>
				{translate(
					'encryption.passwordRecovery.afterChange.explanation'
				)}
			</p>
			<RecoveryKeyField
				value={recoveryKey}
				disabled={busy}
				onChange={onRecoveryKeyChange}
			/>
			{errorMessage && (
				<p className="passwordReset__error" role="alert">
					{errorMessage}
				</p>
			)}
			<div className="passwordReset__envelopeActions">
				<Button
					item={{
						label: translate(
							'encryption.passwordRecovery.afterChange.submit'
						),
						type: BUTTON_TYPES.PRIMARY
					}}
					buttonHandle={onSubmit}
					disabled={busy || !recoveryKey.trim()}
				/>
				<Button
					item={{
						label: translate(
							'encryption.passwordRecovery.afterChange.later'
						),
						type: BUTTON_TYPES.SECONDARY
					}}
					buttonHandle={onSkip}
					disabled={busy}
				/>
			</div>
			<p className="tertiary">
				{translate('encryption.passwordRecovery.afterChange.laterHint')}
			</p>
		</div>
	);
};
