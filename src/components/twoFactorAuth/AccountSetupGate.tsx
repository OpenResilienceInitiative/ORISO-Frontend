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
 * An account provisioned through the admin panel starts with a password its
 * administrator chose and passed on out of band, so two things are owed before
 * it may be used: the user's own password, then a second factor. This replaces
 * the routed app rather than covering it — the dismissible nag (#841) leaves
 * everything underneath reachable, which is how an account in exactly this
 * state could be used for counselling.
 *
 * The password step reuses the profile's password change unchanged, including
 * the logout it ends with. That logout is not incidental: for counsellors on
 * LOGIN_PASSWORD chat recovery the change rotates Matrix key-backup material
 * (`changePasswordWithRecovery`), and routing around a proven path through
 * security-critical crypto to save one login is not a trade worth making. The
 * second-factor step therefore comes on the next sign-in, which is the first
 * one using a password only the user knows.
 */
export const AccountSetupGate = ({ onLogout }: AccountSetupGateProps) => {
	const { t: translate } = useTranslation();
	const { userData } = useContext(UserDataContext);

	// A document load, not an in-app refresh. The bootstrap ran while setup was
	// still pending and deliberately skipped live-event processing and the
	// group-chat deep link, so a settled account needs a clean boot to get them.
	// It also removes the stale-profile trap: an in-app refresh that fails
	// leaves the gate shut on an account that is in fact settled, and the
	// setup dialog swallows that failure.
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
