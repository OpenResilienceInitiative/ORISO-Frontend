import * as React from 'react';
import { ReactComponent as InfoIcon } from '../../resources/img/icons/i.svg';
import { ReactComponent as ErrorIcon } from '../../resources/img/icons/exclamation-mark.svg';
import './messageSubmitInfo.styles';

export interface MessageSubmitInfoInterface {
	isInfo: boolean;
	infoHeadline?: string;
	infoMessage?: React.ReactElement;
}

/**
 * Notice card above the composer: the counsellor's absence message, the
 * archived-session note, and send / attachment errors (#1210).
 *
 * Info notices are a polite live region (`role="status"`), errors an alert.
 * The icon is decorative — the headline carries the meaning — so it is hidden
 * from assistive technology instead of announcing a generic "Information".
 */
export const MessageSubmitInfo = (props: MessageSubmitInfoInterface) => {
	const variant = props.isInfo ? 'info' : 'error';
	const Icon = props.isInfo ? InfoIcon : ErrorIcon;

	return (
		<div
			className={`messageSubmitInfoWrapper messageSubmitInfoWrapper--${variant}`}
			role={props.isInfo ? 'status' : 'alert'}
			aria-live={props.isInfo ? 'polite' : 'assertive'}
		>
			<span className="messageSubmitInfoWrapper__icon" aria-hidden="true">
				<Icon aria-hidden="true" focusable="false" />
			</span>
			<div className="messageSubmitInfoWrapper__body">
				{props.infoHeadline && (
					<span className="messageSubmitInfoWrapper__headline">
						{props.infoHeadline}
					</span>
				)}
				{props.infoMessage && (
					<div className="messageSubmitInfoWrapper__message">
						{props.infoMessage}
					</div>
				)}
			</div>
		</div>
	);
};
