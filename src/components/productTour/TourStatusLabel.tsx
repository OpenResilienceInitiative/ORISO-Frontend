import * as React from 'react';
import { useTranslation } from 'react-i18next';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import { formatChatMessageDateDivider } from '../../utils/dateHelpers';
import type { TourStatus } from './types';
import './productTour.styles.scss';

type Translate = (key: string, options?: { date: string }) => string;

/**
 * The status words of a tour (FE#2545): a completed tour says when —
 * "Abgeschlossen am 7. Juli 2026", in the date format of the UI language —
 * and only "Abgeschlossen" when the server did not send `completedAt`.
 */
export const tourStatusText = (
	translate: Translate,
	status: TourStatus,
	completedAt?: string | null
): string => {
	if (status === 'completed' && completedAt) {
		const ms = Date.parse(completedAt);
		if (Number.isFinite(ms)) {
			return translate('walkthrough.overview.status.completedOn', {
				date: formatChatMessageDateDivider(ms)
			});
		}
	}
	// Static keys, so the i18n guard can see every one of them.
	const labels: Record<TourStatus, string> = {
		not_started: translate('walkthrough.overview.status.not_started'),
		in_progress: translate('walkthrough.overview.status.in_progress'),
		completed: translate('walkthrough.overview.status.completed'),
		skipped: translate('walkthrough.overview.status.skipped')
	};
	return labels[status];
};

/** Status words with a check mark in front of a completed tour. */
export const TourStatusLabel = ({
	status,
	completedAt
}: {
	status: TourStatus;
	completedAt?: string | null;
}) => {
	const { t: translate } = useTranslation();
	const text = tourStatusText(translate, status, completedAt);
	if (status !== 'completed') return <>{text}</>;
	return (
		<span className="tourStatusLabel" data-cy="tour-completed">
			<CheckCircleRoundedIcon
				className="tourStatusLabel__icon"
				aria-hidden="true"
				data-testid="tour-completed-icon"
			/>
			{text}
		</span>
	);
};
