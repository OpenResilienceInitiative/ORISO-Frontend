import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	buildGroupChatInviteLink,
	buildGroupChatInviteLinkForOrigin,
	currentHostGroupChatInviteLink,
	parseGroupChatInviteId
} from './groupChatInviteLink';

describe('buildGroupChatInviteLink', () => {
	it('uses the stable numeric Series id as gcid', () => {
		expect(
			buildGroupChatInviteLink('https://app.oriso-dev.site/login', 1013)
		).toBe('https://app.oriso-dev.site/login?gcid=1013');
	});

	/* A newcomer who follows the link cannot see the group before logging in,
	   so the link has to name the group's Beratungsstelle itself. Without it
	   registration asks for topic, postcode and agency, and the group's own
	   agency is often not in that search (gcid=19 on dev: "Keine
	   Online-Beratungsstelle gefunden"). */
	it("names the group's agency so registration can preselect it", () => {
		expect(
			buildGroupChatInviteLink('https://dev.oriso.org/login', 19, 19)
		).toBe('https://dev.oriso.org/login?gcid=19&aid=19');
	});

	it.each([undefined, null])(
		'leaves the agency out when it is not known (%s)',
		(agencyId) => {
			expect(
				buildGroupChatInviteLink(
					'https://dev.oriso.org/login',
					19,
					agencyId
				)
			).toBe('https://dev.oriso.org/login?gcid=19');
		}
	);
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

	it('carries the agency on the current host as well', () => {
		expect(
			buildGroupChatInviteLinkForOrigin('https://dev.oriso.org', 19, 19)
		).toBe('https://dev.oriso.org/login?gcid=19&aid=19');
	});
});

/* ORISO-UserService#1237: the group number alone is guessable, so anybody could
   join any self-help group. The link now also carries the group's secret invite
   token. It rides inside `gcid` so every place that already passes `gcid` along
   (login, registration, redirect) keeps working unchanged. */
describe('invite token in the link (#1237)', () => {
	it('puts the token next to the group number in gcid', () => {
		expect(
			buildGroupChatInviteLink(
				'https://dev.oriso.org/login',
				19,
				19,
				'Ab3_x-Yz'
			)
		).toBe('https://dev.oriso.org/login?gcid=19.Ab3_x-Yz&aid=19');
	});

	it('reads the group number and the token back out of gcid', () => {
		expect(parseGroupChatInviteId('19.Ab3_x-Yz')).toEqual({
			seriesId: '19',
			inviteToken: 'Ab3_x-Yz'
		});
	});

	it('still reads an old link that only has the number', () => {
		expect(parseGroupChatInviteId(' 19 ')).toEqual({ seriesId: '19' });
	});

	it.each([null, undefined, '', 'abc', '19.', '19.to ken', '.tok'])(
		'rejects what is not an invite id (%s)',
		(gcid) => {
			expect(parseGroupChatInviteId(gcid)).toBeNull();
		}
	);
});
