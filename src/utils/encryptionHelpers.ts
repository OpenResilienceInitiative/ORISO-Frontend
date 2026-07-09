import { decode, encode } from 'hi-base32';

type OwnedUint8Array = Uint8Array;

// encoding helper
const ENCRYPTION_VERSION_1 = 'v1-0';
const ENCRYPTION_VERSION_2 = 'v2-0';

export const ENCRYPTION_VERSION_ACTIVE = ENCRYPTION_VERSION_2;
export const VERSION_SEPERATOR = '..';
export const VECTOR_LENGTH = 16;
export const KEY_ID_LENGTH = 12;
export const MAX_PREFIX_LENGTH = 10;

// Size in bytes for apache tika file type detection.
// ATTENTION! The bigger this value is, the bigger the attached signature is. For files uploaded smaller than this size the whole file is
// attached unencrypted in the signature!
export const SIGNATURE_LENGTH = 64;

export const encodeUsername = (username) => {
	return 'enc.' + encode(username).replace(/=/g, '.');
};

export const decodeUsername = (username: string = '') => {
	const isEncoded = username.split('.') && username.split('.')[0] === 'enc';
	return isEncoded
		? decode(username.split('.')[1].toUpperCase() + '=')
		: username;
};

export function typedArrayToBuffer(array: Uint8Array): ArrayBuffer {
	const output = new Uint8Array(array.byteLength);
	output.set(array, 0);
	return output.buffer;
}

export function toOwnedUint8Array(
	data: ArrayBufferLike | ArrayLike<number>
): OwnedUint8Array {
	if (typeof ArrayBuffer !== 'undefined' && data instanceof ArrayBuffer) {
		return new Uint8Array(data.slice(0));
	}

	if (
		typeof SharedArrayBuffer !== 'undefined' &&
		data instanceof SharedArrayBuffer
	) {
		return new Uint8Array(typedArrayToBuffer(new Uint8Array(data)));
	}

	const arrayLike = data as ArrayLike<number>;
	const output = new Uint8Array(arrayLike.length);
	output.set(arrayLike, 0);
	return output;
}

function normalizeBufferSource(data: BufferSource | Uint8Array): BufferSource {
	// WebCrypto typings require ArrayBuffer-backed views (not SharedArrayBuffer).
	// Normalizing via copy keeps behavior the same but satisfies TS.
	if (data instanceof Uint8Array) return typedArrayToBuffer(data);
	return data;
}

export async function encryptAES(
	vector,
	key: CryptoKey,
	data: BufferSource | Uint8Array
) {
	return crypto.subtle.encrypt(
		{ name: 'AES-CBC', iv: vector },
		key,
		normalizeBufferSource(data)
	);
}

export async function decryptAES(
	vector,
	key: CryptoKey,
	data: BufferSource | Uint8Array
) {
	return crypto.subtle.decrypt(
		{ name: 'AES-CBC', iv: vector },
		key,
		normalizeBufferSource(data)
	);
}

export function toHexString(bytes: Uint8Array): string {
	return bytes.reduce(
		(str, byte) => str + byte.toString(16).padStart(2, '0'),
		''
	);
}

export function fromHexString(hexString: string): Uint8Array {
	return Uint8Array.from(
		hexString.match(/.{1,2}/g).map((byte) => parseInt(byte, 16))
	);
}

export function joinVectorAndEcryptedData(
	vector: Uint8Array,
	encryptedData: ArrayLike<number> | ArrayBufferLike
): Uint8Array {
	const cipherText = toOwnedUint8Array(encryptedData);
	const output = new Uint8Array(vector.length + cipherText.length);
	output.set(vector, 0);
	output.set(cipherText, vector.length);
	return output;
}

export function splitVectorAndEcryptedData(
	cipherText: Uint8Array
): [OwnedUint8Array, OwnedUint8Array] {
	const vector = toOwnedUint8Array(cipherText.slice(0, VECTOR_LENGTH));
	const encryptedData = toOwnedUint8Array(cipherText.slice(VECTOR_LENGTH));

	return [vector, encryptedData];
}

export class MissingKeyError extends Error {}
export class WrongKeyError extends Error {}
export class EncryptValidationError extends Error {}
export class EncPrefixLengthError extends Error {}

export const encryptBuffer = async (
	buffer,
	key,
	keyID,
	encPrefix: string = ''
) => {
	const vector = crypto.getRandomValues(new Uint8Array(VECTOR_LENGTH));
	const result = await encryptAES(vector, key, buffer);
	return (
		encPrefix +
		keyID +
		toHexString(joinVectorAndEcryptedData(vector, result)) +
		`${VERSION_SEPERATOR}${ENCRYPTION_VERSION_ACTIVE}`
	);
};

