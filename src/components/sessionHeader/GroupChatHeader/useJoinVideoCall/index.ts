import { useCallback, useContext } from 'react';
import {
	AUTHORITIES,
	UserDataContext,
	hasUserAuthority
} from '../../../../globalState';
import { generatePath } from 'react-router-dom';
import { useAppConfig } from '../../../../hooks/useAppConfig';
import { apiJoinGroupChat } from '../../../../api';

const regexUUID =
	/(\b[0-9a-f]{8}\b-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-\b[0-9a-f]{12}\b)/;

export const useJoinVideoCall = () => {
	const { urls } = useAppConfig();
	const { userData } = useContext(UserDataContext);

	const isConsultant = hasUserAuthority(
		AUTHORITIES.CONSULTANT_DEFAULT,
		userData
	);

	const openVideoWindow = useCallback(
		(roomIdOrUrl: string, videoActivated: boolean) => {
			// MATRIX MIGRATION: Open Matrix call in new tab
			
			// Check if already a full URL (starts with /videoanruf/)
			if (roomIdOrUrl.startsWith('/videoanruf/')) {
				console.log('📞 Opening call in new tab with existing URL:', roomIdOrUrl);
				window.open(roomIdOrUrl, '_blank');
				return;
			}
			
			// Otherwise, build the URL from room ID
			const encodedRoomId = encodeURIComponent(roomIdOrUrl);
			const callType = videoActivated ? 'video' : 'voice';
			const callUrl = `/videoanruf/${encodedRoomId}/${callType}`;
			
			console.log('📞 Opening call in new tab:', callUrl);
			window.open(callUrl, '_blank');
		},
		[urls.videoCall]
	);

	const onJoinConsultantCall = useCallback(
		(roomId, videoActivated: boolean) => {
			// MATRIX MIGRATION: Join Matrix call directly
			console.log('📞 Joining Matrix call for room:', roomId);
			openVideoWindow(roomId, videoActivated);
		},
		[openVideoWindow]
	);

	const joinVideoCall = useCallback(
		(link, videoActivated = true) => {
			const uuid = link.match(regexUUID)?.[0];
			isConsultant
				? onJoinConsultantCall(uuid, videoActivated)
				: openVideoWindow(link, videoActivated);
		},
		[isConsultant, onJoinConsultantCall, openVideoWindow]
	);

	return {
		joinVideoCall
	};
};
