import * as React from 'react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { ReactComponent as CaseAcceptedIcon } from '../../resources/img/icons/case-handover/case-accepted.svg';
import './caseHandoverClientCards.styles';

/**
 * Client-facing case-handover surfaces (Figma "CARX — Teamberatung Case
 * Handover", Screen 01 + Sections 03/04):
 *
 * - CaseHandoverAcceptedCard — "Your inquiry has been accepted by a
 *   consultant." with the View-conversation action (desktop + mobile).
 * - CaseHandoverSystemMessageCard — in-chat system notification (takeover,
 *   supervision activated, important notification) with reason/explanation.
 */

const IconOpenConversation = () => (
	<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
		<path
			d="M4 20V15H6V16.6L9.6 13L11 14.4L7.4 18H9V20H4ZM15 20V18H16.6L13 14.4L14.4 13L18 16.6V15H20V20H15ZM9 11L5.4 7.4V9H3.4V4H8.4V6H6.8L10.4 9.6L9 11ZM14.4 11L13 9.6L16.6 6H15V4H20V9H18V7.4L14.4 11Z"
			fill="currentColor"
		/>
	</svg>
);

const IconBell = () => (
	<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
		<path
			d="M4 19V17H6V10C6 8.61667 6.41667 7.39583 7.25 6.3375C8.08333 5.27917 9.16667 4.58333 10.5 4.25V3.5C10.5 3.08333 10.6458 2.72917 10.9375 2.4375C11.2292 2.14583 11.5833 2 12 2C12.4167 2 12.7708 2.14583 13.0625 2.4375C13.3542 2.72917 13.5 3.08333 13.5 3.5V4.25C14.8333 4.58333 15.9167 5.27917 16.75 6.3375C17.5833 7.39583 18 8.61667 18 10V17H20V19H4ZM12 22C11.45 22 10.9792 21.8042 10.5875 21.4125C10.1958 21.0208 10 20.55 10 20H14C14 20.55 13.8042 21.0208 13.4125 21.4125C13.0208 21.8042 12.55 22 12 22ZM8 17H16V10C16 8.9 15.6083 7.95833 14.825 7.175C14.0417 6.39167 13.1 6 12 6C10.9 6 9.95833 6.39167 9.175 7.175C8.39167 7.95833 8 8.9 8 10V17Z"
			fill="currentColor"
		/>
	</svg>
);

interface CaseHandoverAcceptedCardProps {
	/** Counsellor display name for the body copy. */
	advisorName?: string;
	organisationName?: string;
	onViewConversation: () => void;
	/** Compact layout (mobile card, Screen 01 right variant). */
	compact?: boolean;
}

export const CaseHandoverAcceptedCard = ({
	advisorName,
	organisationName,
	onViewConversation,
	compact = false
}: CaseHandoverAcceptedCardProps) => {
	const { t: translate } = useTranslation();
	return (
		<div
			className={clsx(
				'caseHandoverAccepted',
				compact && 'caseHandoverAccepted--compact'
			)}
			data-cy="case-handover-accepted-card"
		>
			<div className="caseHandoverAccepted__hero">
				<CaseAcceptedIcon
					className="caseHandoverAccepted__icon"
					aria-hidden
				/>
				<h2 className="caseHandoverAccepted__title">
					{translate('caseHandover.accepted.title')}
				</h2>
			</div>
			<p className="caseHandoverAccepted__copy">
				{translate('caseHandover.accepted.copy', {
					advisor:
						advisorName ||
						translate('caseHandover.accepted.advisorFallback'),
					organisation:
						organisationName ||
						translate('caseHandover.accepted.organisationFallback')
				})}
			</p>
			<div className="caseHandoverAccepted__actions">
				<button
					type="button"
					className="caseHandoverAccepted__cta"
					onClick={onViewConversation}
					data-cy="case-handover-accepted-view-conversation"
				>
					<IconOpenConversation />
					{translate('caseHandover.accepted.cta')}
				</button>
			</div>
		</div>
	);
};

interface CaseHandoverSystemMessageCardProps {
	title: string;
	/** e.g. "You don't need to take any action" */
	subtitle?: string;
	children?: React.ReactNode;
	/** Reason label ("Selected reason: …"). */
	reasonLabel?: string;
	explanation?: string;
	timestamp?: string;
}

export const CaseHandoverSystemMessageCard = ({
	title,
	subtitle,
	children,
	reasonLabel,
	explanation,
	timestamp
}: CaseHandoverSystemMessageCardProps) => {
	const { t: translate } = useTranslation();
	return (
		<div
			className="caseHandoverSystemMessage"
			role="note"
			data-cy="case-handover-system-message"
		>
			<div className="caseHandoverSystemMessage__head">
				<span
					className="caseHandoverSystemMessage__bellIcon"
					aria-hidden
				>
					<IconBell />
				</span>
				<div>
					<span className="caseHandoverSystemMessage__badge">
						{translate('caseHandover.systemMessage.badge')}
					</span>
					<h4 className="caseHandoverSystemMessage__title">
						{title}
					</h4>
					{subtitle && (
						<p className="caseHandoverSystemMessage__subtitle">
							{subtitle}
						</p>
					)}
				</div>
			</div>
			{(reasonLabel || explanation || children) && (
				<div className="caseHandoverSystemMessage__body">
					{reasonLabel && (
						<p className="caseHandoverSystemMessage__reason">
							{translate(
								'caseHandover.systemMessage.selectedReason',
								{ reason: reasonLabel }
							)}
						</p>
					)}
					{explanation && (
						<p className="caseHandoverSystemMessage__explanation">
							{translate(
								'caseHandover.systemMessage.explanation',
								{ explanation }
							)}
						</p>
					)}
					{children}
				</div>
			)}
			{timestamp && (
				<span className="caseHandoverSystemMessage__timestamp">
					{timestamp}
				</span>
			)}
		</div>
	);
};
