import { describe, expect, it } from 'vitest';
import { buildGroupChatInviteLink } from './groupChatInviteLink';

describe('buildGroupChatInviteLink', () => {
	it('uses the stable numeric Series id as gcid', () => {
		expect(
			buildGroupChatInviteLink('https://app.oriso-dev.site/login', 1013)
		).toBe('https://app.oriso-dev.site/login?gcid=1013');
	});
});
