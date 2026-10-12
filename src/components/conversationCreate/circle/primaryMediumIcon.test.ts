import { describe, expect, it } from 'vitest';
import { resolvePrimaryMediumIcon } from './primaryMediumIcon';

describe('resolvePrimaryMediumIcon', () => {
	it.each([
		[undefined, false, 'generic-outline'],
		['TEXT', false, 'chat-outline'],
		['TEXT', true, 'chat-filled'],
		['AUDIO', false, 'audio-outline'],
		['AUDIO', true, 'audio-filled'],
		['VIDEO', false, 'video-outline'],
		['VIDEO', true, 'video-filled']
	] as const)(
		'maps %s with filled=%s to %s',
		(modality, filled, expected) => {
			expect(resolvePrimaryMediumIcon(modality, filled)).toBe(expected);
		}
	);
});
