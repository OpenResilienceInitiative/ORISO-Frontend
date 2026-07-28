export const ATTACHMENT_TYPE_FOR_KEY = {
	PNG: 'image/png',
	JPEG: 'image/jpeg',
	PDF: 'application/pdf',
	DOCX: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
	XLSX: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
};

export const ATTACHMENT_TRANSLATE_FOR_TYPE = {
	'image/png': 'attachments.type.label.png',
	'image/jpeg': 'attachments.type.label.jpeg',
	'application/pdf': 'attachments.type.label.pdf',
	'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
		'attachments.type.label.docx',
	'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
		'attachments.type.label.xlsx'
};

export const isPNGAttachment = (type: string) =>
	type === ATTACHMENT_TYPE_FOR_KEY.PNG;
export const isJPEGAttachment = (type: string) =>
	type === ATTACHMENT_TYPE_FOR_KEY.JPEG;
export const isPDFAttachment = (type: string) =>
	type === ATTACHMENT_TYPE_FOR_KEY.PDF;
export const isDOCXAttachment = (type: string) =>
	type === ATTACHMENT_TYPE_FOR_KEY.DOCX;
export const isXLSXAttachment = (type: string) =>
	type === ATTACHMENT_TYPE_FOR_KEY.XLSX;

export const ATTACHMENT_MAX_SIZE_IN_MB = 10;

const SUPPORTED_ATTACHMENT_MIME_TYPES = new Set([
	...Object.values(ATTACHMENT_TYPE_FOR_KEY),
	'audio/webm',
	'audio/ogg',
	'audio/mpeg'
]);

const SUPPORTED_ATTACHMENT_EXTENSIONS = new Set([
	'.png',
	'.jpg',
	'.jpeg',
	'.pdf',
	'.docx',
	'.xlsx',
	'.webm',
	'.ogg',
	'.mp3'
]);

/**
 * The input `accept` attribute only filters the native picker. Files from
 * drag/drop, paste, tests or browsers with an empty MIME type still reach the
 * change handler, so enforce the same allow-list in application code.
 */
export const isSupportedAttachment = (
	attachment: Pick<File, 'name' | 'type'>
): boolean => {
	const type = (attachment.type || '').toLowerCase();
	if (type && SUPPORTED_ATTACHMENT_MIME_TYPES.has(type)) {
		return true;
	}

	// Some operating systems provide no MIME type for office/PDF files. Only
	// use the extension fallback when the type is absent; a conflicting MIME
	// type must not bypass the allow-list through a trusted-looking filename.
	if (type) {
		return false;
	}

	const name = (attachment.name || '').toLowerCase();
	return [...SUPPORTED_ATTACHMENT_EXTENSIONS].some((extension) =>
		name.endsWith(extension)
	);
};

export const getAttachmentSizeMBForKB = (attachmentSizeKB: number) => {
	return parseInt(Math.ceil(attachmentSizeKB / Math.pow(1000, 2)).toFixed(2));
};
