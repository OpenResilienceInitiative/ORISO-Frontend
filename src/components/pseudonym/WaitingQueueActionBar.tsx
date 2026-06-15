import React from 'react';
import { useTranslation } from 'react-i18next';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import clsx from 'clsx';
import { ReactComponent as SentimentCalmIcon } from '../../resources/img/icons/sentiment-calm.svg';
import { ReactComponent as HourglassTopQueueIcon } from '../../resources/img/icons/hourglass-top-queue.svg';
import { ReactComponent as LocalCounselorHouseIcon } from '../../resources/img/icons/local-counselor-house.svg';
import './WaitingQueueActionBar.styles.scss';

interface WaitingQueueActionBarProps {
	/** Position in the waiting queue (1-based). `null` hides the counter. */
	queuePosition?: number | null;
	/** User tapped the smiley "short calm companion" pill on the left. */
	onOpenCalmCompanion?: () => void;
	/** User tapped "Send request to local counselor". */
	onRequestLocalCounselor?: () => void;
	disabled?: boolean;
}

/** Corner-up-left arrow — points from the hint text toward the calm-companion pill. */
const CornerUpLeftIcon: React.FC = () => (
	<svg
		width="24"
		height="24"
		viewBox="0 0 24 24"
		fill="none"
		xmlns="http://www.w3.org/2000/svg"
		aria-hidden="true"
	>
		<path
			d="M9 14L4 9L9 4"
			stroke="#4C555F"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
		<path
			d="M4 9H14C16.2091 9 18 10.7909 18 13V20"
			stroke="#4C555F"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
	</svg>
);

/** Corner-left-down arrow — mobile top hint, points toward the smiley row below. */
const CornerLeftDownIcon: React.FC = () => (
	<svg
		width="24"
		height="24"
		viewBox="0 0 24 24"
		fill="none"
		xmlns="http://www.w3.org/2000/svg"
		aria-hidden="true"
	>
		<path
			d="M14 9L9 14L14 19"
			stroke="#4C555F"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
		<path
			d="M9 14H4C2.89543 14 2 13.1046 2 12V4"
			stroke="#4C555F"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
	</svg>
);

/** Corner-right-up arrow — mobile “instead of waiting” hint below the local button. */
const CornerRightUpIcon: React.FC = () => (
	<svg
		width="24"
		height="24"
		viewBox="0 0 24 24"
		fill="none"
		xmlns="http://www.w3.org/2000/svg"
		aria-hidden="true"
	>
		<path
			d="M10 15L15 10L20 15"
			stroke="#4C555F"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
		<path
			d="M15 10V20C15 21.1046 14.1046 22 13 22H4"
			stroke="#4C555F"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
	</svg>
);

interface QueueStatusProps {
	hasQueuePosition: boolean;
	queuePosition: number | null | undefined;
	queueStatusLabel: string;
	queueStatusSuffix: string;
	modifier: 'mobile' | 'desktop';
}

const QueueStatus: React.FC<QueueStatusProps> = ({
	hasQueuePosition,
	queuePosition,
	queueStatusLabel,
	queueStatusSuffix,
	modifier
}) => (
	<div
		className={clsx(
			'waitingQueueActionBar__queueBtn',
			`waitingQueueActionBar__queueBtn--${modifier}`
		)}
		role="status"
		aria-live="polite"
	>
		<div className="waitingQueueActionBar__queueBtnInner">
			<span className="waitingQueueActionBar__queueIcon">
				<HourglassTopQueueIcon />
			</span>
			<span className="waitingQueueActionBar__queueLabel">
				{hasQueuePosition ? (
					<>
						<span className="waitingQueueActionBar__queueCount">
							{queuePosition}
						</span>
						<span className="waitingQueueActionBar__queueLabelDesktop">
							{queueStatusLabel}
						</span>
						<span className="waitingQueueActionBar__queueLabelMobile">
							{queueStatusSuffix}
						</span>
					</>
				) : (
					queueStatusLabel
				)}
			</span>
		</div>
	</div>
);

/**
 * Waiting-queue action bar shown after the pseudonym has been confirmed.
 * Matches Figma “Waiting Room Component with padding” (desktop) and
 * “Mobile Wrapping” (mobile).
 */
