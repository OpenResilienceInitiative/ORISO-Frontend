import * as React from 'react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FormControlLabel, Radio, RadioGroup } from '@mui/material';
import type { MatrixClient } from 'matrix-js-sdk';
import { OrisoTextField } from '../../form/OrisoTextField';
import { Button, BUTTON_TYPES } from '../../button/Button';
import { RecoveryKeyField } from './RecoveryKeyField';
import { reauthenticateRecovery } from '../../../services/reauthenticateRecovery';
import {
	passwordRecoveryEnrollmentErrorKey,
	resealRecoveryWithPreviousPassword,
	sealRecoveryKeyUnderPassword
} from '../../../services/passwordRecoveryEnrollment';

export type StalePasswordRecoveryMethod = 'previousPassword' | 'recoveryKey';

export type StalePasswordRecoveryProps = {
	userId: string;
	/** The account's LOGIN_PASSWORD policy revision; throws when there is none. */
	resolvePolicyRevision: () => number;
	/** Whether the re-authentication needs the one-time code. */
	otpRequired: boolean;
	getReadyClient: () => Promise<MatrixClient | null>;
	onError: (message: string | null) => void;
	/** Storybook: start with a method already chosen. */
	initialMethod?: StalePasswordRecoveryMethod;
};

/**
 * #1931: the password was changed outside this app (Admin "Mein Konto", forgot-password, a setup
 * link), so the chat history is still sealed under the previous password and the current one does
 * not open it. Two ways back, both ending with the history sealed under the CURRENT password:
 * re-wrap it with the previous password, or prove the recovery key and replace the stale copies.
 * The current password is proven first, by the same re-authentication the enrolment uses.
 * The panel's status line carries the explanation; this renders the choice and the form.
 */
export const StalePasswordRecovery = ({
	userId,
	resolvePolicyRevision,
	otpRequired,
	getReadyClient,
	onError,
	initialMethod
}: StalePasswordRecoveryProps) => {
	const { t } = useTranslation();
	const form = useRef<HTMLFormElement>(null);
	const [method, setMethod] = useState<StalePasswordRecoveryMethod | null>(
		initialMethod ?? null
	);
	const [previousPassword, setPreviousPassword] = useState('');
	const [recoveryKey, setRecoveryKey] = useState('');
	const [currentPassword, setCurrentPassword] = useState('');
	const [otp, setOtp] = useState('');
	const [busy, setBusy] = useState(false);

	const secret =
		method === 'previousPassword' ? previousPassword : recoveryKey.trim();
	const incomplete = !method || !secret || !currentPassword;

	const submit = async (event: React.FormEvent) => {
		event.preventDefault();
		if (busy || incomplete) return;
		setBusy(true);
		onError(null);
		try {
			const policyRevision = resolvePolicyRevision();
			await reauthenticateRecovery(currentPassword, otp);
			const client = await getReadyClient();
			if (!client || client.getUserId() !== userId)
				throw new Error('Recovery unavailable');
			if (method === 'previousPassword')
				await resealRecoveryWithPreviousPassword(
					client,
					userId,
					previousPassword,
					currentPassword
				);
			else
				await sealRecoveryKeyUnderPassword(
					client,
					userId,
					currentPassword,
					recoveryKey,
					policyRevision
				);
			setPreviousPassword('');
			setRecoveryKey('');
		} catch (error) {
			onError(t(passwordRecoveryEnrollmentErrorKey(error)));
		} finally {
			setCurrentPassword('');
			setOtp('');
			setBusy(false);
		}
	};

	return (
		<form
			ref={form}
			className="encryptionSettings__stale"
			data-cy="password-recovery-stale"
			onSubmit={submit}
		>
			<RadioGroup
				aria-label={t('encryption.passwordRecovery.stale.choose')}
				value={method ?? ''}
				onChange={(_, value) =>
					setMethod(value as StalePasswordRecoveryMethod)
				}
			>
				<FormControlLabel
					value="previousPassword"
					control={<Radio disabled={busy} />}
					label={t(
						'encryption.passwordRecovery.stale.usePreviousPassword'
					)}
				/>
				<FormControlLabel
					value="recoveryKey"
					control={<Radio disabled={busy} />}
					label={t(
						'encryption.passwordRecovery.stale.useRecoveryKey'
					)}
				/>
			</RadioGroup>
			{method && (
				<>
					<p>
						{t(
							method === 'previousPassword'
								? 'encryption.passwordRecovery.stale.previousPasswordHint'
								: 'encryption.passwordRecovery.stale.recoveryKeyHint'
						)}
					</p>
					{method === 'previousPassword' ? (
						<OrisoTextField
							label={t(
								'encryption.passwordRecovery.stale.previousPassword'
							)}
							type="password"
							autoComplete="off"
							value={previousPassword}
							disabled={busy}
							onChange={(event) =>
								setPreviousPassword(event.target.value)
							}
						/>
					) : (
						<RecoveryKeyField
							value={recoveryKey}
							disabled={busy}
							onChange={setRecoveryKey}
						/>
					)}
					<OrisoTextField
						label={t('encryption.passwordRecovery.loginPassword')}
						type="password"
						autoComplete="current-password"
						value={currentPassword}
						disabled={busy}
						onChange={(event) =>
							setCurrentPassword(event.target.value)
						}
					/>
					{otpRequired && (
						<OrisoTextField
							label={t('encryption.passwordRecovery.otp')}
							inputProps={{ inputMode: 'numeric' }}
							autoComplete="one-time-code"
							value={otp}
							disabled={busy}
							onChange={(event) => setOtp(event.target.value)}
						/>
					)}
					<Button
						item={{
							type: BUTTON_TYPES.PRIMARY,
							label: t('encryption.passwordRecovery.stale.submit')
						}}
						disabled={busy || incomplete}
						buttonHandle={() => form.current?.requestSubmit()}
					/>
				</>
			)}
		</form>
	);
};
