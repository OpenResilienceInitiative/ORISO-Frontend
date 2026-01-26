import { getValueFromCookie } from '../components/sessionCookie/accessSessionCookie';
import { generateCsrfToken } from '../utils/generateCsrfToken';
import { apiUrl } from '../resources/scripts/endpoints';

const nodeEnv: string = process.env.NODE_ENV as string;
const isLocalDevelopment = nodeEnv === 'development';

/**
 * Upload file directly to Matrix media endpoint
 * This bypasses the upload service and uses Matrix's native file upload
 */
export const apiMatrixUploadFile = (
	attachment: File,
	sessionId: string | number,
	uploadProgress: Function,
	handleXhr: (xhr) => void
) =>
	new Promise<{content_uri: string, file_name: string, file_size: number}>((resolve, reject) => {
		const accessToken = getValueFromCookie('keycloak');
		const csrfToken = generateCsrfToken();

		// Upload via UserService (same auth pattern as messages)
		const url = `${apiUrl}/service/matrix/sessions/${sessionId}/upload`;

		console.log('📤 MATRIX UPLOAD: Starting upload via UserService:', url);
		console.log('📤 MATRIX UPLOAD: File name:', attachment.name);
		console.log('📤 MATRIX UPLOAD: File size:', attachment.size);
		console.log('📤 MATRIX UPLOAD: File type:', attachment.type);
		console.log('📤 MATRIX UPLOAD: Session ID:', sessionId);

		const xhr = new XMLHttpRequest();
		xhr.withCredentials = true;

		xhr.upload.onprogress = (e) => {
			let percentUpload = Math.min(
				Math.ceil((100 * e.loaded) / e.total),
				100
			);
			console.log('📤 MATRIX UPLOAD: Progress:', percentUpload + '%');
			uploadProgress(percentUpload);
		};

		xhr.onload = (e) => {
			const target = e.target as XMLHttpRequest;
			console.log('📤 MATRIX UPLOAD: Response status:', target.status);
			console.log('📤 MATRIX UPLOAD: Response body:', target.responseText);
			
			if (target.status === 200) {
				try {
					const response = JSON.parse(target.responseText);
					console.log('✅ MATRIX UPLOAD: Upload successful!', response);
					resolve({
						content_uri: response.content_uri,
						file_name: attachment.name,
						file_size: attachment.size
					});
				} catch (err) {
					console.error('❌ MATRIX UPLOAD: Failed to parse response:', err);
					reject(target);
				}
			} else {
				console.error('❌ MATRIX UPLOAD: Upload failed with status:', target.status);
				reject(target);
			}
		};

		xhr.onerror = (e) => {
			console.error('❌ MATRIX UPLOAD: Network error:', e);
			reject(e.target);
		};

		// Create FormData for file upload
		const formData = new FormData();
		formData.append('file', attachment);

		xhr.open('POST', url, true);
		xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
		xhr.setRequestHeader('X-CSRF-TOKEN', csrfToken);
		if (isLocalDevelopment) {
			xhr.setRequestHeader('X-WHITELIST-HEADER', csrfToken);
		}

		console.log('📤 MATRIX UPLOAD: Sending file...');
		xhr.send(formData);

		handleXhr(xhr);
	});

/**
 * Send a message with file attachment to Matrix room
 */
export const apiMatrixSendFileMessage = (
	contentUri: string,
	fileName: string,
	fileSize: number,
	mimeType: string,
	sessionId: string | number,
	messageText?: string
): Promise<any> => {
	const matrixAccessToken = getValueFromCookie('rc_token');
	const csrfToken = generateCsrfToken();
	
	// Get room ID from session (same endpoint as regular messages)
	const url = `${apiUrl}/service/matrix/sessions/${sessionId}/messages`;

	console.log('📨 MATRIX: Sending file message to room');
	console.log('📨 MATRIX: Content URI:', contentUri);
	console.log('📨 MATRIX: File name:', fileName);

	// Determine message type based on mime type
	let msgtype = 'm.file';
	if (mimeType.startsWith('image/')) {
		msgtype = 'm.image';
	} else if (mimeType.startsWith('video/')) {
		msgtype = 'm.video';
	} else if (mimeType.startsWith('audio/')) {
		msgtype = 'm.audio';
	}

	const messageBody = {
		message: messageText || fileName,
		attachment: {
			msgtype: msgtype,
			body: fileName,
			url: contentUri,
			info: {
				size: fileSize,
				mimetype: mimeType
			}
		}
	};

	return fetch(url, {
		method: 'POST',
		headers: {
			'Authorization': `Bearer ${matrixAccessToken}`,
			'Content-Type': 'application/json',
			'X-CSRF-TOKEN': csrfToken,
			...(isLocalDevelopment ? { 'X-WHITELIST-HEADER': csrfToken } : {})
		},
		credentials: 'include',
		body: JSON.stringify(messageBody)
	}).then(response => {
		console.log('📨 MATRIX: File message response status:', response.status);
		if (!response.ok) {
			throw new Error(`Failed to send file message: ${response.status}`);
		}
		return response.json();
	}).then(data => {
		console.log('✅ MATRIX: File message sent successfully:', data);
		return data;
	});
};
