import * as React from 'react';
import { useContext } from 'react';
import {
	ActiveSessionContext,
	UserDataContext,
	hasUserAuthority,
	AUTHORITIES
} from '../../globalState';
import { RequestSessionAssign } from '../sessionAssign/RequestSessionAssign';
import { Text } from '../text/Text';
import { useTranslation } from 'react-i18next';
import { BUTTON_TYPES, Button } from '../button/Button';
import { useCaseHandoverOffer } from '../caseHandover/useCaseHandoverOffer';
import { CaseHandoverOffer } from '../caseHandover/CaseHandoverOffer';

interface AskerInfoAssignProps {
	title?: string | null;
	showLegacyAssignment?: boolean;
	handoverEnabled?: boolean;
}

export const AskerInfoAssign = ({
	title = 'userProfile.reassign.title',
	showLegacyAssignment = true,
	handoverEnabled = false
}: AskerInfoAssignProps) => {
	const { t: translate } = useTranslation();
	const { activeSession } = useContext(ActiveSessionContext);
	const { userData } = useContext(UserDataContext);
	// The same offer flow the chat-room menu opens (FE#2250).
	const handover = useCaseHandoverOffer();

	const showLegacy =
		showLegacyAssignment &&
		hasUserAuthority(AUTHORITIES.CONSULTANT_DEFAULT, userData);
	if (!showLegacy && !handoverEnabled) return null;

	return (
		<>
			<Text text={title && translate(title)} type="divider" />
			{showLegacy && (
				<>
					<Text
						className="asker-info-assign__description"
						text={translate('userProfile.reassign.description')}
						type="infoSmall"
					/>
					<RequestSessionAssign
						value={activeSession.consultant?.id || null}
					/>
				</>
			)}
			{handoverEnabled && (
				<Button
					item={{
						label: 'caseHandover.offer.open',
						type: BUTTON_TYPES.SECONDARY
					}}
					buttonHandle={handover.handleOpen}
					disabled={handover.loading}
				/>
			)}
			<CaseHandoverOffer handover={handover} />
		</>
	);
};
