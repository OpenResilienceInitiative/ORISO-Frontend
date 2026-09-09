import { describe, expect, it } from 'vitest';
import { groupChatModalityLabelKey } from './groupChatModalityLabel';

describe('groupChatModalityLabelKey', () => {
	it.each([
		['TEXT', 'groupChat.create.modality.options.text'],
		['AUDIO', 'groupChat.create.modality.options.audio'],
		['VIDEO', 'groupChat.create.modality.options.video']
	] as const)('maps %s to its existing translation', (modality, expected) => {
		expect(groupChatModalityLabelKey(modality)).toBe(expected);
	});
});
