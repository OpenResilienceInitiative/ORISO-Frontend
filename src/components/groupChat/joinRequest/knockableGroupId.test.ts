import { describe, expect, it } from 'vitest';
import { knockableGroupId } from './knockableGroupId';

const TOKEN = 'tok_EN-9';

const group = (item: Record<string, unknown>) =>
	({ isGroup: true, item: { id: 42, ...item } }) as never;

describe('knockableGroupId — where "Beitritt anfragen" may appear', () => {
	it('offers the knock on a self-help group she is not part of', () => {
		expect(
			knockableGroupId(
				group({ conversationType: 'SELF_HELP' }),
				'notMember',
				TOKEN
			)
		).toBe(42);
	});

	it('recognises a self-help group without the explicit type (repeating chat)', () => {
		expect(
			knockableGroupId(group({ repetitive: true }), 'notMember', TOKEN)
		).toBe(42);
	});

	/* Same rule as the server's ChatConverter.conversationTypeOf(Chat), so the
	   app never offers a knock the server answers with 400. */
	it('treats a legacy group with one occurrence and no interval as a team chat', () => {
		expect(
			knockableGroupId(group({ repeatCount: 1 }), 'notMember', TOKEN)
		).toBeUndefined();
		expect(
			knockableGroupId(group({ repeatCount: 0 }), 'notMember', TOKEN)
		).toBeUndefined();
	});

	it('treats a legacy group that repeats or has an interval as self-help', () => {
		expect(
			knockableGroupId(group({ repeatCount: 2 }), 'notMember', TOKEN)
		).toBe(42);
		expect(
			knockableGroupId(
				group({ repeatCount: 1, chatInterval: 'WEEKLY' }),
				'notMember',
				TOKEN
			)
		).toBe(42);
	});

	it('lets a stored type win over the legacy guess', () => {
		expect(
			knockableGroupId(
				group({ conversationType: 'SELF_HELP', repeatCount: 1 }),
				'notMember',
				TOKEN
			)
		).toBe(42);
	});

	it('never offers it on an internal team chat', () => {
		expect(
			knockableGroupId(
				group({ conversationType: 'INTERNAL_GROUP', repetitive: true }),
				'notMember',
				TOKEN
			)
		).toBeUndefined();
		expect(knockableGroupId(group({}), 'notMember', TOKEN)).toBeUndefined();
	});

	it('never offers it to someone who came without the link’s token', () => {
		const selfHelp = group({ conversationType: 'SELF_HELP' });
		expect(
			knockableGroupId(selfHelp, 'notMember', undefined)
		).toBeUndefined();
		expect(knockableGroupId(selfHelp, 'notMember', '')).toBeUndefined();
	});

	it('never offers it to someone who already has the group, or while checking', () => {
		const selfHelp = group({ conversationType: 'SELF_HELP' });
		expect(knockableGroupId(selfHelp, 'member', TOKEN)).toBeUndefined();
		expect(knockableGroupId(selfHelp, 'checking', TOKEN)).toBeUndefined();
		expect(knockableGroupId(undefined, 'notMember', TOKEN)).toBeUndefined();
	});
});
