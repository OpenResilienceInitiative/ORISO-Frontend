import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { formatToHHMM } from '../../utils/dateHelpers';
import { ReactComponent as DeliveryFailedIcon } from '../../resources/img/icons/delivery-failed.svg';
import './message.styles.scss';

interface MessageSendFailedProps {
	/** Timestamp of the send attempt (ms epoch as string, like MessageItem). */
	messageTime?: string;
}

/**
 * "Sending message failed" chat notification (Figma 8498-32373): identical
 * layout to a regular incoming message — avatar column with ring, header
 * next to it, indented bubble — only the avatar glyph ("!") and the red
 * cross in the time rail differ.
 */
export const MessageSendFailed = ({ messageTime }: MessageSendFailedProps) => {
	const { t: translate } = useTranslation();

	return (
		<div className="messageItem messageItem--sendFailed">
			<div className="messageItem__messageWrap messageItem__messageWrap--left">
				<div className="messageItem__sideColumn messageItem__sideColumn--left">
					<div className="messageItem__sideColumnGroup messageItem__sideColumnGroup--left">
						<div className="messageItem__avatar">
							<span
								className="messageItem__sendFailedAvatar"
								aria-hidden
							>
								!
							</span>
						</div>
					</div>
				</div>
				<div className="messageItem__content">
					<div className="messageItem__header">
						<div className="messageItem__sendFailedHeaderText">
							<div className="messageItem__sendFailedTitle">
								{translate(
									'message.sendFailed.title',
									'Sending message failed'
								)}
							</div>
							<div className="messageItem__sendFailedSubtitle">
								{translate(
									'message.sendFailed.subtitle',
									'Resend your message again'
								)}
							</div>
						</div>
					</div>
					<div className="messageItem__message">
						{translate(
							'message.sendFailed.body',
							'There was a problem with sending the message, likely due to encryption or a transfer error. Please copy it and try again. Check the status: one check means sent, two checks mean read, and a cross means it didn’t reach the server.'
						)}
						<div className="messageItem__timeRail">
							<span className="messageItem__messageTime">
								{messageTime ? formatToHHMM(messageTime) : null}
								<span
									className="messageItem__deliveryStatus messageItem__deliveryStatus--failed"
									role="img"
									aria-label={translate(
										'message.sendFailed.status',
										'nicht zugestellt'
									)}
									title={translate(
										'message.sendFailed.status',
										'nicht zugestellt'
									)}
								>
									<DeliveryFailedIcon
										aria-hidden
										focusable="false"
									/>
								</span>
							</span>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};
