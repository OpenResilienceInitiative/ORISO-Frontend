import { describe, expect, it } from 'vitest';
import { directAvatarChoice, memberAvatarChoice } from './sessionAvatarChoice';

const members = [
	{ _id: '@assigned:example.org', avatarKind: 'ICON', avatarId: 'fox' },
	{ _id: '@author:example.org', avatarKind: 'ICON', avatarId: 'owl' },
	{ _id: '@asker:example.org', avatarId: 'magpie' }
];

describe('group author avatar identity', () => {
	it('uses the author instead of the assigned counsellor', () => {
		expect(memberAvatarChoice('@author:example.org', members)).toEqual({
			kind: 'motif',
			file: 'owl.svg'
		});
	});
	it('never matches a local part on another Matrix server', () => {
		expect(memberAvatarChoice('@author:other.org', members)).toBeNull();
	});
	it('keeps an advice seeker animal on the derived palette', () => {
		expect(memberAvatarChoice('@asker:example.org', members)).toEqual({
			kind: 'animal',
			file: 'magpie.svg'
		});
	});
	it('uses the derived default for absent or cleared metadata', () => {
		expect(memberAvatarChoice('@missing:example.org', members)).toBeNull();
		expect(
			memberAvatarChoice('@clear:example.org', [
				{ _id: '@clear:example.org', avatarKind: null, avatarId: null }
			])
		).toBeNull();
	});
});

describe('direct recipient avatar identity', () => {
	const session = {
		item: {
			askerMatrixUserId: '@asker:example.org',
			consultantMatrixUserId: '@assigned:example.org'
		},
		user: { avatarId: 'magpie' },
		consultant: { avatarKind: 'ICON', avatarId: 'owl' }
	};
	it('uses only the assigned consultant author metadata', () => {
		expect(directAvatarChoice('@assigned:example.org', session)).toEqual({
			kind: 'motif',
			file: 'owl.svg'
		});
	});
	it('uses the actual asker author choice', () => {
		expect(directAvatarChoice('@asker:example.org', session)).toEqual({
			kind: 'animal',
			file: 'magpie.svg'
		});
	});
	it('does not borrow the current consultant choice for a historical counsellor', () => {
		expect(directAvatarChoice('@previous:example.org', session)).toBeNull();
		expect(directAvatarChoice('@assigned:other.org', session)).toBeNull();
	});
});
