import * as React from 'react';
import { useCallback, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { UserDataContext } from '../../globalState';
import { Button, BUTTON_TYPES } from '../button/Button';
import { Headline } from '../headline/Headline';
import { Text } from '../text/Text';
import { TwoFactorSetupDialog } from './TwoFactorSetupDialog';
import './mandatorySecondFactorGate.styles';

interface MandatorySecondFactorGateProps {
	onLogout: () => void;
}

/**
 * The screen a counsellor sees instead of the app until a second factor exists.
 *
 * This replaces the routed app rather than covering it, which is the whole
 * point: the dismissible nag (#841) leaves the app underneath reachable, so an
 * account whose password was chosen by an administrator could be used for
 * counselling before it belonged to anyone in particular. Here the only two
 * ways out are a confirmed factor or logging out — the dialog is opened with
 * `canClose` and `canDisable` off, so it offers no third door.
 */
export const MandatorySecondFactorGate = ({
	onLogout
}: MandatorySecondFactorGateProps) => {
	const { t: translate } = useTranslation();
	const { userData, reloadUserData } = useContext(UserDataContext);

	// Re-reading the profile is what opens the gate: the server decides whether
	// the factor counts, the client never flips its own flag.
	const handleSetupComplete = useCallback(async () => {
		await reloadUserData();
	}, [reloadUserData]);

	return (
		<div className="mandatorySecondFactorGate">
			<div className="mandatorySecondFactorGate__content">
				<Headline
					semanticLevel="1"
					text={translate('twoFactorAuth.required.title')}
				/>
				<Text
					type="standard"
					text={translate('twoFactorAuth.required.copy')}
				/>
				<Button
					buttonHandle={onLogout}
					item={{
						label: translate('twoFactorAuth.required.logout'),
						type: BUTTON_TYPES.SECONDARY
					}}
				/>
			</div>
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
		</div>
	);
};
