export interface MatrixEncryptedFile {
	url: string;
	key: JsonWebKey & {
		alg: string;
		ext: boolean;
		k: string;
		key_ops: string[];
		kty: string;
	};
	iv: string;
	hashes: {
		sha256: string;
	};
	v: 'v2';
}

interface MatrixEncryptedAttachment {
	encryptedBlob: Blob;
	file: MatrixEncryptedFile;
}

const AES_CTR_LENGTH = 64;
const MATRIX_ENCRYPTED_ATTACHMENT_VERSION = 'v2';
const MATRIX_ATTACHMENT_KEY_ALGORITHM = 'A256CTR';

const toBase64 = (bytes: Uint8Array): string => {
	let binary = '';
	bytes.forEach((byte) => {
		binary += String.fromCharCode(byte);
	});
	return btoa(binary);
};

const toUnpaddedBase64 = (bytes: Uint8Array): string =>
	toBase64(bytes).replace(/=+$/, '');

const fromBase64 = (value: string): Uint8Array => {
	const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
	const padded = normalized.padEnd(
		normalized.length + ((4 - (normalized.length % 4)) % 4),
		'='
	);
	const binary = atob(padded);
	const output = new Uint8Array(binary.length);
	for (let index = 0; index < binary.length; index += 1) {
		output[index] = binary.charCodeAt(index);
	}
	return output;
};

const timingSafeEqual = (left: string, right: string): boolean => {
	if (left.length !== right.length) {
		return false;
	}
	let mismatch = 0;
	for (let index = 0; index < left.length; index += 1) {
		mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
	}
	return mismatch === 0;
};

const buildAesCtrParams = (iv: Uint8Array): AesCtrParams => ({
	name: 'AES-CTR',
	counter: iv,
	length: AES_CTR_LENGTH
});

const sha256UnpaddedBase64 = async (buffer: ArrayBuffer): Promise<string> => {
	const hash = await crypto.subtle.digest('SHA-256', buffer);
	return toUnpaddedBase64(new Uint8Array(hash));
};

export const encryptMatrixAttachment = async (
	attachment: File
): Promise<MatrixEncryptedAttachment> => {
	const key = await crypto.subtle.generateKey(
		{
			name: 'AES-CTR',
			length: 256
		},
		true,
		['encrypt', 'decrypt']
	);
	const iv = crypto.getRandomValues(new Uint8Array(16));
	const plaintext = await attachment.arrayBuffer();
	const ciphertext = await crypto.subtle.encrypt(
		buildAesCtrParams(iv),
		key,
		plaintext
	);
	const jwk = (await crypto.subtle.exportKey('jwk', key)) as JsonWebKey & {
		k: string;
	};

	return {
		encryptedBlob: new Blob([ciphertext], {
			type: 'application/octet-stream'
		}),
		file: {
			url: '',
			key: {
				...jwk,
				alg: MATRIX_ATTACHMENT_KEY_ALGORITHM,
				ext: true,
				key_ops: ['encrypt', 'decrypt'],
				kty: 'oct'
			},
			iv: toUnpaddedBase64(iv),
			hashes: {
				sha256: await sha256UnpaddedBase64(ciphertext)
			},
			v: MATRIX_ENCRYPTED_ATTACHMENT_VERSION
		}
	};
};

export const decryptMatrixAttachment = async (
	ciphertext: ArrayBuffer,
	encryptedFile: MatrixEncryptedFile
): Promise<ArrayBuffer> => {
	const actualHash = await sha256UnpaddedBase64(ciphertext);
	if (!timingSafeEqual(actualHash, encryptedFile.hashes.sha256)) {
		throw new Error('Matrix encrypted attachment hash mismatch');
	}

	const keyData = fromBase64(encryptedFile.key.k);
	const iv = fromBase64(encryptedFile.iv);
	const key = await crypto.subtle.importKey(
		'raw',
		keyData,
		{
			name: 'AES-CTR'
		},
		false,
		['decrypt']
	);

	return crypto.subtle.decrypt(buildAesCtrParams(iv), key, ciphertext);
};
