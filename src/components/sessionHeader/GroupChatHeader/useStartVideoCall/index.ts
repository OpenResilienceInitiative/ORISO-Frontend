import { useCallback, useContext } from 'react';
import { ActiveSessionContext } from '../../../../globalState';

export const useStartVideoCall = () => {
	const { activeSession } = useContext(ActiveSessionContext);

	const onStartVideoCall = useCallback(() => {
		console.log("═══════════════════════════════════════════════");
		console.log("🎬 VIDEO CALL BUTTON CLICKED (GroupChatHeader)!");
		console.log("═══════════════════════════════════════════════");
		
		try {
			// Get Matrix room ID from active session
			const roomId = activeSession.item.matrixRoomId || activeSession.item.groupId;
			
			console.log("Room ID:", roomId);
			
			if (!roomId) {
				console.error('❌ No Matrix room ID found for session');
				alert('Cannot start call: No Matrix room found for this session');
				return;
			}

			console.log('📞 Starting call via CallManager');
			
			// Use CallManager directly (clean architecture!)
			const { callManager } = require('../../../../services/CallManager');
			callManager.startCall(roomId, true); // Always video for this button
			
			console.log('✅ Call initiated!');
		} catch (error) {
			console.error('💥 ERROR in onStartVideoCall:', error);
		}
		console.log("═══════════════════════════════════════════════");
	}, [activeSession.item.groupId, activeSession.item.matrixRoomId]);

	return {
		url: '', // No longer used
		startVideoCall: onStartVideoCall
	};
};
