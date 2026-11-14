// @vitest-environment oriso-jsdom
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { readEdgeChoice, writeEdgeChoice } from './calendarPreferences';

afterEach(() => {
	vi.restoreAllMocks();
	window.localStorage.clear();
});

describe('calendarPreferences — remembered grip choice', () => {
	it('asks until a choice is remembered, per person, and forgets it again', () => {
		expect(readEdgeChoice('me')).toBeNull();
		writeEdgeChoice('me', 'week');
		expect(readEdgeChoice('me')).toBe('week');
		expect(readEdgeChoice('kaya')).toBeNull();
		writeEdgeChoice('me', null);
		expect(readEdgeChoice('me')).toBeNull();
	});

	it('ignores anything else stored under the key', () => {
		window.localStorage.setItem('oriso.calendar.edgeChoice.me', 'always');
		expect(readEdgeChoice('me')).toBeNull();
	});

	it('keeps working when storage is blocked', () => {
		vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
			throw new Error('blocked');
		});
		vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
			throw new Error('blocked');
		});
		vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
			throw new Error('blocked');
		});
		expect(() => writeEdgeChoice('me', 'day')).not.toThrow();
		expect(() => writeEdgeChoice('me', null)).not.toThrow();
		expect(readEdgeChoice('me')).toBeNull();
	});
});
