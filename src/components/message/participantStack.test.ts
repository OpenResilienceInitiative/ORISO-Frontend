import { describe, expect, it } from 'vite-plus/test';
import {
	formatOverflowCount,
	resolveParticipantStack,
	STACK_MAX_VISIBLE,
	type StackParticipant
} from './participantStack';

const person = (
	userId: string,
	overrides: Partial<StackParticipant> = {}
): StackParticipant => ({
	userId,
	displayName: userId.replace(/^@|:.*$/g, ''),
	...overrides
});

describe('resolveParticipantStack (room header avatar row, FE#1193)', () => {
	it('keeps caller order when nothing else is known', () => {
		const stack = resolveParticipantStack([
			person('@mona:x'),
			person('@bettina:x')
		]);
		expect(stack.visible.map((p) => p.userId)).toEqual([
			'@mona:x',
			'@bettina:x'
		]);
		expect(stack.overflow).toBe(0);
	});

	it('puts the participant with the latest activity first', () => {
		const stack = resolveParticipantStack([
			person('@mona:x', { lastActivity: 100 }),
			person('@sonnenblume:x', { lastActivity: 300 }),
			person('@bettina:x', { lastActivity: 200 })
		]);
		expect(stack.visible.map((p) => p.userId)).toEqual([
			'@sonnenblume:x',
			'@bettina:x',
			'@mona:x'
		]);
	});

	it('ranks unknown activity behind known activity', () => {
		const stack = resolveParticipantStack([
			person('@mona:x'),
			person('@bettina:x', { lastActivity: 1 })
		]);
		expect(stack.visible[0].userId).toBe('@bettina:x');
	});

	it('lets the advice seeker win a tie', () => {
		const stack = resolveParticipantStack([
			person('@mona:x'),
			person('@sonnenblume:x', { isAsker: true })
		]);
		expect(stack.visible[0].userId).toBe('@sonnenblume:x');
	});

	it('collapses duplicates of the same Matrix id', () => {
		const stack = resolveParticipantStack([
			person('@mona:x'),
			person('@mona:x'),
			person('', { displayName: 'ghost' })
		]);
		expect(stack.visible).toHaveLength(1);
	});

	it('folds everything beyond four avatars into "+N"', () => {
		const stack = resolveParticipantStack(
			Array.from({ length: 27 }, (_, i) => person(`@m${i}:x`))
		);
		expect(stack.visible).toHaveLength(STACK_MAX_VISIBLE);
		expect(stack.overflow).toBe(23);
	});

	it('shows exactly four avatars without a chip', () => {
		const stack = resolveParticipantStack(
			Array.from({ length: 4 }, (_, i) => person(`@m${i}:x`))
		);
		expect(stack.visible).toHaveLength(4);
		expect(stack.overflow).toBe(0);
	});

	it('honours a custom cap', () => {
		const stack = resolveParticipantStack(
			[person('@a:x'), person('@b:x'), person('@c:x')],
			2
		);
		expect(stack.visible).toHaveLength(2);
		expect(stack.overflow).toBe(1);
	});
});

describe('overflow list', () => {
	const people = Array.from({ length: 5 }, (_, i) => ({
		userId: `@u${i}:x`,
		displayName: `U${i}`
	}));

	it('hands out the folded people in stack order', () => {
		const stack = resolveParticipantStack(people, 2);
		expect(stack.overflow).toBe(3);
		expect(stack.hidden.map((p) => p.userId)).toEqual([
			'@u2:x',
			'@u3:x',
			'@u4:x'
		]);
	});

	it('has nothing hidden when everyone fits', () => {
		expect(resolveParticipantStack(people, 5).hidden).toEqual([]);
	});

	it('writes the count, capped at 99+', () => {
		expect(formatOverflowCount(1)).toBe('+1');
		expect(formatOverflowCount(99)).toBe('+99');
		expect(formatOverflowCount(100)).toBe('99+');
	});
});
