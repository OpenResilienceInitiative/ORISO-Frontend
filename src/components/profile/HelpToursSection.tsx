import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Headline } from '../headline/Headline';
import { TourOverviewSection } from '../productTour/TourOverviewSection';
import { PracticeOverviewSection } from '../../practice/PracticeOverviewSection';
import { EnableWalkthrough } from './EnableWalkthrough';
import './helpTours.styles.scss';

/** One Help card owns the introduction preference and every manual learning option. */
export const HelpToursSection = () => {
	const { t: translate } = useTranslation();
	return (
		<div className="helpTours">
			<div className="profile__content__title">
				<Headline
					text={translate('walkthrough.overview.title')}
					semanticLevel="2"
				/>
			</div>
			<EnableWalkthrough embedded />
			<TourOverviewSection embedded />
			<PracticeOverviewSection embedded />
		</div>
	);
};
