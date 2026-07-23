/**
 * Video Call Component (Matrix Migration)
 * Now uses Matrix native WebRTC calls instead of Jitsi/VideoService
 */

import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MatrixCallView } from '../matrixCall/MatrixCallView';

const VideoCall = () => {
	const navigate = useNavigate();
	const { roomId: encodedRoomId, type } = useParams<{
		roomId: string;
		type: string;
	}>();

	// Decode the room ID (it's URL encoded)
	const roomId = encodedRoomId ? decodeURIComponent(encodedRoomId) : '';
	const isVideoCall = type === 'video';

	// console.log('📞 VideoCall component loaded');
	// console.log('📞 Encoded Room ID:', encodedRoomId);
	// console.log('📞 Decoded Room ID:', roomId);
	// console.log('📞 Call Type:', type, '(video:', isVideoCall, ')');

	const handleCallEnd = () => {
		// console.log('📞 Call ended, returning to session');
		navigate(-1);
	};

	if (!roomId) {
		return (
			<div style={{ 
				display: 'flex', 
				flexDirection: 'column',
				justifyContent: 'center', 
				alignItems: 'center', 
				height: '100vh', 
				background: '#000', 
				color: '#fff',
				padding: '20px',
				textAlign: 'center'
			}}>
				<h2>❌ No room ID provided</h2>
				<p>Cannot start call without a room ID.</p>
				<p style={{ fontSize: '12px', color: '#888' }}>
					Encoded: {encodedRoomId || 'none'}
				</p>
				<button 
					onClick={() => navigate(-1)}
					style={{
						marginTop: '20px',
						padding: '10px 20px',
						fontSize: '16px',
						cursor: 'pointer'
					}}
				>
					Go Back
				</button>
			</div>
		);
	}

	return (
		<MatrixCallView
			roomId={roomId}
			isVideoCall={isVideoCall}
			onCallEnd={handleCallEnd}
		/>
	);
};

export default VideoCall;
