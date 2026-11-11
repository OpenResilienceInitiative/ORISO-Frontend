// @vitest-environment oriso-jsdom
/**
 * When an encrypted voice message loads (#1140). The player stands at once,
 * because the length comes from the file name. The bytes follow when the
 * message comes into view and has not been heard on this device, otherwise on
 * Play, so a long chat does not fetch and decrypt every old recording.
 */
import * as React from 'react';
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react';
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';

import { MessageAttachment } from './MessageAttachment';
import { NotificationsContext } from '../../globalState';
import { markVoiceMessageHeard } from '../../utils/heardVoiceMessages';

const isMediaContentScannerEnabled = vi.fn<() => boolean>();
const downloadScannedEncryptedMedia = vi.fn();
const fetchAuthenticatedMatrixMedia = vi.fn();
const decryptMatrixAttachment = vi.fn();
const addNotification = vi.fn();
let requestedMediaUrl: string | null = null;
let failAuthenticatedMedia: (() => void) | undefined;

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));
vi.mock('../../resources/scripts/endpoints', () => ({
	apiUrl: 'https://api.test'
}));
vi.mock('../../services/mediaContentScanner', () => ({
	isMediaContentScannerEnabled: () => isMediaContentScannerEnabled(),
	isMediaImageCheckEnabled: () => false,
	downloadScannedEncryptedMedia: (file: unknown) =>
		downloadScannedEncryptedMedia(file)
}));
vi.mock('../../utils/matrixEncryptedAttachment', () => ({
	decryptMatrixAttachment: (...args: unknown[]) =>
		decryptMatrixAttachment(...args)
}));
vi.mock('../../utils/matrixAuthenticatedMedia', () => ({
	fetchAuthenticatedMatrixMedia: (uri: string) =>
		fetchAuthenticatedMatrixMedia(uri),
	useAuthenticatedMatrixMediaUrl: (
		mxcUrl: string | null,
		_mimeType: string,
		onFailure?: () => void
	) => {
		requestedMediaUrl = mxcUrl;
		failAuthenticatedMedia = onFailure;
		return null;
	}
}));
vi.mock('../../api/apiPostError', () => ({
	apiPostError: () => Promise.resolve(),
	ERROR_LEVEL_WARN: 'WARN'
}));
vi.mock('../../globalState', () => {
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	const react = require('react');
	return {
		NotificationsContext: react.createContext({
			addNotification: () => {}
		}),
		NOTIFICATION_TYPE_ERROR: 'error'
	};
});

const MEDIA_URL = 'mxc://hs/voice-1';

const voiceAttachment = {
	title: 'voice-message-1-s14-ms14000.webm',
	downloadUrl: '',
	mxcUrl: MEDIA_URL,
	type: 'file',
	mediaType: 'audio/webm',
	size: 12,
	encryptedFile: {
		url: MEDIA_URL,
		key: {
			alg: 'A256CTR',
			ext: true,
			k: 'key-material',
			key_ops: ['encrypt', 'decrypt'],
			kty: 'oct'
		},
		iv: 'iv',
		hashes: { sha256: 'hash' },
		v: 'v2'
	}
} as never;

const voiceFile = {
	name: 'voice-message-1-s14-ms14000.webm',
	type: 'audio/webm'
} as never;

const renderVoice = (extraProps: Record<string, unknown> = {}) =>
	render(
		<NotificationsContext.Provider value={{ addNotification } as never}>
			<MessageAttachment
				attachment={voiceAttachment}
				file={voiceFile}
				hasRenderedMessage
				rid="room-1"
				// eslint-disable-next-line react/jsx-props-no-spreading
				{...extraProps}
			/>
		</NotificationsContext.Provider>
	);

let reportVisible: (() => void) | null;

const audioSource = () => document.querySelector('audio')?.getAttribute('src');

