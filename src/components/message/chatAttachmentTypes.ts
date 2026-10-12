import type { MatrixEncryptedFile } from '../../utils/matrixEncryptedAttachment';

export interface ChatAttachment {
	title: string;
	/**
	 * A URL the browser can use directly (content scanner, or an already
	 * absolute non-Matrix URL). Empty for homeserver media — see `mxcUrl`.
	 */
	downloadUrl: string;
	/**
	 * `mxc://` URI of homeserver media. Since authenticated media (#1487) this
	 * cannot be turned into a plain `src`/`href`: the bytes must be fetched
	 * with the Matrix access token and handed on as an object URL
	 * (`src/utils/matrixAuthenticatedMedia.ts`).
	 */
	mxcUrl?: string;
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
