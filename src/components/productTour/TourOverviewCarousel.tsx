import * as React from 'react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, BUTTON_TYPES } from '../button/Button';
import { Headline } from '../headline/Headline';
import { Text } from '../text/Text';
import type { ITutorialProgressItem } from '../../api/apiTutorialProgress';
import type { TourAudience, TourDefinition, TourStatus } from './types';
import './productTour.styles.scss';

export type TourStartMode = 'start' | 'continue' | 'restart';

export interface TourOverviewCarouselProps {
	tours: TourDefinition[];
	audience: TourAudience;
	/** Loads the signed-in user's versioned progress for this surface. */
	loadProgress: () => Promise<
		Pick<
			ITutorialProgressItem,
			'tourId' | 'tourVersion' | 'status' | 'currentStepId'
		>[]
	>;
	onStartTour: (tour: TourDefinition, mode: TourStartMode) => void;
}

/**
 * Tour copy is shared with the tooltip, where it is rendered as sanitized HTML.
 * The compact card renders plain text, so inline markup from the legacy
 * walkthrough keys (e.g. `<br />`) would otherwise be printed literally — seen
 * on Pre-Dev during gate run e2e-20260720-1507. Tags are dropped rather than
 * rendered so the card never becomes an HTML sink.
 */
const toPlainText = (value: string): string =>
	value
		.replace(/<[^>]*>/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();

const actionForStatus = (status: TourStatus): TourStartMode => {
	if (status === 'in_progress') {
		return 'continue';
	}
	if (status === 'completed' || status === 'skipped') {
		return 'restart';
	}
	return 'start';
};

/**
 * Profile overview of the tutorials available to the signed-in user: title,
 * summary, versioned progress state and a Start/Continue/Restart action.
 * A newer tour version is a fresh progress scope and is offered again.
 */
export const TourOverviewCarousel = ({
	tours,
	audience,
	loadProgress,
	onStartTour
}: TourOverviewCarouselProps) => {
	const { t: translate } = useTranslation();
	const [progress, setProgress] = useState<
		Pick<
			ITutorialProgressItem,
			'tourId' | 'tourVersion' | 'status' | 'currentStepId'
		>[]
	>([]);
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
				// Without progress data every tour is offered as not started.
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

	const eligibleTours = tours.filter(
		(tour) =>
			tour.surface === 'frontend' && tour.audiences.includes(audience)
	);

	const statusFor = (tour: TourDefinition): TourStatus =>
		progress.find(
			(item) =>
				item.tourId === tour.id && item.tourVersion === tour.version
		)?.status ?? 'not_started';

	if (isLoading) {
		return null;
	}

	return (
		<div className="tourOverview">
			<div className="profile__content__title">
				<Headline
					text={translate('walkthrough.overview.title')}
					semanticLevel="5"
				/>
				<Text
					text={translate('walkthrough.overview.subtitle')}
					type="standard"
					className="tertiary"
				/>
			</div>
			{eligibleTours.length === 0 ? (
				<Text
					text={translate('walkthrough.overview.empty')}
					type="standard"
				/>
			) : (
				<ul
					className="tourOverview__list"
					aria-label={translate('walkthrough.overview.title')}
				>
					{eligibleTours.map((tour) => {
						const status = statusFor(tour);
						const mode = actionForStatus(status);
						return (
							<li className="tourOverview__card" key={tour.id}>
								<span
									className={`tourOverview__status tourOverview__status--${status}`}
								>
									{translate(
										`walkthrough.overview.status.${status}`
									)}
								</span>
								<h3 className="tourOverview__cardTitle">
									{translate(tour.titleKey)}
								</h3>
								<p className="tourOverview__cardSummary">
									{toPlainText(translate(tour.summaryKey))}
								</p>
								<Button
									item={{
										label: translate(
											`walkthrough.overview.action.${mode}`
										),
										type:
											mode === 'restart'
												? BUTTON_TYPES.SECONDARY
												: BUTTON_TYPES.PRIMARY
									}}
									buttonHandle={() => onStartTour(tour, mode)}
									className="tourOverview__action"
								/>
							</li>
						);
					})}
				</ul>
			)}
		</div>
	);
};
