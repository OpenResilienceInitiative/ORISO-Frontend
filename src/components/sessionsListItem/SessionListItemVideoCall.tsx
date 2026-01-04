import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as CallOffIcon } from '../../resources/img/icons/call-off.svg';
import { currentUserWasVideoCallInitiator } from '../../utils/videoCallHelpers';
import { VideoCallMessageDTO } from '../message/MessageItemComponent';

interface SessionListItemVideoCallProps {
	videoCallMessage: VideoCallMessageDTO;
	listItemUsername: string;
	listItemAskerRcId: string;
}

export const SessionListItemVideoCall = (
	props: SessionListItemVideoCallProps
) => {
	const { t: translate } = useTranslation();
	return (
		<div className="sessionsListItem__subject">
			{currentUserWasVideoCallInitiator(
				props.videoCallMessage.initiatorRcUserId
			) ? (
				<>
					{translate('videoCall.incomingCall.rejected.prefix')}{' '}
					{props.listItemUsername}{' '}
					{translate('videoCall.incomingCall.rejected.suffix')}
				</>
			) : (
				<>
					{props.videoCallMessage.initiatorUserName}{' '}
					{translate('videoCall.incomingCall.ignored')}
				</>
			)}
			<CallOffIcon className="sessionsListItem__videoCallMessageIcon" />
		</div>
	);
};
