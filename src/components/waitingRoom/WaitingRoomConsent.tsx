import * as React from 'react';
import { useRef, useState } from 'react';
import { ButtonBase, Typography } from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import WavingHandOutlinedIcon from '@mui/icons-material/WavingHandOutlined';
import { ConsentCompletionPanel } from '../registration/consentCompletion/ConsentCompletionPanel';
import { sanitizeConsentHtml } from '../legalContent/legalHtmlSanitizer';
import { consentBindingKey } from '../registration/accountData/consentAcceptance';
import { useLegalHtmlWithDialogs } from '../legalLinks/useLegalHtmlWithDialogs';
import { registrationMd3 } from '../registration/registrationDesign/registrationDesign';

export interface WaitingRoomConsentOptions {
	/**
	 * The tenant's consent sentence as HTML (legal links inside). Rendered
	 * through the ADR-022 sanitizer, never raw.
	 */
	consentHtml: string;
	/**
	 * The department behind the room (ADR-003: agency × topic), once known.
	 * Its legal links then open that department's documents; before, the
	 * platform's (ADR-022).
	 */
	department?: { agencyId: number; topicId: number } | null;
}

/**
 * The consent of a waiting room: a real checkbox bound to the words shown,
 * and a guard for the button behind it (#1341 item 2).
 *
 * What is on offer, not merely "something was ticked" — the registration's
 * rule (`consentAcceptance.ts`). Agency and topic are unknown here, so the
 * wording alone is the identity: switch language and the sentence changes,
 * the binding stops matching, and the box unticks instead of carrying
 * agreement onto words nobody read.
 */
export const useWaitingRoomConsent = ({
	consentHtml,
	department
}: WaitingRoomConsentOptions) => {
	const binding = consentBindingKey(null, null, null, consentHtml);
	const renderConsentHtml = useLegalHtmlWithDialogs(
		department
			? {
					scope: 'agency',
					agencyId: department.agencyId,
					topicId: department.topicId
				}
			: { scope: 'platform' }
	);
	const [acceptedBinding, setAcceptedBinding] = useState<string | null>(null);
	const [missing, setMissing] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);
	const accepted = acceptedBinding !== null && acceptedBinding === binding;

	return {
		accepted,
		missing,
		inputRef,
		toggle: () => {
			setAcceptedBinding(accepted ? null : binding);
			setMissing(false);
		},
		/** "Nicht zustimmen" takes the tick back: reopening asks again. */
		reset: () => {
			setAcceptedBinding(null);
			setMissing(false);
		},
		/**
		 * The gate. The button stays live rather than going disabled: a dead
		 * primary action tells nobody why, and "why" is the point of the
		 * error state.
		 */
		guard: (onAgreed: () => void) => {
			if (!accepted) {
				setMissing(true);
				inputRef.current?.focus();
				return;
			}
			onAgreed();
		},
		label: (
			<Typography
				component="div"
				sx={{
					'fontSize': 14,
					'lineHeight': '20px',
					'fontWeight': 600,
					'& a': { color: registrationMd3.primary }
				}}
			>
				{renderConsentHtml(sanitizeConsentHtml(consentHtml))}
			</Typography>
		)
	};
};

export type WaitingRoomConsent = ReturnType<typeof useWaitingRoomConsent>;

export interface WaitingRoomConsentPanelProps {
	consent: WaitingRoomConsent;
	/** "Sie sind dran." */
	heading: string;
	subtitle?: string;
	/** Default: the waving hand of the live chat. */
	icon?: React.ReactNode;
	/** The round X: nobody is left with one choice (Frank, 2026-09-05). */
	declineLabel: string;
	onDecline: () => void;
	/** Shown under the box when the button was pressed without consent. */
	missingText: string;
	/** Ties the checkbox to its error; unique per page. */
	errorId: string;
	/** An error of its own, e.g. the agreement could not be saved. */
	error?: string;
	disabled?: boolean;
}

/** The consent sheet that slides into the bar when it is the person's turn. */
export const WaitingRoomConsentPanel = ({
	consent,
	heading,
	subtitle,
	icon = <WavingHandOutlinedIcon />,
	declineLabel,
	onDecline,
	missingText,
	errorId,
	error,
	disabled = false
}: WaitingRoomConsentPanelProps) => (
	<ConsentCompletionPanel
		ariaLabel={heading}
		status={{
			heading,
			icon,
			subtitle,
			trailingAction: (
				<ButtonBase
					aria-label={declineLabel}
					onClick={() => {
						// Every room: declining withdraws the tick, so a
						// reopened sheet never joins on the old agreement.
						consent.reset();
						onDecline();
					}}
					disabled={disabled}
					sx={{
						width: 48,
						height: 48,
						flexShrink: 0,
						borderRadius: '50%',
						border: `1.5px solid ${registrationMd3.outline}`,
						color: registrationMd3.onSurfaceVariant
					}}
				>
					<CloseRoundedIcon />
				</ButtonBase>
			)
		}}
		checked={consent.accepted}
		disabled={disabled}
		inputRef={consent.inputRef}
		onChange={consent.toggle}
		label={consent.label}
		errorId={errorId}
		error={error ?? (consent.missing ? missingText : undefined)}
	/>
);
