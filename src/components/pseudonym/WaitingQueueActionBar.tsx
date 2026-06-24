import React from 'react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { ReactComponent as SentimentCalmIcon } from '../../resources/img/icons/sentiment-calm.svg';
import { ReactComponent as HourglassTopQueueIcon } from '../../resources/img/icons/hourglass-top-queue.svg';
import { ReactComponent as LocalCounselorHouseIcon } from '../../resources/img/icons/local-counselor-house.svg';
import { ReactComponent as CornerLeftDownIcon } from '../../resources/img/icons/corner-left-down.svg';
import { ReactComponent as CornerRightUpIcon } from '../../resources/img/icons/corner-right-up.svg';
import { ReactComponent as CornerUpLeftIcon } from '../../resources/img/icons/corner-up-left.svg';
import { ReactComponent as ArrowRightM3Icon } from '../../resources/img/icons/arrow-right-m3.svg';
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

/** M3 corner hint arrows — single-stroke SVGs matching Figma Corner* icons. */
const HintArrowIcon: React.FC<{
	variant: 'upLeft' | 'downLeft' | 'upRight';
}> = ({ variant }) => {
	if (variant === 'upLeft') {
		return (
			<CornerUpLeftIcon className="waitingQueueActionBar__hintArrowIcon" />
		);
	}
	if (variant === 'downLeft') {
		return (
			<CornerLeftDownIcon className="waitingQueueActionBar__hintArrowIcon" />
		);
	}
	return (
		<CornerRightUpIcon className="waitingQueueActionBar__hintArrowIcon" />
	);
};

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
	const calmCompanionHintDesktop = t(
		'anonymousChat.queue.calmCompanionHintDesktop',
		'Bis der Chat beginnt, eine kurze ruhige Begleitung. Direkt hier im Chatraum'
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
					<HintArrowIcon variant="downLeft" />
				</span>
				<div className="waitingQueueActionBar__mobileHintText">
					<p className="waitingQueueActionBar__hintText">
						{t(
							'anonymousChat.queue.calmCompanionHintMobileLine1',
							'Bis der Chat beginnt, eine kurze'
						)}
					</p>
					<p className="waitingQueueActionBar__hintText">
						{t(
							'anonymousChat.queue.calmCompanionHintMobileLine2',
							'interaktive ruhige Begleitung.'
						)}
					</p>
				</div>
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
								<HintArrowIcon variant="upLeft" />
							</span>
							<p className="waitingQueueActionBar__hintText">
								{calmCompanionHintDesktop}
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
							<ArrowRightM3Icon
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
								<HintArrowIcon variant="upRight" />
							</span>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};
