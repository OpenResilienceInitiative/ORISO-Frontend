import { describe, expect, it } from 'vitest';
import { groupChatCallCapabilities } from './groupChatCallCapabilities';

describe('groupChatCallCapabilities', () => {
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
