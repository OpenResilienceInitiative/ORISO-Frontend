import * as React from 'react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { ReactComponent as CaseAcceptedIcon } from '../../resources/img/icons/case-handover/case-accepted.svg';
import { ReactComponent as StackVerticalIcon } from '../../resources/img/icons/stack-vertical.svg';
import { ReactComponent as DeliverySentIcon } from '../../resources/img/icons/delivery-sent.svg';
import { CarimatRobotIcon } from '../pseudonym/PrivacyMessageCard';
import { ButtonGroup } from '../buttonGroup/ButtonGroup';
import { Switch } from '../Switch';
import '../message/message.styles.scss';
import './caseHandoverClientCards.styles';

/**
 * Client-facing case-handover surfaces (Figma "App.Oriso" node 8498-32373,
 * "Chat Room Desktop"):
 *
 * - CaseHandoverAcceptedCard — "Your inquiry has been accepted by a
 *   consultant." with the View-conversation action (desktop + mobile).
 * - CaseHandoverSystemMessageCard — an ordinary Carimat system message in the
 *   chat stream: bot avatar and kebab on the left, bold title with a quiet
 *   qualifier beside it, and the payload inside the standard grey incoming
 *   bubble. It is deliberately NOT a standalone card — a handover notice is a
 *   message like any other, so it reuses `.messageItem*` markup, spacing and
 *   tokens rather than inventing a second chat surface. See ORISO-Frontend#491.
 */

