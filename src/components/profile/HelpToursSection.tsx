import * as React from 'react';
import { useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { Headline } from '../headline/Headline';
import { TourOverviewSection } from '../productTour/TourOverviewSection';
import { PracticeOverviewSection } from '../../practice/PracticeOverviewSection';
import {
	AUTHORITIES,
	hasUserAuthority,
	UserDataContext
} from '../../globalState';
import { EnableWalkthrough } from './EnableWalkthrough';
import { TourLauncherSwitch } from './TourLauncherSwitch';
import './helpTours.styles.scss';

/**
 * One Help card owns the learning preferences and every manual learning
 * option. Counsellors also get the auto-start switch and the practice area;
 * every role gets the "?" launcher switch and its own tours.
 */
export const HelpToursSection = () => {
	const { t: translate } = useTranslation();
	const { userData } = useContext(UserDataContext);
	const isConsultant = hasUserAuthority(
		AUTHORITIES.CONSULTANT_DEFAULT,
		userData
	);
	return (
		<div className="helpTours">
			<div className="profile__content__title">
				<Headline
					text={translate('walkthrough.overview.title')}
					semanticLevel="2"
				/>
			</div>
			{isConsultant && <EnableWalkthrough embedded />}
			<TourLauncherSwitch />
			<TourOverviewSection embedded />
			{isConsultant && <PracticeOverviewSection embedded />}
		</div>
	);
};
