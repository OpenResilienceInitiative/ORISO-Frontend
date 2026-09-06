import { OverlayItem, OVERLAY_FUNCTIONS, Overlay } from '../overlay/Overlay';
import { BUTTON_TYPES } from '../button/Button';
import * as React from 'react';
import { apiSetAbsence } from '../../api';
import {
	AUTHORITIES,
	hasUserAuthority,
	UserDataContext
} from '../../globalState';
import { useContext, useState, useEffect } from 'react';
import { getValueFromCookie } from '../sessionCookie/accessSessionCookie';
import { CheckAnimation } from '../animatedIllustration/AnimatedIllustration';
import { useTranslation } from 'react-i18next';
import { OVERLAY_ABSENCE } from '../../globalState/interfaces/AppConfig/OverlaysConfigInterface';

export const AbsenceHandler = () => {
	const { t: translate } = useTranslation();
	const absenceReminderOverlayItem: OverlayItem = {
		headline: translate('absence.overlay.headline'),
		headlineStyleLevel: '1',
		copy: translate('absence.overlay.copy'),
		buttonSet: [
			{
				label: translate('absence.overlay.button1.label'),
				function: OVERLAY_FUNCTIONS.DEACTIVATE_ABSENCE,
				type: BUTTON_TYPES.PRIMARY
			},
			{
				label: translate('absence.overlay.button2.label'),
				function: OVERLAY_FUNCTIONS.CLOSE,
				type: BUTTON_TYPES.SECONDARY
			}
		]
	};

	const absenceChangedOverlayItem: OverlayItem = {
		svg: CheckAnimation,
		headline: translate('absence.overlay.changeSuccess.headline'),
		buttonSet: [
			{
				label: translate('absence.overlay.changeSuccess.buttonLabel'),
				function: OVERLAY_FUNCTIONS.CLOSE,
				type: BUTTON_TYPES.AUTO_CLOSE
			}
		]
	};

	const { userData, reloadUserData } = useContext(UserDataContext);

	const [overlayItem, setOverlayItem] = useState(absenceReminderOverlayItem);
	const [overlayActive, setOverlayActive] = useState(false);
	// The user id the reminder was already shown for: once per signed-in
	// counsellor, not once per mount (#1210 job 2).
	const [remindedUserId, setRemindedUserId] = useState<string | null>(null);

	const userId = userData?.userId ?? null;
	const isAbsentConsultant =
		Boolean(userData?.absent) &&
		hasUserAuthority(AUTHORITIES.CONSULTANT_DEFAULT, userData);

	useEffect(() => {
		// #1210 job 2: decide from the data of the user who is signed in *now*,
		// not from whatever the shared UserDataContext held when this component
		// mounted. Stale or mixed data (a non-consultant, data left over from a
		// previous session, a sign-out in flight with the auth cookie already
		// gone) never opens the counsellor-only reminder.
		if (!userId || !isAbsentConsultant || remindedUserId === userId) {
			return;
		}
		if (!getValueFromCookie('keycloak')) {
			return;
		}
		setRemindedUserId(userId);
		setOverlayItem(absenceReminderOverlayItem);
		setOverlayActive(true);
	}, [userId, isAbsentConsultant, remindedUserId]); // eslint-disable-line react-hooks/exhaustive-deps

	const handleOverlayAction = (buttonFunction: string) => {
		if (buttonFunction === OVERLAY_FUNCTIONS.CLOSE) {
			setOverlayItem(absenceReminderOverlayItem);
			setOverlayActive(false);
		}
		if (buttonFunction === OVERLAY_FUNCTIONS.DEACTIVATE_ABSENCE) {
			apiSetAbsence(false, userData?.absenceMessage)
				.then(reloadUserData)
				.then(() => {
					setOverlayItem(absenceChangedOverlayItem);
				})
				.catch((error) => {
					/* console.log(error); */
				});
		}
	};

	if (!overlayActive) return null;

	return (
		<Overlay
			name={OVERLAY_ABSENCE}
			item={overlayItem}
			handleOverlay={handleOverlayAction}
		/>
	);
};