const IconOpenConversation = () => (
	<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
		<path
			d="M4 20V15H6V16.6L9.6 13L11 14.4L7.4 18H9V20H4ZM15 20V18H16.6L13 14.4L14.4 13L18 16.6V15H20V20H15ZM9 11L5.4 7.4V9H3.4V4H8.4V6H6.8L10.4 9.6L9 11ZM14.4 11L13 9.6L16.6 6H15V4H20V9H18V7.4L14.4 11Z"
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

interface CaseHandoverSystemMessageBodyProps {
	/** Reason label ("Selected reason: …"). */
	reasonLabel?: string;
	explanation?: string;
	children?: React.ReactNode;
}

/**
 * Bubble payload only. `MessageItemComponent` already renders the avatar,
 * the two-line header and the grey bubble for every system notification, so
 * inside the chat stream only this part is needed — nesting a second card in
 * there is what produced the rejected "card inside a bubble" look.
 */
export const CaseHandoverSystemMessageBody = ({
	reasonLabel,
	explanation,
	children
}: CaseHandoverSystemMessageBodyProps) => {
	const { t: translate } = useTranslation();

	if (!reasonLabel && !explanation && !children) {
		return null;
	}

	return (
		<div
			className="caseHandoverMessage__body"
			data-cy="case-handover-system-message-body"
		>
			{reasonLabel && (
				<p className="caseHandoverMessage__reason">
					{translate('caseHandover.systemMessage.selectedReason', {
						reason: reasonLabel
					})}
				</p>
			)}
			{explanation && (
				<p className="caseHandoverMessage__explanation">
					{translate('caseHandover.systemMessage.explanation', {
						explanation
					})}
				</p>
			)}
			{children}
		</div>
	);
};

interface CaseHandoverSystemMessageCardProps {
	title: string;
	/** Quiet qualifier under the title, e.g. "You don't need to take any action". */
	subtitle?: string;
	children?: React.ReactNode;
	/** Reason label ("Selected reason: …"). */
	reasonLabel?: string;
	explanation?: string;
	timestamp?: string;
	/** Opens the message action menu; the kebab is decorative without it. */
	onOpenMenu?: () => void;
}

/**
 * Stand-alone Carimat system message for surfaces that render outside the
 * message list (e.g. the inline consent prompt in `SessionStream`). Same
 * markup an incoming message uses, so it lines up with the stream around it.
 */
export const CaseHandoverSystemMessageCard = ({
	title,
	subtitle,
	children,
	reasonLabel,
	explanation,
	timestamp,
	onOpenMenu
}: CaseHandoverSystemMessageCardProps) => {
	const { t: translate } = useTranslation();

	return (
		<div
			className="messageItem messageItem--caseHandoverNotice"
			data-cy="case-handover-system-message"
		>
			<div className="messageItem__messageWrap messageItem__messageWrap--left">
				<div className="messageItem__sideColumn messageItem__sideColumn--left">
					<div className="messageItem__sideColumnGroup messageItem__sideColumnGroup--left">
						<div className="messageItem__avatar messageItem__avatar--bot">
							<span
								className="messageItem__botAvatarIcon"
								aria-hidden
							>
								<CarimatRobotIcon />
							</span>
						</div>
						{onOpenMenu ? (
							<button
								type="button"
								className="messageItem__kebabButton messageItem__kebabButton--left"
								aria-label={translate(
									'message.menu.open',
									'More options'
								)}
								onClick={onOpenMenu}
							>
								<StackVerticalIcon className="messageItem__kebabIconDefault" />
							</button>
						) : (
							<span
								className="messageItem__kebabButton messageItem__kebabButton--left messageItem__kebabButton--static"
								aria-hidden
							>
								<StackVerticalIcon className="messageItem__kebabIconDefault" />
							</span>
						)}
					</div>
				</div>
				<div className="messageItem__content">
					<div className="messageItem__header">
						<div className="messageItem__sendFailedHeaderText messageItem__systemNotificationHeaderText">
							<div className="messageItem__sendFailedTitle">
								{title}
							</div>
							{subtitle && (
								<div className="messageItem__sendFailedSubtitle">
									{subtitle}
								</div>
							)}
						</div>
					</div>
					<div className="messageItem__message messageItem__message--systemNotification">
						<CaseHandoverSystemMessageBody
							reasonLabel={reasonLabel}
							explanation={explanation}
						>
							{children}
						</CaseHandoverSystemMessageBody>
						{/* No time rail without a time — a lone delivery tick in an
						    empty rail reads as a broken message. */}
						{timestamp && (
							<div className="messageItem__timeRail">
								<span className="messageItem__messageTime">
									{timestamp}
									<span
										className="messageItem__deliveryStatus messageItem__deliveryStatus--sent"
										role="img"
										aria-label={translate(
											'message.deliveryStatus.sent',
											'sent'
										)}
									>
										<DeliverySentIcon
											aria-hidden
											focusable="false"
										/>
									</span>
								</span>
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
};

interface CaseHandoverConsentCardProps {
	/** Reuses this system-message surface before access (OPT_IN) or after access starts (OPT_OUT). */
	mode?: 'OPT_IN' | 'OPT_OUT';
	isSubmitting?: boolean;
	error?: string;
	onApprove: () => void;
	onDecline: () => void;
	/**
	 * Optional time for the bubble's bottom-right rail (Figma 9564-86125).
	 * `SessionStream` has no timestamp for a still-pending consent request, so
	 * it omits it — and the card renders no rail at all rather than a lone
	 * delivery tick in an empty one.
	 */
	timestamp?: string;
}

/** Client-side continuation for a handover request that requires explicit consent. */
export const CaseHandoverConsentCard = ({
	mode = 'OPT_IN',
	isSubmitting = false,
	error,
	onApprove,
	onDecline,
	timestamp
}: CaseHandoverConsentCardProps) => {
	const { t: translate } = useTranslation();
	const isOptOut = mode === 'OPT_OUT';
	const title = isOptOut
		? translate(
				'caseHandover.consent.optOut.title',
				'A counsellor has access to this conversation'
			)
		: translate(
				'caseHandover.consent.title',
				'A counsellor requested access to this conversation'
			);

	return (
		<div
			className="caseHandoverInlineConsent"
			data-testid="case-handover-inline-consent"
		>
			<CaseHandoverSystemMessageCard
				title={title}
				subtitle={
					isOptOut
						? translate(
								'caseHandover.consent.optOut.copy',
								'Access is already active. You can allow it to continue or end it immediately.'
							)
						: translate(
								'caseHandover.consent.copy',
								'Please approve or decline the request to continue the handover.'
							)
				}
				timestamp={timestamp}
			>
				{isOptOut ? (
					<div className="caseHandoverMessage__optOutSwitch">
						<span>
							{translate(
								'caseHandover.consent.optOut.switchLabel',
								'Allow access for this case handover'
							)}
						</span>
						<Switch
							checked
							disabled={isSubmitting}
							aria-label={translate(
								'caseHandover.consent.optOut.switchLabel',
								'Allow access for this case handover'
							)}
							onChange={(checked) =>
								checked ? onApprove() : onDecline()
							}
						/>
					</div>
				) : (
					<>
						{/*
						 * The pair is a design-system button group (Figma App.Oriso
						 * 9564-86125), not two loose buttons: the numbered badges, the
						 * dark-red / slate pairing and — crucially — the stack-instead-
						 * of-overflow behaviour all belong to the group, and the same
						 * question/answer box recurs elsewhere in the product.
						 *
						 * `ButtonGroup` puts the native `disabled` attribute on each
						 * item, so while the decision is in flight both controls really
						 * do leave the tab order instead of only looking greyed out.
						 */}
						<ButtonGroup
							className="caseHandoverMessage__actions"
							alignment="horizontal-flex"
							numbered
							ariaLabel={title}
							testingAttribute="case-handover-consent-actions"
							items={[
								{
									id: 'caseHandoverConsentApprove',
									label: translate(
										'caseHandover.consent.approve',
										'Approve access'
									),
									variant: 'primary',
									disabled: isSubmitting,
									onClick: onApprove,
									testingAttribute:
										'case-handover-consent-approve'
								},
								{
									id: 'caseHandoverConsentDecline',
									label: translate(
										'caseHandover.consent.decline',
										'Decline access'
									),
									variant: 'tonal',
									disabled: isSubmitting,
									onClick: onDecline,
									testingAttribute:
										'case-handover-consent-decline'
								}
							]}
						/>
					</>
				)}
				{error && (
					<p className="caseHandoverMessage__error" role="alert">
						{error}
					</p>
				)}
			</CaseHandoverSystemMessageCard>
		</div>
	);
};
