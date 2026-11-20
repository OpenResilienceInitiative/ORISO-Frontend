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
import { canStartPracticeTourInViewport } from './practiceViewport';
import {
	isPracticeTourId,
	PRACTICE_ACCEPT_TOUR_ID,
	PRACTICE_SUPERVISION_TOUR_ID,
	type PracticeTourId
} from './practiceTourIds';

// Compact Help copy relies on the shared fictional-case caption above it.
// Standalone cards retain the complete safety description from the registry.
const helpSummaryKeys: Record<PracticeTourId, string> = {
	[PRACTICE_ACCEPT_TOUR_ID]: 'practice.cards.summary.accept',
	[PRACTICE_SUPERVISION_TOUR_ID]: 'practice.cards.summary.supervision'
};

type ProgressItem = Pick<
	ITutorialProgressItem,
	'tourId' | 'tourVersion' | 'status' | 'currentStepId'
>;

export interface PracticeCardsProps {
	/** Already filtered: only the flows this user may start right now. */
	tours: TourDefinition[];
	/** Phone viewport: practice is desktop only, so Start is off and a hint shows. */
	isPhone: boolean;
	/** The supervision plus is only interactive in the wide desktop layout. */
	isWideDesktop?: boolean;
	loadProgress: () => Promise<ProgressItem[]>;
	onStartTour: (tour: TourDefinition, mode: TourStartMode) => void;
	/** Use subordinate headings inside the shared Help learning card. */
	embedded?: boolean;
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
	isWideDesktop = true,
	loadProgress,
	onStartTour,
	embedded = false
}: PracticeCardsProps) => {
	const { t: translate } = useTranslation();
	const CardHeading = embedded ? 'h4' : 'h3';
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

	const statusFor = (tour: TourDefinition): TourStatus => {
		const savedStatus = progress.find(
			(item) =>
				item.tourId === tour.id && item.tourVersion === tour.version
		)?.status;
		// The case and its messages are memory-only. A saved step cannot
		// resume that world after reload, so never promise resumable progress.
		return savedStatus === 'in_progress'
			? 'not_started'
			: (savedStatus ?? 'not_started');
	};

	return (
		<div
			className={`tourOverview practiceCards${embedded ? ' tourOverview--embedded' : ''}`}
		>
			<div
				className={
					embedded
						? 'helpTours__practiceIntro'
						: 'profile__content__title'
				}
			>
				<Headline
					text={translate('practice.cards.title')}
					semanticLevel={embedded ? '3' : '5'}
					className={
						embedded ? 'helpTours__practiceTitle' : undefined
					}
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
						const summaryKey =
							embedded && isPracticeTourId(tour.id)
								? helpSummaryKeys[tour.id]
								: tour.summaryKey;
						const canStart = canStartPracticeTourInViewport(
							tour.id,
							{
								fromL: !isPhone,
								fromXL: isWideDesktop
							}
						);
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
								<CardHeading className="tourOverview__cardTitle">
									{translate(tour.titleKey)}
								</CardHeading>
								<p className="tourOverview__cardSummary">
									{toPlainText(translate(summaryKey))}
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
									disabled={!canStart}
									buttonHandle={() => onStartTour(tour, mode)}
									className="tourOverview__action"
								/>
								{!canStart && (
									<p className="practiceCards__phoneHint">
										{translate(
											isPhone
												? 'practice.cards.phoneHint'
												: 'practice.cards.windowHint'
										)}
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
