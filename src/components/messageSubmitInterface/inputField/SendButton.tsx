import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as SendPlaneIcon } from '../../../resources/img/icons/paper-plane.svg';
import {
	deriveSendButtonState,
	getSendButtonTransition,
	SendButtonState
} from './sendButtonState';
import './sendButton.styles.scss';

export interface SendButtonProps {
	state: SendButtonState;
	onSend?: () => void;
	type?: 'button' | 'submit';
}

export { deriveSendButtonState };

/**
 * Figma "Nachricht senden" (489:16565): 48×48, bottom-left 24 / top-right 4
 * radius. One paper plane throughout: at rest (pointing right) on the pale
 * fixed container when empty, rotated up on primary-container when ready —
 * the empty → ready transition rotates the plane. Sending launches the
 * fly-out animation.
 */
export const SendButton = ({
	state,
	onSend,
	type = 'submit'
}: SendButtonProps) => {
	const { t: translate } = useTranslation();
	const previousState = useRef<SendButtonState>(state);
	const [isFlyingOut, setIsFlyingOut] = useState(false);

	useEffect(() => {
		const transition = getSendButtonTransition(previousState.current, state);
		previousState.current = state;
		if (transition === 'fly-out') {
			setIsFlyingOut(true);
		}
	}, [state]);

	const isBlocked = state === 'disabled' || state === 'sending';
	const isEmpty = state === 'empty';

	return (
		<button
			type={type}
			disabled={isBlocked || isEmpty}
			onClick={type === 'button' ? () => onSend?.() : undefined}
			aria-disabled={isBlocked || isEmpty}
			className={[
				'sendButton',
				`sendButton--${state}`,
				isFlyingOut && 'sendButton--flyout'
			]
				.filter(Boolean)
				.join(' ')}
			title={translate('enquiry.write.input.button.title')}
			aria-label={translate('enquiry.write.input.button.title')}
		>
			<span
				className="sendButton__plane"
				aria-hidden
				onAnimationEnd={() => setIsFlyingOut(false)}
			>
				<SendPlaneIcon className="sendButton__planeIcon" />
			</span>
		</button>
	);
};
