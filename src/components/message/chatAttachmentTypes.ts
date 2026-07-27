import type { MatrixEncryptedFile } from '../../utils/matrixEncryptedAttachment';

export interface ChatAttachment {
	title: string;
	downloadUrl: string;
	type: 'image' | 'file';
	description?: string;
	mediaType?: string;
	size?: number;
	width?: number;
	height?: number;
	encryptedFile?: MatrixEncryptedFile;
	mediaCheckState?: 'blocked';
}

export interface ChatFile {
	id?: string;
	name: string;
	type: string;
}
