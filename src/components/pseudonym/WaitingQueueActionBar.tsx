import React from 'react';
import { useTranslation } from 'react-i18next';
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

/** Face icon with two eyes + smiling mouth — Figma "Frame951" smiley. */
const CalmCompanionSmileyIcon: React.FC = () => (
	<svg
		width="40"
		height="40"
		viewBox="0 0 40 40"
		fill="none"
		xmlns="http://www.w3.org/2000/svg"
		aria-hidden="true"
	>
		<path
			d="M16.5 18.475C17.4333 17.4583 18.0833 16.25 18.45 14.85L15.55 14.15C15.3833 14.8833 15.0917 15.5417 14.675 16.125C14.2583 16.7083 13.7 17 13 17C12.3 17 11.7417 16.7083 11.325 16.125C10.9083 15.5417 10.6167 14.8833 10.45 14.15L7.55 14.85C7.91667 16.25 8.56667 17.4583 9.5 18.475C10.4333 19.4917 11.6 20 13 20C14.4 20 15.5667 19.4917 16.5 18.475ZM20 31C21.3 31 22.55 30.7083 23.75 30.125C24.95 29.5417 26.0667 28.6667 27.1 27.5L24.9 25.5C24.1667 26.3 23.3833 26.9083 22.55 27.325C21.7167 27.7417 20.8667 27.95 20 27.95C19.1333 27.95 18.2833 27.7417 17.45 27.325C16.6167 26.9083 15.8333 26.3 15.1 25.5L12.9 27.5C13.9667 28.6667 15.0917 29.5417 16.275 30.125C17.4583 30.7083 18.7 31 20 31ZM30.5 18.475C31.4333 17.4583 32.0833 16.25 32.45 14.85L29.55 14.15C29.3833 14.8833 29.0917 15.5417 28.675 16.125C28.2583 16.7083 27.7 17 27 17C26.3 17 25.7417 16.7083 25.325 16.125C24.9083 15.5417 24.6167 14.8833 24.45 14.15L21.55 14.85C21.9167 16.25 22.5667 17.4583 23.5 18.475C24.4333 19.4917 25.6 20 27 20C28.4 20 29.5667 19.4917 30.5 18.475ZM12.2 38.425C9.76667 37.375 7.65 35.95 5.85 34.15C4.05 32.35 2.625 30.2333 1.575 27.8C0.525 25.3667 0 22.7667 0 20C0 17.2333 0.525 14.6333 1.575 12.2C2.625 9.76667 4.05 7.65 5.85 5.85C7.65 4.05 9.76667 2.625 12.2 1.575C14.6333 0.525 17.2333 0 20 0C22.7667 0 25.3667 0.525 27.8 1.575C30.2333 2.625 32.35 4.05 34.15 5.85C35.95 7.65 37.375 9.76667 38.425 12.2C39.475 14.6333 40 17.2333 40 20C40 22.7667 39.475 25.3667 38.425 27.8C37.375 30.2333 35.95 32.35 34.15 34.15C32.35 35.95 30.2333 37.375 27.8 38.425C25.3667 39.475 22.7667 40 20 40C17.2333 40 14.6333 39.475 12.2 38.425ZM31.35 31.35C34.45 28.25 36 24.4667 36 20C36 15.5333 34.45 11.75 31.35 8.65C28.25 5.55 24.4667 4 20 4C15.5333 4 11.75 5.55 8.65 8.65C5.55 11.75 4 15.5333 4 20C4 24.4667 5.55 28.25 8.65 31.35C11.75 34.45 15.5333 36 20 36C24.4667 36 28.25 34.45 31.35 31.35Z"
			fill="#CC1E1C"
		/>
	</svg>
);

/** Curved back-arrow icon (↩) — points from the text at the smiley pill. */
const BackHookArrowIcon: React.FC = () => (
	<svg
		width="24"
		height="24"
		viewBox="0 0 24 24"
		fill="none"
		xmlns="http://www.w3.org/2000/svg"
		aria-hidden="true"
	>
		<path
			d="M9 14L4 9M4 9L9 4M4 9H16C17.0609 9 18.0783 9.42143 18.8284 10.1716C19.5786 10.9217 20 11.9391 20 13V20"
			stroke="#4C555F"
			strokeWidth="2.5"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
	</svg>
);

