import { describe, expect, it } from 'vitest';
import { groupCardParticipants } from './groupCardMemberParticipants';

describe('group-card human participants (#1806)', () => {
	it('counts joined humans once, with actual identities and display names', () => {
		const member = (
			userId: string,
			name = 'Same name',
			membership = 'join'
		) => ({ userId, name, membership });
		const members = groupCardParticipants([
			member('@bart:example.org'),
			member('@homer:example.org'),
			member('@bart:example.org'),
			member('@system:example.org'),
			member('@group-chat-system-40:example.org'),
			member('@agency-40-service:example.org'),
			member('@old:caritas.local'),
			member('@left:example.org', 'Left', 'leave'),
			member('@invited:example.org', 'Invited', 'invite')
		]);
		expect(members.map((person) => person.userId)).toEqual([
			'@bart:example.org',
			'@homer:example.org'
		]);
		expect(members.map((person) => person.displayName)).toEqual([
			'Same name',
			'Same name'
		]);
	});
});
