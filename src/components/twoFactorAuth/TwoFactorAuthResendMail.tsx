import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckmarkIcon, WarningIcon } from '../../resources/img/icons';
import { Text } from '../text/Text';
import type { EmailCodeResendResult } from '../login/loginErrorResolution';
import './twoFactorAuthResendMail.styles';

/**
 * Fallback wait between two code mails, used only when Keycloak sends no
 * `resendAvailableInSeconds` (its own cooldown and cap, ORISO-Keycloak#46).
 */
export const EMAIL_CODE_RESEND_COOLDOWN_SECONDS = 30;

/** 27 -> "0:27", 75 -> "1:15". */
export const formatResendCountdown = (seconds: number): string =>
	`${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

type Notice = 'sent' | 'failed' | 'tooMany' | null;

interface TwoFactorAuthResendMailProps {
	/**
	 * Asks for a new code and resolves once the server has answered. The
	 * component never claims "sent" before that answer.
	 */
	onResend: () => Promise<EmailCodeResendResult>;
	/** Wait before the first resend; a code was mailed a moment ago. */
	initialCooldownSeconds?: number;
	/** Shown from the start, e.g. when sign-in already hit the code limit. */
	initialNotice?: 'tooMany';
}

export const TwoFactorAuthResendMail: React.FC<
	TwoFactorAuthResendMailProps
> = ({
	onResend,
	initialCooldownSeconds = EMAIL_CODE_RESEND_COOLDOWN_SECONDS,
	initialNotice
}) => {
	const { t: translate } = useTranslation();
	const hintId = useId();
	// A deadline instead of a decrementing counter: browsers throttle timers
	// in background tabs, and the wait must still end on time.
	const [availableAt, setAvailableAt] = useState(
		() => Date.now() + initialCooldownSeconds * 1000
	);
	const secondsUntil = useCallback(
		(deadline: number) =>
			Math.max(0, Math.ceil((deadline - Date.now()) / 1000)),
		[]
	);
	const [secondsLeft, setSecondsLeft] = useState(() =>
		secondsUntil(availableAt)
	);
	const [isSending, setIsSending] = useState(false);
	const [notice, setNotice] = useState<Notice>(initialNotice ?? null);
	// State updates land after the next render; a fast double click must not
	// slip through in between.
	const isSendingRef = useRef(false);
	const isMountedRef = useRef(true);

	useEffect(
		() => () => {
			isMountedRef.current = false;
		},
		[]
	);

	useEffect(() => {
		setSecondsLeft(secondsUntil(availableAt));
		const timer = window.setInterval(() => {
			const left = secondsUntil(availableAt);
			setSecondsLeft(left);
			if (left === 0) {
				window.clearInterval(timer);
			}
		}, 1000);
		return () => window.clearInterval(timer);
	}, [availableAt, secondsUntil]);

	const isBlocked = isSending || secondsLeft > 0;

	const startCooldown = (seconds: number) => {
		const deadline = Date.now() + seconds * 1000;
		setAvailableAt(deadline);
		setSecondsLeft(secondsUntil(deadline));
	};

	const handleClick = async () => {
		if (isSendingRef.current || secondsUntil(availableAt) > 0) {
			return;
		}
		isSendingRef.current = true;
		setIsSending(true);
		setNotice(null);

		let result: EmailCodeResendResult;
		try {
			result = await onResend();
		} catch {
			result = { kind: 'failed' };
		}
		isSendingRef.current = false;
		if (!isMountedRef.current) {
			return;
		}
		setIsSending(false);

		switch (result.kind) {
			case 'sent':
				setNotice('sent');
				startCooldown(
					result.resendAvailableInSeconds ??
						EMAIL_CODE_RESEND_COOLDOWN_SECONDS
				);
				break;
			case 'tooMany':
				setNotice('tooMany');
				startCooldown(
					result.resendAvailableInSeconds ??
						EMAIL_CODE_RESEND_COOLDOWN_SECONDS
				);
				break;
			case 'failed':
				// Nothing was mailed, so trying again right away is fine.
				setNotice('failed');
				break;
			default:
				break;
		}
	};

	return (
		<div className="twoFactorAuthResendMail">
			<Text
				className="bold"
				text={translate('twoFactorAuth.activate.email.resend.headline')}
				type="infoLargeStandard"
			/>
			{/* aria-disabled, not disabled: the button keeps keyboard focus
			    while the countdown runs instead of dropping it on <body>. */}
			<button
				type="button"
				className="twoFactorAuthResendMail__link"
				aria-disabled={isBlocked}
				aria-describedby={hintId}
				onClick={handleClick}
			>
				{secondsLeft > 0
					? translate(
							'twoFactorAuth.activate.email.resend.countdown',
							{
								time: formatResendCountdown(secondsLeft)
							}
						)
					: translate('twoFactorAuth.activate.email.resend.new')}
			</button>
			<p
				id={hintId}
				className="text text__infoSmall twoFactorAuthResendMail__hint"
			>
				{translate('twoFactorAuth.activate.email.resend.onlyLatest')}
			</p>
			{/* Always rendered: a live region must exist before its text
			    changes, or screen readers miss the announcement. */}
			<p
				role="status"
				className={`text text__infoSmall twoFactorAuthResendMail__status${
					notice && notice !== 'sent'
						? ' twoFactorAuthResendMail__status--error'
						: ''
				}`}
			>
				{notice === 'sent' && (
					<>
						<CheckmarkIcon aria-hidden="true" />{' '}
						{translate('twoFactorAuth.activate.email.resend.sent')}
					</>
				)}
				{notice === 'failed' && (
					<>
						<WarningIcon aria-hidden="true" />{' '}
						{translate(
							'twoFactorAuth.activate.email.resend.failed'
						)}
					</>
				)}
				{notice === 'tooMany' && (
					<>
						<WarningIcon aria-hidden="true" />{' '}
						{translate(
							'twoFactorAuth.activate.email.resend.tooMany'
						)}
					</>
				)}
			</p>
		</div>
	);
};
