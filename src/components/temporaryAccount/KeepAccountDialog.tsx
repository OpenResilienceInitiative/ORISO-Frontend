import * as React from 'react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Typography, useMediaQuery } from '@mui/material';
import VerifiedUserOutlinedIcon from '@mui/icons-material/VerifiedUserOutlined';
import { M3Dialog } from '../m3Dialog/M3Dialog';
import { OrisoTextField } from '../form/OrisoTextField';
import { PasswordRuleChips } from '../registration/accountData/PasswordRuleChips';
import { allPasswordCriteriaPass } from '../registration/accountData/passwordRules';
import { keepTemporaryAccountErrorKey } from '../../api/apiKeepTemporaryAccount';
import {
	keepTemporaryAccount,
	KeepTemporaryAccountResult
} from './keepTemporaryAccount';

export interface KeepAccountDialogProps {
	open?: boolean;
	/** The login name the account keeps. */
	userName: string;
	/** The account's chat recovery policy (from the user data). */
	account: {
		chatRecoveryMode?: string | null;
		chatRecoveryPolicyRevision?: number | null;
	};
	onClose: () => void;
	/** The server kept the account; the caller refreshes the user data. */
	onKept: (result: KeepTemporaryAccountResult) => void;
}

/**
 * UserService#1662 "Konto behalten": a guest who joined without an account
 * keeps it. Asks for a password only (same policy and rule chips as the
 * registration); the login name stays as it is.
 */
export const KeepAccountDialog = ({
	open = true,
	userName,
	account,
	onClose,
	onKept
}: KeepAccountDialogProps) => {
	const { t } = useTranslation();
	const phone = useMediaQuery('(max-width: 599.95px)');
	const [password, setPassword] = useState('');
	const [repeated, setRepeated] = useState('');
	const [busy, setBusy] = useState(false);
	const [errorKey, setErrorKey] = useState<string | null>(null);
	const [result, setResult] = useState<KeepTemporaryAccountResult | null>(
		null
	);

	// A closed dialog starts over; a password never lingers in it.
	useEffect(() => {
		if (open) return;
		setPassword('');
		setRepeated('');
		setErrorKey(null);
		setResult(null);
	}, [open]);

	const mismatch = repeated !== '' && repeated !== password;
	const valid =
		allPasswordCriteriaPass(password) && password === repeated && !busy;

	const submit = async () => {
		if (!valid) return;
		setBusy(true);
		setErrorKey(null);
		try {
			const kept = await keepTemporaryAccount(password, account);
			setPassword('');
			setRepeated('');
			setResult(kept);
			onKept(kept);
		} catch (error) {
			setErrorKey(keepTemporaryAccountErrorKey(error));
		} finally {
			setBusy(false);
		}
	};

	if (result) {
		return (
			<M3Dialog
				open={open}
				onClose={onClose}
				closeLabel={t('app.close')}
				width={480}
				fullScreen={phone}
				icon={<VerifiedUserOutlinedIcon />}
				title={t('guestAccountMode.keep.title')}
				data-testid="keep-account-dialog"
				actions={[
					{
						label: t('app.close'),
						onClick: onClose,
						primary: true
					}
				]}
			>
				<Typography role="status">
					{t(
						result === 'kept'
							? 'guestAccountMode.keep.success'
							: 'guestAccountMode.keep.recoveryPending'
					)}
				</Typography>
			</M3Dialog>
		);
	}

	return (
		<M3Dialog
			open={open}
			onClose={onClose}
			closeLabel={t('app.close')}
			width={480}
			fullScreen={phone}
			icon={<VerifiedUserOutlinedIcon />}
			title={t('guestAccountMode.keep.title')}
			description={t('guestAccountMode.keep.text')}
			data-testid="keep-account-dialog"
			actions={[
				{ label: t('guestAccountMode.keep.cancel'), onClick: onClose },
				{
					label: t('guestAccountMode.keep.submit'),
					onClick: submit,
					primary: true,
					disabled: !valid,
					busy,
					testId: 'keep-account-submit'
				}
			]}
		>
			<Box
				component="form"
				noValidate
				onSubmit={(event: React.FormEvent) => {
					event.preventDefault();
					void submit();
				}}
			>
				<Typography sx={{ mb: 1 }}>
					{t('guestAccountMode.keep.loginName', { name: userName })}
				</Typography>
				{/* The login name, for password managers. */}
				<input
					type="text"
					name="username"
					autoComplete="username"
					value={userName}
					readOnly
					hidden
				/>
				<OrisoTextField
					label={t('guestAccountMode.keep.password')}
					type="password"
					value={password}
					onChange={(event) => setPassword(event.target.value)}
					autoComplete="new-password"
					fullWidth
					margin="normal"
				/>
				<PasswordRuleChips password={password} />
				<OrisoTextField
					label={t('guestAccountMode.keep.repeat')}
					type="password"
					value={repeated}
					onChange={(event) => setRepeated(event.target.value)}
					autoComplete="new-password"
					fullWidth
					margin="normal"
					error={mismatch}
					helperText={
						mismatch
							? t('guestAccountMode.keep.mismatch')
							: undefined
					}
				/>
				{errorKey && (
					<Typography role="alert" color="error" sx={{ mt: 1 }}>
						{t(errorKey)}
					</Typography>
				)}
				{/* Enter submits. */}
				<button type="submit" hidden aria-hidden tabIndex={-1} />
			</Box>
		</M3Dialog>
	);
};