export const WaitingQueueActionBar: React.FC<WaitingQueueActionBarProps> = ({
	queuePosition = null,
	onOpenCalmCompanion,
	onRequestLocalCounselor,
	disabled
}) => {
	const { t } = useTranslation();

	const hasQueuePosition = Boolean(queuePosition && queuePosition > 0);
	const calmCompanionHint = t(
		'anonymousChat.queue.calmCompanionHint',
		'Bis der Chat beginnt, eine kurze interaktive ruhige Begleitung. Direkt hier im Chatraum'
	);

	const queueStatusLabel = hasQueuePosition
		? t('anonymousChat.queue.positionCount', {
				count: queuePosition,
				defaultValue: '{{count}} Personen vor Ihnen'
			})
		: t('anonymousChat.queue.connecting', 'Wird verbunden …');

	const queueStatusSuffix = t(
		'anonymousChat.queue.positionCountSuffix',
		'Noch vor Ihnen'
	);

	const queueStatusProps = {
		hasQueuePosition,
		queuePosition,
		queueStatusLabel,
		queueStatusSuffix
	};

	return (
		<div
			className="waitingQueueActionBar"
			role="group"
			aria-label={t(
				'anonymousChat.queue.actionsLabel',
				'Wartebereich-Aktionen'
			)}
		>
			<div className="waitingQueueActionBar__mobileTopHint">
				<span
					className="waitingQueueActionBar__hintArrow"
					aria-hidden="true"
				>
					<CornerLeftDownIcon />
				</span>
				<p className="waitingQueueActionBar__hintText">
					{calmCompanionHint}
				</p>
			</div>

			<div className="waitingQueueActionBar__content">
				<div className="waitingQueueActionBar__primaryRow">
					<div className="waitingQueueActionBar__left">
						<button
							type="button"
							className="waitingQueueActionBar__smiley"
							onClick={onOpenCalmCompanion}
							disabled={disabled || !onOpenCalmCompanion}
							aria-label={t(
								'anonymousChat.queue.calmCompanion',
								'Kurze ruhige Begleitung öffnen'
							)}
						>
							<span className="waitingQueueActionBar__smileyIcon">
								<SentimentCalmIcon />
							</span>
						</button>

						<div className="waitingQueueActionBar__desktopHint">
							<span
								className="waitingQueueActionBar__hintArrow"
								aria-hidden="true"
							>
								<CornerUpLeftIcon />
							</span>
							<p className="waitingQueueActionBar__hintText">
								{calmCompanionHint}
							</p>
						</div>
					</div>

					<QueueStatus {...queueStatusProps} modifier="mobile" />
				</div>

				<div className="waitingQueueActionBar__right">
					<QueueStatus {...queueStatusProps} modifier="desktop" />

					<div className="waitingQueueActionBar__localSection">
						<div className="waitingQueueActionBar__insteadHint waitingQueueActionBar__insteadHint--desktop">
							<span className="waitingQueueActionBar__insteadText">
								{t(
									'anonymousChat.queue.insteadOfWaiting',
									'Statt zu warten'
								)}
							</span>
							<ArrowForwardIcon
								className="waitingQueueActionBar__insteadArrow"
								aria-hidden="true"
							/>
						</div>

						<button
							type="button"
							className="waitingQueueActionBar__localBtn"
							onClick={onRequestLocalCounselor}
							disabled={disabled || !onRequestLocalCounselor}
						>
							<span className="waitingQueueActionBar__localIcon">
								<LocalCounselorHouseIcon />
							</span>
							<span className="waitingQueueActionBar__localLabel">
								{t(
									'anonymousChat.queue.requestLocalCounselor',
									'Vor Ort Beratungsanfrage absenden'
								)}
							</span>
						</button>

						<div className="waitingQueueActionBar__insteadHint waitingQueueActionBar__insteadHint--mobile">
							<span className="waitingQueueActionBar__insteadText">
								{t(
									'anonymousChat.queue.insteadOfWaiting',
									'Statt zu warten'
								)}
							</span>
							<span
								className="waitingQueueActionBar__hintArrow"
								aria-hidden="true"
							>
								<CornerRightUpIcon />
							</span>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};
