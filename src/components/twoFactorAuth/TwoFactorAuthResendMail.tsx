import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckmarkIcon } from '../../resources/img/icons';
import { Text } from '../text/Text';
import './twoFactorAuthResendMail.styles';

/** Used when the realm does not report its own cooldown (a build before #1338). */
export const RESEND_FALLBACK_COOLDOWN_SECONDS = 30;

/**
 * Rejection reason a caller uses when it has already put the reason on screen
 * itself — the login form names the actual problem ("too many codes, wait 12
 * minutes"), and a second generic line below it would only add noise.
 */
export const RESEND_ERROR_ALREADY_SHOWN = 'resend-error-already-shown';

interface TwoFactorAuthResendMailProps {
	/**
	 * Asks the server for a new code. The component shows "sent" only once this
	 * resolves, and an error if it rejects — before #1338 it reported success
	 * immediately, so a failed send looked exactly like a successful one.
	 */
	resendHandler: (callback: Function) => void | Promise<unknown>;
	/**
	 * Seconds the server says to wait, from `resendAvailableInSeconds`. The
	 * countdown starts from this; it falls back to
	 * {@link RESEND_FALLBACK_COOLDOWN_SECONDS} when the realm sends nothing.
	 */
	cooldownSeconds?: number;
}

const formatCountdown = (secondsLeft: number): string => {
	const minutes = Math.floor(secondsLeft / 60);
	const seconds = secondsLeft % 60;
	return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

export const TwoFactorAuthResendMail: React.FC<
	TwoFactorAuthResendMailProps
> = ({ resendHandler, cooldownSeconds }) => {
	const { t: translate } = useTranslation();
	const [isCodeSent, setIsCodeSent] = useState(false);
	const [hasFailed, setHasFailed] = useState(false);
	const [isSending, setIsSending] = useState(false);
	const [secondsLeft, setSecondsLeft] = useState(0);
	const isMountedRef = useRef(true);

	useEffect(() => {
		isMountedRef.current = true;
		return () => {
			isMountedRef.current = false;
		};
	}, []);

	// One interval for the whole countdown. A timeout chain would drift, and a
	// per-second effect would restart the interval on every tick.
	useEffect(() => {
		if (secondsLeft <= 0) {
			return undefined;
		}
		const interval = window.setInterval(() => {
			setSecondsLeft((current) => (current <= 1 ? 0 : current - 1));
		}, 1000);
		return () => window.clearInterval(interval);
	}, [secondsLeft > 0]); // eslint-disable-line react-hooks/exhaustive-deps

	// The server's own figure wins. A realm that reports a wait while the form
	// is open (the user clicked twice, or came back inside the cooldown) must be
	// able to extend the countdown, never shorten it behind the user's back.
	useEffect(() => {
		if (typeof cooldownSeconds === 'number' && cooldownSeconds > 0) {
			setSecondsLeft((current) => Math.max(current, cooldownSeconds));
		}
	}, [cooldownSeconds]);

	const handleClick = useCallback(() => {
		if (isSending || secondsLeft > 0) {
			return;
		}
		setIsSending(true);
		setHasFailed(false);

		let callbackRan = false;
		const confirmSent = () => {
			callbackRan = true;
			if (!isMountedRef.current) {
				return;
			}
			setIsCodeSent(true);
			setSecondsLeft(cooldownSeconds || RESEND_FALLBACK_COOLDOWN_SECONDS);
			window.setTimeout(() => {
				if (isMountedRef.current) {
					setIsCodeSent(false);
				}
			}, 2000);
		};

		// `resendHandler` may be synchronous (it was, before #1338). Treating its
		// return value as a promise either way keeps both shapes working.
		Promise.resolve(resendHandler(confirmSent))
			.then(() => {
				if (!callbackRan && isMountedRef.current) {
					// A handler that resolves without calling back still means
					// the request came back; do not leave the user without any
					// feedback at all.
					confirmSent();
				}
			})
			.catch((reason: unknown) => {
				if (!isMountedRef.current) {
					return;
				}
				setHasFailed(
					(reason as Error | null)?.message !==
						RESEND_ERROR_ALREADY_SHOWN
				);
			})
			.finally(() => {
				if (isMountedRef.current) {
					setIsSending(false);
				}
			});
	}, [cooldownSeconds, isSending, resendHandler, secondsLeft]);

	const isWaiting = secondsLeft > 0;

	return (
		<div className="twoFactorAuthResendMail">
			<Text
				className="bold"
				text={translate('twoFactorAuth.activate.email.resend.headline')}
				type="infoLargeStandard"
			/>
			{isCodeSent ? (
				<p className="text text__infoLargeStandard">
					<CheckmarkIcon />{' '}
					{translate('twoFactorAuth.activate.email.resend.sent')}
				</p>
			) : (
				<button
					type="button"
					onClick={handleClick}
					disabled={isWaiting || isSending}
					aria-live="polite"
				>
					{isWaiting
						? translate(
								'twoFactorAuth.activate.email.resend.newIn',
								{ countdown: formatCountdown(secondsLeft) }
							)
						: translate('twoFactorAuth.activate.email.resend.new')}
				</button>
			)}
			<Text
				className="twoFactorAuthResendMail__onlyNewest"
				text={translate(
					'twoFactorAuth.activate.email.resend.onlyNewest'
				)}
				type="infoSmall"
			/>
			{hasFailed && (
				<Text
					className="twoFactorAuthResendMail__error"
					text={translate(
						'twoFactorAuth.activate.email.resend.failed'
					)}
					type="infoSmall"
				/>
			)}
		</div>
	);
};
