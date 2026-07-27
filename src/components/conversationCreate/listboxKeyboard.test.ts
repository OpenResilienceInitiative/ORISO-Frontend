import { describe, expect, it } from 'vitest';
import { resolveListboxKey } from './listboxKeyboard';

describe('resolveListboxKey', () => {
	it('moves down and wraps to the top', () => {
		expect(resolveListboxKey('ArrowDown', 0, 3)).toBe(1);
		expect(resolveListboxKey('ArrowDown', 2, 3)).toBe(0);
	});

	it('moves up and wraps to the bottom', () => {
		expect(resolveListboxKey('ArrowUp', 1, 3)).toBe(0);
		expect(resolveListboxKey('ArrowUp', 0, 3)).toBe(2);
	});

	it('focuses the first option from an unfocused state on ArrowDown', () => {
		expect(resolveListboxKey('ArrowDown', -1, 3)).toBe(0);
	});

	it('jumps to the first and last option with Home / End', () => {
		expect(resolveListboxKey('Home', 2, 3)).toBe(0);
		expect(resolveListboxKey('End', 0, 3)).toBe(2);
	});

	it('signals close on Escape', () => {
		expect(resolveListboxKey('Escape', 1, 3)).toBe('close');
		expect(resolveListboxKey('Escape', 0, 0)).toBe('close');
	});

	it('leaves unrelated keys and empty lists alone', () => {
		expect(resolveListboxKey('a', 0, 3)).toBeNull();
		expect(resolveListboxKey('ArrowDown', -1, 0)).toBeNull();
	});
});