/** White checkmark on the queue button. */
const QueueCheckIcon: React.FC = () => (
	<svg
		width="32"
		height="32"
		viewBox="0 0 40 40"
		fill="none"
		xmlns="http://www.w3.org/2000/svg"
		aria-hidden="true"
	>
		<path
			d="M15.916 30.0007L6.41602 20.5007L8.79102 18.1257L15.916 25.2507L31.2077 9.95898L33.5827 12.334L15.916 30.0007Z"
			fill="white"
		/>
	</svg>
);

/** House-with-chimney icon — "local counselor" button. */
const LocalCounselorIcon: React.FC = () => (
	<svg
		width="20"
		height="15"
		viewBox="0 0 20 15"
		fill="none"
		xmlns="http://www.w3.org/2000/svg"
		aria-hidden="true"
	>
		<path
			d="M0 15V6L4 2H5V0H7V2H16L20 6V15H0ZM14 13H18V6.825L16 4.825L14 6.825V13ZM2 13H12V8H2V13Z"
			fill="white"
		/>
	</svg>
);

/**
 * Waiting-queue action bar shown after the pseudonym has been confirmed.
 * Strict match for Figma "Frame951":
 *
 *   ┌─────────┐
 *   │   :)    │  ↩  Bis der Chat beginnt,      ┌─────────────────────────┐
 *   │  (red)  │     eine kurze interaktive    │  ✓  23 Personen vor Ihnen │
 *   │  pill   │     ruhige Begleitung.        └─────────────────────────┘
 *   │         │     Direkt hier im Chatraum   ┌─────────────────────────┐
 *   └─────────┘                                │ 🏠  Anfrage an lokalen B.│
 *                                              └─────────────────────────┘
 */
export const WaitingQueueActionBar: React.FC<WaitingQueueActionBarProps> = ({
	queuePosition = null,
	onOpenCalmCompanion,
	onRequestLocalCounselor,
	disabled
}) => {
	const { t } = useTranslation();

	const queueLabel =
		queuePosition && queuePosition > 0
			? t(
					'anonymousChat.queue.positionCount',
					'{{count}} Personen vor Ihnen',
					{ count: queuePosition }
				)
			: t('anonymousChat.queue.connecting', 'Wird verbunden …');

	return (
		<div
			className="waitingQueueActionBar"
			role="group"
			aria-label={t(
				'anonymousChat.queue.actionsLabel',
				'Wartebereich-Aktionen'
			)}
		>
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
						<CalmCompanionSmileyIcon />
					</span>
				</button>
				<div className="waitingQueueActionBar__hint">
					<span
						className="waitingQueueActionBar__hintArrow"
						aria-hidden="true"
					>
						<BackHookArrowIcon />
					</span>
					<p className="waitingQueueActionBar__hintText">
						{t(
							'anonymousChat.queue.calmCompanionHint',
							'Bis der Chat beginnt, eine kurze interaktive ruhige Begleitung. Direkt hier im Chatraum'
						)}
					</p>
				</div>
			</div>

			<div className="waitingQueueActionBar__right">
				<div
					className="waitingQueueActionBar__queueBtn"
					role="status"
					aria-live="polite"
				>
					<span
						className="waitingQueueActionBar__queueBtnInner"
						aria-hidden="true"
					>
						<span className="waitingQueueActionBar__queueIcon">
							<QueueCheckIcon />
						</span>
						<span className="waitingQueueActionBar__queueLabel">
							{queueLabel}
						</span>
					</span>
				</div>

				<button
					type="button"
					className="waitingQueueActionBar__localBtn"
					onClick={onRequestLocalCounselor}
					disabled={disabled || !onRequestLocalCounselor}
				>
					<span className="waitingQueueActionBar__localIcon">
						<LocalCounselorIcon />
					</span>
					<span className="waitingQueueActionBar__localLabel">
						{t(
							'anonymousChat.queue.requestLocalCounselor',
							'Anfrage an lokalen Berater senden'
						)}
					</span>
				</button>
			</div>
		</div>
	);
};
