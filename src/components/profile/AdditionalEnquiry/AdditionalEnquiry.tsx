import * as React from 'react';
import { useState } from 'react';
import { Button, ButtonItem, BUTTON_TYPES } from '../../button/Button';
import { Headline } from '../../headline/Headline';
import { useTranslation } from 'react-i18next';
import { NewRequestDialog } from '../NewRequestDialog/NewRequestDialog';
import { useFurtherCounsellingPrefill } from '../../furtherCounselling/useFurtherCounsellingPrefill';
import '../profile.styles';

/**
 * Profile public-data entry point for "request another topic": renders the
 * headline plus a button and hosts the reusable NewRequestDialog. The postcode
 * follows the platform setting (FE#1876: SMART = the asker's most recent
 * session with one, or always empty); agencies the asker already talks to are
 * passed for first-position highlighting.
 */
export const AdditionalEnquiry: React.FC = () => {
	const { t: translate } = useTranslation(['common', 'consultingTypes']);
	const [dialogOpen, setDialogOpen] = useState(false);
	const { prefilledPostcode, knownAgencyIds } =
		useFurtherCounsellingPrefill();

	const openButton: ButtonItem = {
		label: translate('profile.data.register.dialog.openButton'),
		type: BUTTON_TYPES.PRIMARY
	};

	return (
		<div className="profile__data__itemWrapper additionalEnquiry">
			<div className="profile__content__title">
				<Headline
					text={translate('profile.data.register.headline')}
					semanticLevel="5"
				/>
			</div>
			<Button
				item={openButton}
				buttonHandle={() => setDialogOpen(true)}
			/>
			{dialogOpen && (
				<NewRequestDialog
					open={dialogOpen}
					onClose={() => setDialogOpen(false)}
					prefilledPostcode={prefilledPostcode}
					knownAgencyIds={knownAgencyIds}
				/>
			)}
		</div>
	);
};
