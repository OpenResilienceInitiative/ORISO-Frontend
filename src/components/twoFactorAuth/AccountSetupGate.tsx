import * as React from 'react';
import { useCallback, useContext } from 'react';
import { useTranslation } from 'react-i18next';
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
import './accountSetupGate.styles';

interface AccountSetupGateProps {
	onLogout: () => void;
}

/**
 * The screen an account sees instead of the app until it is the user's own.
 *
 * An admin-provisioned account starts with a password its administrator chose, so two things are
 * owed: the user's own password, then a second factor. This replaces the routed app rather than
 * covering it.
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
				{isPasswordStep && <PasswordReset />}
				<Button
					buttonHandle={onLogout}
					item={{
						label: translate('accountSetup.required.logout'),
						type: BUTTON_TYPES.SECONDARY
					}}
				/>
			</div>
			{!isPasswordStep && (
				<TwoFactorSetupDialog
					canClose={false}
					canDisable={false}
					currentType={userData?.twoFactorAuth?.type}
					email={userData?.email}
					onClose={() => undefined}
					onDisable={() => undefined}
					onSetupComplete={handleSetupComplete}
					open
					qrCode={userData?.twoFactorAuth?.qrCode}
					secret={userData?.twoFactorAuth?.secret}
				/>
			)}
		</div>
	);
};
