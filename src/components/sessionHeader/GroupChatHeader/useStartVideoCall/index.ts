import { useCallback, useContext } from 'react';
import { ActiveSessionContext } from '../../../../globalState';

export const useStartVideoCall = () => {
	const { activeSession } = useContext(ActiveSessionContext);

	const onStartVideoCall = useCallback(() => {
		console.log("═══════════════════════════════════════════════");
		console.log("🎬 GROUP VIDEO CALL BUTTON CLICKED!");
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

			// 🎯 GROUP CALLS: Open Element Call in a new popup window
			// Element Call handles all the group call UI (grid layout, active speaker, etc.)
			console.log('📞 Opening Element Call for group video call...');
			
			// Get Matrix homeserver from current client
			const matrixClientService = (window as any).matrixClientService;
			const client = matrixClientService?.getClient();
			const homeserverUrl = client?.getHomeserverUrl() || 'https://matrix.oriso.site';
			
			// Build Element Call URL
			// Format: https://call.element.io/{roomId}?homeserver={homeserver}
			const elementCallUrl = `https://call.element.io/${encodeURIComponent(roomId)}?homeserver=${encodeURIComponent(homeserverUrl)}`;
			
			console.log('🌐 Opening Element Call URL:', elementCallUrl);
			
			// Open in a new popup window (sized for video calls)
			const width = 1200;
			const height = 800;
			const left = (window.screen.width - width) / 2;
			const top = (window.screen.height - height) / 2;
			
			window.open(
				elementCallUrl,
				'ElementCall',
				`width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
			);
			
			console.log('✅ Element Call popup opened!');
		} catch (error) {
			console.error('💥 ERROR in onStartVideoCall:', error);
			alert(`Failed to start group call: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
		console.log("═══════════════════════════════════════════════");
	}, [activeSession.item.groupId, activeSession.item.matrixRoomId]);

	return {
		url: '', // No longer used
		startVideoCall: onStartVideoCall
	};
};
