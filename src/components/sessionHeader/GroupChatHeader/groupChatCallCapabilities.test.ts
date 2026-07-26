import { describe, expect, it } from 'vitest';
import { groupChatCallCapabilities } from './groupChatCallCapabilities';

describe('groupChatCallCapabilities', () => {
	it('preserves audio and video controls for legacy chats without a modality', () => {
		expect(groupChatCallCapabilities()).toEqual({
			audio: true,
			video: true
		});
	});

	it('keeps both call controls available for internal chats whose backend modality defaults to TEXT', () => {
		expect(groupChatCallCapabilities('TEXT', true)).toEqual({
			audio: true,
			video: true
		});
	});

	it.each([
		['TEXT', false, false],
		['AUDIO', true, false],
		['VIDEO', true, true]
	] as const)(
		'%s modality exposes the intended controls',
		(modality, audio, video) => {
			expect(groupChatCallCapabilities(modality)).toEqual({
				audio,
				video
			});
		}
	);
});
