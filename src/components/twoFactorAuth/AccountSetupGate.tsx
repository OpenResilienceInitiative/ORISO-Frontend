import * as React from 'react';
import { useCallback, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Button as MuiButton, Dialog, Fade } from '@mui/material';
import { UserDataContext } from '../../globalState';
import { Button, BUTTON_TYPES } from '../button/Button';
import { Headline } from '../headline/Headline';
import { Text } from '../text/Text';
import { PasswordReset } from '../passwordReset/PasswordReset';
import { reloadDocument } from '../../utils/reloadDocument';
import { TwoFactorSetupDialog } from './TwoFactorSetupDialog';
import {
	ACCOUNT_SETUP_STEPS,
	resolveAccountSetupStep
} from './accountSetupStep';
import {
	AccountSetupHeader,
	AccountSetupProgress
} from './accountSetupDialogChrome';
import './accountSetupGate.styles';
import './twoFactorSetupDialog.styles';

interface AccountSetupGateProps {
	onLogout: () => void;
}

/**
 * The screen an account sees instead of the app until it is the user's own.
 *
 * An admin-provisioned account starts with a password its administrator chose, so two things are
 * owed: the user's own password, then a second factor. This replaces the routed app rather than
 * covering it. Both steps are the same non-dismissable dialog, so setup reads as one flow; the text
 * underneath is what a screen reader reaches behind it.
 *
 * The password step reuses the profile's password change unchanged, including its logout — for
 * LOGIN_PASSWORD chat recovery that change rotates Matrix key-backup material, and routing around
 * a proven path through security-critical crypto is not worth saving one login.
 */
export const AccountSetupGate = ({ onLogout }: AccountSetupGateProps) => {
	const { t: translate } = useTranslation();
	const { userData } = useContext(UserDataContext);

	// A document load, not an in-app refresh: the bootstrap ran while setup was pending
	// and skipped live events and the deep link, so a settled account needs a clean boot.
	const handleSetupComplete = useCallback(() => {
		reloadDocument();
	}, []);

	const step = resolveAccountSetupStep(userData);
	const isPasswordStep = step === ACCOUNT_SETUP_STEPS.PASSWORD;
	const copyKey = isPasswordStep ? 'passwordChange' : 'twoFactorAuth';

	return (
		<div className="accountSetupGate">
			<div className="accountSetupGate__content">
				<Headline
					semanticLevel="1"
					text={translate(`${copyKey}.required.title`)}
				/>
				<Text
					type="standard"
					text={translate(`${copyKey}.required.copy`)}
				/>
				<Button
					buttonHandle={onLogout}
					item={{
						label: translate('accountSetup.required.logout'),
						type: BUTTON_TYPES.SECONDARY
					}}
				/>
			</div>
			{isPasswordStep && (
				<Dialog
					BackdropProps={{
						className: 'twoFactorSetupDialog__backdrop'
					}}
					TransitionComponent={Fade}
					TransitionProps={{ timeout: 180 }}
					aria-describedby="account-setup-password-description"
					aria-labelledby="account-setup-password-title"
					className="twoFactorSetupDialog"
					disableEscapeKeyDown
					maxWidth={false}
					open
					PaperProps={{
						className: 'twoFactorSetupDialog__paper'
					}}
				>
					<AccountSetupProgress active="password" />
					<AccountSetupHeader
						descriptionId="account-setup-password-description"
						icon="key"
						subtitle={translate('passwordChange.required.copy')}
						title={translate('passwordChange.required.title')}
						titleId="account-setup-password-title"
					/>
					<Box className="twoFactorSetupDialog__body">
						<PasswordReset hideIntro variant="dialog" />
					</Box>
					{/* The dialog is modal, so the logout underneath it is out of
					    reach — and it is the same link as in the second step. */}
					<MuiButton
						className="twoFactorSetupDialog__logout"
						onClick={onLogout}
						variant="text"
					>
						{translate('accountSetup.required.logout')}
					</MuiButton>
				</Dialog>
			)}
			{!isPasswordStep && (
				<TwoFactorSetupDialog
					canClose={false}
					canDisable={false}
					currentType={userData?.twoFactorAuth?.type}
					email={userData?.email}
					onClose={() => undefined}
					onDisable={() => undefined}
					onLogout={onLogout}
					onSetupComplete={handleSetupComplete}
					open
					qrCode={userData?.twoFactorAuth?.qrCode}
					secret={userData?.twoFactorAuth?.secret}
					showAccountProgress
				/>
			)}
		</div>
	);
};
