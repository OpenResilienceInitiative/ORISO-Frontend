import * as React from 'react';
import { ReactComponent as InfoIcon } from '../../resources/img/icons/i.svg';
import { M3Snackbar } from '../m3Snackbar/M3Snackbar';
import './messageSubmitInfo.styles';

export interface MessageSubmitInfoInterface {
	isInfo: boolean;
	infoHeadline?: string;
	infoMessage?: React.ReactElement;
	/** Errors only: makes the notice dismissable. Needs `closeLabel`. */
	onClose?: () => void;
	/** Already translated. */
	closeLabel?: string;
}

/**
 * Notice above the composer: the counsellor's absence message and the
 * archived-session note as a card (#1210), send and attachment errors as an
 * error snackbar, the one surface the design system has for "this just failed".
 *
 * Info notices are a polite live region (`role="status"`), errors an alert.
 * The icon is decorative — the headline carries the meaning — so it is hidden
 * from assistive technology instead of announcing a generic "Information".
 */
export const MessageSubmitInfo = (props: MessageSubmitInfoInterface) => {
	if (!props.isInfo) {
		return (
			<div className="messageSubmitInfoDock">
				<M3Snackbar
					placement="inline"
					tone="error"
					onClose={props.onClose}
					closeLabel={props.closeLabel}
					sx={{ maxWidth: 'none' }}
					message={
						<>
							{props.infoHeadline && (
								<strong className="messageSubmitInfoDock__headline">
									{props.infoHeadline}
								</strong>
							)}
							{props.infoMessage}
						</>
					}
				/>
			</div>
		);
	}

	return (
		<div
			className="messageSubmitInfoWrapper messageSubmitInfoWrapper--info"
			role="status"
			aria-live="polite"
		>
			<span className="messageSubmitInfoWrapper__icon" aria-hidden="true">
				<InfoIcon aria-hidden="true" focusable="false" />
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
