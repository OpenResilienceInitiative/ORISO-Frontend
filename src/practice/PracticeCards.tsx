import * as React from 'react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ITutorialProgressItem } from '../api/apiTutorialProgress';
import { Button, BUTTON_TYPES } from '../components/button/Button';
import { Headline } from '../components/headline/Headline';
import { Text } from '../components/text/Text';
import {
	toPlainText,
	type TourStartMode
} from '../components/productTour/TourOverviewCarousel';
import type {
	TourDefinition,
	TourStatus
} from '../components/productTour/types';
import '../components/productTour/productTour.styles.scss';
import './practiceCards.styles.scss';

type ProgressItem = Pick<
	ITutorialProgressItem,
	'tourId' | 'tourVersion' | 'status' | 'currentStepId'
>;

export interface PracticeCardsProps {
	/** Already filtered: only the flows this user may start right now. */
	tours: TourDefinition[];
	/** Phone viewport: practice is desktop only, so Start is off and a hint shows. */
	isPhone: boolean;
	loadProgress: () => Promise<ProgressItem[]>;
	onStartTour: (tour: TourDefinition, mode: TourStartMode) => void;
}

/**
 * Practice state lives in memory only, so a flow that was interrupted cannot be
 * continued: it starts over, like a finished one is practised again.
 */
const modeForStatus = (status: TourStatus): TourStartMode =>
	status === 'completed' || status === 'skipped' ? 'restart' : 'start';

/**
 * The practice flows as cards, same look as the tour cards (`tourOverview__*`)
 * plus a "Practice" badge, so they cannot be taken for a tour of the screens.
 */
export const PracticeCards = ({
	tours,
	isPhone,
	loadProgress,
	onStartTour
}: PracticeCardsProps) => {
	const { t: translate } = useTranslation();
	const [progress, setProgress] = useState<ProgressItem[]>([]);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		let cancelled = false;
		loadProgress()
			.then((items) => {
				if (!cancelled) {
					setProgress(items);
				}
			})
			.catch(() => {
				// Without progress data every flow is offered as not started.
			})
			.finally(() => {
				if (!cancelled) {
					setIsLoading(false);
				}
			});
		return () => {
			cancelled = true;
		};
	}, [loadProgress]);

	if (isLoading) {
		return null;
	}

	const statusFor = (tour: TourDefinition): TourStatus =>
		progress.find(
			(item) =>
				item.tourId === tour.id && item.tourVersion === tour.version
		)?.status ?? 'not_started';

	return (
		<div className="tourOverview practiceCards">
			<div className="profile__content__title">
				<Headline
					text={translate('practice.cards.title')}
					semanticLevel="5"
				/>
				<Text
					text={translate('practice.cards.subtitle')}
					type="standard"
					className="tertiary"
				/>
			</div>
			{tours.length === 0 ? (
				<Text
					text={translate('practice.cards.empty')}
					type="standard"
				/>
			) : (
				<ul
					className="tourOverview__list"
					aria-label={translate('practice.cards.title')}
				>
					{tours.map((tour) => {
						const status = statusFor(tour);
						const mode = modeForStatus(status);
						return (
							<li
								className="tourOverview__card practiceCards__card"
								key={tour.id}
							>
								<span className="practiceCards__badges">
									<span className="practiceCards__badge">
										{translate('practice.cards.badge')}
									</span>
									<span
										className={`tourOverview__status tourOverview__status--${status}`}
									>
										{translate(
											`walkthrough.overview.status.${status}`
										)}
									</span>
								</span>
								<h3 className="tourOverview__cardTitle">
									{translate(tour.titleKey)}
								</h3>
								<p className="tourOverview__cardSummary">
									{toPlainText(translate(tour.summaryKey))}
								</p>
								<Button
									item={{
										label:
											mode === 'restart'
												? translate(
														'practice.cards.action.restart'
													)
												: translate(
														'practice.cards.action.start'
													),
										type:
											mode === 'restart'
												? BUTTON_TYPES.SECONDARY
												: BUTTON_TYPES.PRIMARY
									}}
									disabled={isPhone}
									buttonHandle={() => onStartTour(tour, mode)}
									className="tourOverview__action"
								/>
								{isPhone && (
									<p className="practiceCards__phoneHint">
										{translate('practice.cards.phoneHint')}
									</p>
								)}
							</li>
						);
					})}
				</ul>
			)}
		</div>
	);
};