describe('MessageAttachment voice message loading', () => {
	beforeEach(() => {
		reportVisible = null;
		window.localStorage.clear();
		isMediaContentScannerEnabled.mockReturnValue(false);
		fetchAuthenticatedMatrixMedia.mockResolvedValue({
			arrayBuffer: () => Promise.resolve(new ArrayBuffer(4))
		});
		decryptMatrixAttachment.mockResolvedValue(new ArrayBuffer(4));
		if (!window.URL.createObjectURL) {
			window.URL.createObjectURL = vi.fn();
		}
		vi.spyOn(window.URL, 'createObjectURL').mockReturnValue('blob:voice');
		window.URL.revokeObjectURL = vi.fn();
		vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
		vi.stubGlobal(
			'IntersectionObserver',
			class {
				private readonly callback: IntersectionObserverCallback;

				constructor(callback: IntersectionObserverCallback) {
					this.callback = callback;
				}

				observe() {
					reportVisible = () =>
						this.callback(
							[{ isIntersecting: true } as never],
							this as never
						);
				}

				disconnect() {
					reportVisible = null;
				}
			}
		);
	});

	afterEach(() => {
		cleanup();
		vi.unstubAllGlobals();
		vi.clearAllMocks();
		vi.restoreAllMocks();
	});

	it('shows the player at once, with nothing fetched and no gate', () => {
		renderVoice();

		expect(
			screen.getByRole('button', { name: 'voicePlayer.play' })
		).toBeTruthy();
		expect(screen.queryByText('attachments.gate.decrypt')).toBeNull();
		expect(screen.getByText('0:00 / 0:14')).toBeTruthy();
		expect(fetchAuthenticatedMatrixMedia).not.toHaveBeenCalled();
	});

	it('loads an unheard message once it comes into view', async () => {
		renderVoice();

		act(() => reportVisible?.());

		await waitFor(() => expect(audioSource()).toBe('blob:voice'));
		expect(fetchAuthenticatedMatrixMedia).toHaveBeenCalledWith(MEDIA_URL);
		expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
	});

	it('waits for Play when the message was already heard here', async () => {
		markVoiceMessageHeard(MEDIA_URL);
		renderVoice();

		expect(reportVisible).toBeNull();
		expect(fetchAuthenticatedMatrixMedia).not.toHaveBeenCalled();

		fireEvent.click(
			screen.getByRole('button', { name: 'voicePlayer.play' })
		);

		await waitFor(() => expect(audioSource()).toBe('blob:voice'));
		await waitFor(() =>
			expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1)
		);
	});

	it('waits for Play on the sender’s own message', () => {
		renderVoice({ isOwnMessage: true });

		expect(reportVisible).toBeNull();
		expect(fetchAuthenticatedMatrixMedia).not.toHaveBeenCalled();
	});

	it('says the player is loading while Play waits for the bytes', async () => {
		fetchAuthenticatedMatrixMedia.mockReturnValue(new Promise(() => {}));
		markVoiceMessageHeard(MEDIA_URL);
		renderVoice();

		fireEvent.click(
			screen.getByRole('button', { name: 'voicePlayer.play' })
		);

		const button = await screen.findByRole('button', {
			name: 'voicePlayer.loading'
		});
		expect(button.getAttribute('aria-busy')).toBe('true');
	});

	it('remembers a message once it has played', async () => {
		const { unmount } = renderVoice();
		act(() => reportVisible?.());
		await waitFor(() => expect(audioSource()).toBe('blob:voice'));

		fireEvent.play(document.querySelector('audio') as HTMLAudioElement);
		unmount();
		renderVoice();

		expect(reportVisible).toBeNull();
	});

	it('loads in view when the file name carries no length', () => {
		markVoiceMessageHeard(MEDIA_URL);
		renderVoice({ file: { name: 'interview.mp3', type: 'audio/mpeg' } });

		expect(reportVisible).not.toBeNull();
	});

	it('still asks the scanner, and only once wanted', async () => {
		isMediaContentScannerEnabled.mockReturnValue(true);
		downloadScannedEncryptedMedia.mockResolvedValue({
			verdict: 'blocked'
		});
		renderVoice();

		expect(downloadScannedEncryptedMedia).not.toHaveBeenCalled();
		act(() => reportVisible?.());

		await screen.findByText('attachments.mediaCheck.blocked');
		expect(document.querySelector('audio')).toBeNull();
		expect(fetchAuthenticatedMatrixMedia).not.toHaveBeenCalled();
	});

	it('shows the failure when decrypting the message fails', async () => {
		decryptMatrixAttachment.mockRejectedValue(new Error('bad key'));
		renderVoice();

		act(() => reportVisible?.());

		await screen.findByText('e2ee.attachment.decryption_error');
		expect(document.querySelector('audio')).toBeNull();
		// It says so in place. Scrolling past many must not stack notifications.
		expect(addNotification).not.toHaveBeenCalled();
	});

	it('frees the decrypted bytes when the message leaves', async () => {
		const { unmount } = renderVoice();

		act(() => reportVisible?.());
		await waitFor(() => expect(audioSource()).toBe('blob:voice'));
		expect(window.URL.revokeObjectURL).not.toHaveBeenCalled();

		unmount();

		expect(window.URL.revokeObjectURL).toHaveBeenCalledWith('blob:voice');
	});

	it('reads what was heard once, not on every render', () => {
		const read = vi.spyOn(Storage.prototype, 'getItem');
		const { rerender } = renderVoice();
		const reads = read.mock.calls.length;

		rerender(
			<NotificationsContext.Provider value={{ addNotification } as never}>
				<MessageAttachment
					attachment={voiceAttachment}
					file={voiceFile}
					hasRenderedMessage
					rid="room-1"
				/>
			</NotificationsContext.Provider>
		);

		expect(read.mock.calls.length).toBe(reads);
	});

	it('offers a retry instead of loading forever when plain media fails', () => {
		const plainAttachment = {
			...(voiceAttachment as object),
			encryptedFile: undefined
		} as never;
		renderVoice({ attachment: plainAttachment });

		act(() => reportVisible?.());
		expect(requestedMediaUrl).toBe(MEDIA_URL);

		act(() => failAuthenticatedMedia?.());

		expect(screen.getByText('attachments.gate.loadFailed')).toBeTruthy();
		expect(document.querySelector('audio')).toBeNull();
		expect(requestedMediaUrl).toBeNull();

		fireEvent.click(
			screen.getByRole('button', { name: 'attachments.gate.retry' })
		);

		expect(requestedMediaUrl).toBe(MEDIA_URL);
		expect(document.querySelector('audio')).not.toBeNull();
	});
});
