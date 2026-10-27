// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import {
	initialKnockWaitPhase,
	KnockWaitEvent,
	KnockWaitPhase,
	nextKnockWaitPhase,
	useKnockWaitPhase
} from './knockWaitPhase';

const EVENTS: KnockWaitEvent[] = [
	'consentAccepted',
	'admitted',
	'declined',
	'knockAgain'
];

describe('initialKnockWaitPhase', () => {
	it('asks for consent only in the group chat and only when it is missing', () => {
		expect(initialKnockWaitPhase('group', true)).toBe('consent');
		expect(initialKnockWaitPhase('group', false)).toBe('waiting');
		expect(initialKnockWaitPhase('call', true)).toBe('waiting');
		expect(initialKnockWaitPhase('call')).toBe('waiting');
	});
});

describe('nextKnockWaitPhase', () => {
	it.each<[KnockWaitPhase, KnockWaitEvent, KnockWaitPhase]>([
		['consent', 'consentAccepted', 'waiting'],
		['waiting', 'admitted', 'admitted'],
		['waiting', 'declined', 'declined'],
		['declined', 'knockAgain', 'waiting']
	])('%s + %s → %s', (phase, event, next) => {
		expect(nextKnockWaitPhase(phase, event)).toBe(next);
	});

	it('does not let a declined person in without a new knock', () => {
		expect(nextKnockWaitPhase('declined', 'admitted')).toBe('declined');
	});

	it('never skips the consent', () => {
		expect(nextKnockWaitPhase('consent', 'admitted')).toBe('consent');
		expect(nextKnockWaitPhase('consent', 'knockAgain')).toBe('consent');
	});

	it('keeps an admitted person admitted, whatever arrives late', () => {
		for (const event of EVENTS) {
			expect(nextKnockWaitPhase('admitted', event)).toBe('admitted');
		}
	});
});

describe('useKnockWaitPhase', () => {
	it('walks consent → waiting → declined → waiting → admitted', () => {
		const { result } = renderHook(() => useKnockWaitPhase('consent'));
		act(() => result.current.dispatch('consentAccepted'));
		expect(result.current.phase).toBe('waiting');
		act(() => result.current.dispatch('declined'));
		expect(result.current.phase).toBe('declined');
		act(() => result.current.dispatch('knockAgain'));
		act(() => result.current.dispatch('admitted'));
		expect(result.current.phase).toBe('admitted');
	});
});