export const decryptAttachment = async (
	encryptedAttachment: string,
	name: string,
	roomKeyID,
	groupKey
): Promise<File> => {
	// error if key is missing
	if (!roomKeyID || !groupKey) {
		throw new MissingKeyError('e2ee.message.encryption.text');
	}

	// keyId
	const keyID = encryptedAttachment.slice(0, KEY_ID_LENGTH);
	if (keyID !== roomKeyID) {
		throw new WrongKeyError('e2ee.message.encryption.error');
	}

	const encAttachmentWithVersion = encryptedAttachment.slice(KEY_ID_LENGTH);
	const [encAttachment, version] =
		encAttachmentWithVersion.split(VERSION_SEPERATOR);

	let msgArray;
	try {
		switch (version) {
			case ENCRYPTION_VERSION_2:
				msgArray = fromHexString(encAttachment);
				break;
			case ENCRYPTION_VERSION_1:
			default:
				msgArray = Uint8Array.from(
					Object.values(JSON.parse(atob(encAttachment)))
				);
				break;
		}

		const [vector, cipherText] = splitVectorAndEcryptedData(msgArray);
		const result = await decryptAES(vector, groupKey, cipherText);
		return new File([result], name);
	} catch (error) {
		// console.error('Error decrypting message: ', error, encAttachment);
		throw error;
	}
};
export const getSignature = async (attachment: File): Promise<ArrayBuffer> => {
	const buffer = await attachment.arrayBuffer();

	// Get the required signature for apache tika
	let signature = buffer.slice(0, SIGNATURE_LENGTH);

	// If the signature is smaller than the required size fill the signature with 0
	// Maybe this could be optimized in any way to prevent requirement for filling
	if (signature.byteLength < SIGNATURE_LENGTH) {
		const sig = new Uint8Array(signature);
		const output = new Uint8Array(SIGNATURE_LENGTH);
		output.set(sig, 0);
		output.fill(0, sig.length, SIGNATURE_LENGTH);
		signature = output.buffer;
	}

	return signature;
};

export const encryptAttachment = async (
	attachment: File,
	keyID,
	key
): Promise<File> => {
	if (!keyID) {
		return attachment;
	}

	const encoder = new TextEncoder();
	const buffer = await attachment.arrayBuffer();

	// Encrypt the attachment
	const encryptedAttachment = await encryptBuffer(buffer, key, keyID);

	// Create buffer from encrypted attachment
	const output = new Uint8Array(encoder.encode(encryptedAttachment).length);
	output.set(encoder.encode(encryptedAttachment), 0);

	// Create file
	const encryptedAttachmentFile = new File(
		[output.buffer],
		attachment.name,
		attachment
	);

	// Decrypt attachment after encrypt to check if the result matches
	const decryptedAttachment = await decryptAttachment(
		await encryptedAttachmentFile.text(),
		attachment.name,
		keyID,
		key
	);

	const orgAttachment = await attachment.text();
	const decAttachment = await decryptedAttachment.text();
	if (orgAttachment !== decAttachment) {
		throw new EncryptValidationError('Error validating encrypted text.');
	}

	return encryptedAttachmentFile;
};

/*
Helper Messaging
 */
export const encryptText = async (
	message,
	keyID,
	key,
	encPrefix: string = ''
) => {
	if (!keyID) {
		return message;
	}
	if (encPrefix.length > MAX_PREFIX_LENGTH) {
		throw new EncPrefixLengthError('Encryption prefix too long!');
	}

	const encryptedText = await encryptBuffer(
		new TextEncoder().encode(message),
		key,
		keyID,
		encPrefix
	);

	// Decrypt text after encrypt to check it the result matches
	const decryptedText = await decryptText(
		encryptedText,
		keyID,
		key,
		true,
		true,
		encPrefix
	);
	if (decryptedText !== message) {
		throw new EncryptValidationError('Error validating encrypted text.');
	}

	return encryptedText;
};

export const decryptText = async (
	message,
	roomKeyID,
	groupKey,
	roomEncrypted,
	messageEncrypted,
	encPrefix: string = ''
): Promise<string> => {
	if (
		!roomEncrypted ||
		!messageEncrypted ||
		(encPrefix && message.indexOf(encPrefix) !== 0)
	) {
		return message;
	}

	if (!roomKeyID || !groupKey) {
		throw new MissingKeyError('e2ee.message.encryption.text');
	}

	const keyID = message.slice(
		encPrefix.length,
		KEY_ID_LENGTH + encPrefix.length
	);
	if (keyID !== roomKeyID) {
		throw new WrongKeyError('e2ee.message.encryption.error');
	}

	const encMessageWithVersion = message.slice(
		KEY_ID_LENGTH + encPrefix.length
	);
	const [encMessage, version] =
		encMessageWithVersion.split(VERSION_SEPERATOR);
	let msgArray;
	try {
		switch (version) {
			case ENCRYPTION_VERSION_2:
				msgArray = fromHexString(encMessage);
				break;
			case ENCRYPTION_VERSION_1:
			default:
				msgArray = Uint8Array.from(
					Object.values(JSON.parse(atob(encMessage)))
				);
				break;
		}

		const [vector, cipherText] = splitVectorAndEcryptedData(msgArray);
		const result = await decryptAES(vector, groupKey, cipherText);
		return new TextDecoder('UTF-8').decode(result);
	} catch (error) {
		// console.error('Error decrypting message: ', error, encMessage);
		throw error;
	}
};
