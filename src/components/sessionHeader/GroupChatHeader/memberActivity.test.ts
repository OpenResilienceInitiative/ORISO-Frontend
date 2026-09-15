import { describe, expect, it } from 'vitest';
import {
	AVATAR_STACK_METRICS,
	computeVisibleAvatarCount,
	getLastActivityByUserId,
	sortMembersByActivity
} from './memberActivity';

const event = (sender: string, ts: number) => ({
	getSender: () => sender,
	getTs: () => ts
});
const room = (events: ReturnType<typeof event>[]) => ({
	getLiveTimeline: () => ({ getEvents: () => events })
});
const member = (userId: string, name: string, joinTs?: number) => ({
	userId,
	name,
	events: joinTs ? { member: { getTs: () => joinTs } } : undefined
});

describe('getLastActivityByUserId', () => {
	it('keeps the latest timestamp per sender', () => {
		const activity = getLastActivityByUserId(
			room([event('@a:x', 10), event('@b:x', 30), event('@a:x', 20)])
		);
		expect(activity.get('@a:x')).toBe(20);
		expect(activity.get('@b:x')).toBe(30);
	});

	it('tolerates rooms without a timeline and events without sender', () => {
		expect(getLastActivityByUserId(undefined).size).toBe(0);
		expect(getLastActivityByUserId({}).size).toBe(0);
		const activity = getLastActivityByUserId(
			room([{ getSender: () => undefined, getTs: () => 5 }])
		);
		expect(activity.size).toBe(0);
	});
});

describe('sortMembersByActivity (Job 1: latest user first)', () => {
	it('orders members by their latest event, newest first', () => {
		const members = [
			member('@quiet:x', 'Quiet'),
			member('@b:x', 'Bea'),
			member('@a:x', 'Al')
		];
		const activity = new Map([
			['@a:x', 100],
			['@b:x', 300]
		]);
		expect(
			sortMembersByActivity(members, activity).map((m) => m.userId)
		).toEqual(['@b:x', '@a:x', '@quiet:x']);
	});

	it('moves the quietest member to the front once they write', () => {
		const members = [
			member('@a:x', 'Al'),
			member('@b:x', 'Bea'),
			member('@c:x', 'Cy')
		];
		const before = new Map([
			['@a:x', 300],
			['@b:x', 200],
			['@c:x', 100]
		]);
		expect(sortMembersByActivity(members, before)[0].userId).toBe('@a:x');
		const after = new Map(before);
		after.set('@c:x', 400);
		expect(sortMembersByActivity(members, after)[0].userId).toBe('@c:x');
	});

	it('falls back to join time, then a stable name order', () => {
		const members = [
			member('@z:x', 'Zed', 50),
			member('@y:x', 'Yan', 70),
			member('@n2:x', 'Nora'),
			member('@n1:x', 'Anna')
		];
		expect(
			sortMembersByActivity(members, new Map()).map((m) => m.name)
		).toEqual(['Yan', 'Zed', 'Anna', 'Nora']);
	});

	it('does not mutate the input', () => {
		const members = [member('@a:x', 'Al'), member('@b:x', 'Bea')];
		sortMembersByActivity(members, new Map([['@b:x', 1]]));
		expect(members[0].userId).toBe('@a:x');
	});
});

describe('computeVisibleAvatarCount (Job 2: overlap with +N fallback)', () => {
	const { avatarSize, overlap, chipWidth } = AVATAR_STACK_METRICS;
	const step = avatarSize - overlap;

	it('applies the Figma cap when the width is unknown', () => {
		expect(computeVisibleAvatarCount(2, null)).toBe(2);
		expect(computeVisibleAvatarCount(27, undefined)).toBe(4);
		expect(computeVisibleAvatarCount(0, 500)).toBe(0);
	});

	it('treats a measured zero width as no avatar capacity', () => {
		expect(computeVisibleAvatarCount(5, 0)).toBe(0);
		expect(computeVisibleAvatarCount(5, -10)).toBe(0);
	});

	it('shows every member when they all fit', () => {
		expect(computeVisibleAvatarCount(3, 500)).toBe(3);
	});

	it('never exceeds the cap even with plenty of room: 27 members → 4 + "+23"', () => {
		expect(computeVisibleAvatarCount(27, 5000)).toBe(4);
	});

	it('collapses the tail into the chip as the width shrinks', () => {
		// 4 avatars + chip need avatarSize + 3*step + chipWidth - overlap.
		const fourPlusChip = avatarSize + 3 * step + chipWidth - overlap;
		expect(computeVisibleAvatarCount(27, fourPlusChip)).toBe(4);
		expect(computeVisibleAvatarCount(27, fourPlusChip - 1)).toBe(3);
		const onePlusChip = avatarSize + chipWidth - overlap;
		expect(computeVisibleAvatarCount(27, onePlusChip)).toBe(1);
		// Only the chip fits → 0 avatars, chip shows the full count.
		expect(computeVisibleAvatarCount(27, onePlusChip - 1)).toBe(0);
	});
});
