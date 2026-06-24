const getMatrixMediaDownloadPath = (contentUrl: string): string => {
	if (!contentUrl.startsWith('mxc://')) {
		return contentUrl;
	}

	const [serverName, mediaId] = contentUrl.substring(6).split('/');
	return `/_matrix/media/r0/download/${serverName}/${mediaId}`;
};

export const formatMatrixTimelineEvent = (
	event: any,
	matrixRoom: any,
	encryptedFallbackText: string
) => {
	const eventType = event?.getType?.();
	if (eventType !== 'm.room.message' && eventType !== 'm.room.encrypted') {
		return null;
	}

	const content = event?.getClearContent?.() || event?.getContent?.() || {};
	const senderId = event?.getSender?.() || '';
	const senderUsername =
		senderId?.split(':')[0]?.substring(1) || 'unknown';
	const senderMember = matrixRoom?.getMember?.(senderId);
	const senderDisplayName =
		senderMember?.name || senderMember?.rawDisplayName || senderUsername;
	const isUndecryptedEvent =
		eventType === 'm.room.encrypted' && !content?.msgtype;
	const textMessageContent =
		content?.msgtype === 'm.text'
			? content?.formatted_body || content?.body || ''
			: isUndecryptedEvent
				? encryptedFallbackText
				: content?.body || '';
	const baseMessage: any = {
		_id: event?.getId?.() || `${senderId}-${event?.getTs?.() || Date.now()}`,
		msg: textMessageContent,
		ts: new Date(event?.getTs?.() || Date.now()),
		u: {
			_id: senderId,
			username: senderUsername,
			name: senderDisplayName
		}
	};

	const mediaUrl = content?.file?.url || content?.url;
	if (mediaUrl && content?.msgtype !== 'm.text') {
		const downloadPath = getMatrixMediaDownloadPath(mediaUrl);
		const isEncryptedMedia = Boolean(content?.file?.url);
		const attachment: any = {
			title: content.body,
			title_link: downloadPath,
			type: content.msgtype === 'm.image' ? 'image' : 'file',
			image_type: content.info?.mimetype,
			image_size: content.info?.size
		};
		if (content.msgtype === 'm.image' && !isEncryptedMedia) {
			attachment.image_url = downloadPath;
		}
		if (isEncryptedMedia) {
			attachment.matrix_encrypted_file = content.file;
		}
		baseMessage.file = {
			name: content.body,
			type: content.info?.mimetype || 'application/octet-stream'
		};
		if (isEncryptedMedia) {
			baseMessage.t = 'matrix-e2e-file';
		}
		baseMessage.attachments = [attachment];
	}

	return baseMessage;
};
