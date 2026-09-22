import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	buildGroupChatInviteLink,
	buildGroupChatInviteLinkForOrigin,
	currentHostGroupChatInviteLink
} from './groupChatInviteLink';

describe('buildGroupChatInviteLink', () => {
	it('uses the stable numeric Series id as gcid', () => {
		expect(
			buildGroupChatInviteLink('https://app.oriso-dev.site/login', 1013)
		).toBe('https://app.oriso-dev.site/login?gcid=1013');
	});
});

describe('invite link for the current host (#1499)', () => {
	afterEach(() => vi.unstubAllGlobals());

	it('builds the link on the origin it is given', () => {
		expect(
			buildGroupChatInviteLinkForOrigin('https://dev.oriso.org', 7)
		).toBe('https://dev.oriso.org/login?gcid=7');
	});

	it('tolerates a trailing slash and keeps a port', () => {
		expect(
			buildGroupChatInviteLinkForOrigin('http://localhost:9001/', 7)
		).toBe('http://localhost:9001/login?gcid=7');
	});

	it('follows the host the app runs on, never the production host', () => {
		vi.stubGlobal('window', {
			location: { origin: 'https://predev.oriso.org' }
		});
		const link = currentHostGroupChatInviteLink(4711);
		expect(link).toBe('https://predev.oriso.org/login?gcid=4711');
		expect(link).not.toContain('app.oriso.org');
	});
});
