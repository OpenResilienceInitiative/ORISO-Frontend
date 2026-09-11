import * as React from 'react';
import { useContext, useState } from 'react';
import { SessionsDataContext } from '../../../globalState';
import { ListItemInterface } from '../../../globalState/interfaces';
import { Button, ButtonItem, BUTTON_TYPES } from '../../button/Button';
import { Headline } from '../../headline/Headline';
import { useTranslation } from 'react-i18next';
import { NewRequestDialog } from '../NewRequestDialog/NewRequestDialog';
import '../profile.styles';

/**
 * Profile public-data entry point for "request another topic": renders the
 * headline plus a button and hosts the reusable NewRequestDialog. Postcode is
 * prefilled from the asker's most recent session; agencies the asker already
 * talks to are passed for first-position highlighting.
 */
export const AdditionalEnquiry: React.FC = () => {
	const { t: translate } = useTranslation(['common', 'consultingTypes']);
	const { sessions } = useContext(SessionsDataContext);
	const [dialogOpen, setDialogOpen] = useState(false);

	const sessionItems: ListItemInterface[] = Object.values(
		sessions || {}
	).filter((item: ListItemInterface) => !!item);

	// session.postcode is numeric in the API model - restore leading zeros
	const rawPostcode = sessionItems.find((item) => !!item?.session?.postcode)
		?.session?.postcode;
	const prefilledPostcode =
		rawPostcode != null ? String(rawPostcode).padStart(5, '0') : undefined;

	const knownAgencyIds = sessionItems
		.map((item) => item?.agency?.id)
		.filter((id): id is number => typeof id === 'number');

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
