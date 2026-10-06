import { describe, expect, it, vi } from 'vitest';
import { readLastChannel, writeLastChannel } from '../utils/channelRoute';
import { PRACTICE_ENQUIRY_SESSION_ID } from './fixtures/practiceIdentifiers';

const memoryStorage = () => {
	const values = new Map<string, string>();
	return {
		getItem: vi.fn((key: string) => values.get(key) ?? null),
		setItem: vi.fn((key: string, value: string) => {
			values.set(key, value);
		}),
		removeItem: vi.fn((key: string) => {
			values.delete(key);
		})
	};
};

describe('browser storage in practice mode', () => {
	it('never remembers the open side channel of a practice case', () => {
		const storage = memoryStorage();

		writeLastChannel(storage, PRACTICE_ENQUIRY_SESSION_ID, {
			kind: 'supervision'
		});
		writeLastChannel(storage, PRACTICE_ENQUIRY_SESSION_ID, null);

		expect(storage.setItem).not.toHaveBeenCalled();
		expect(readLastChannel(storage, PRACTICE_ENQUIRY_SESSION_ID)).toBe(
			undefined
		);
	});

	it('still remembers it for a real case', () => {
		const storage = memoryStorage();

		writeLastChannel(storage, 4711, { kind: 'supervision' });

		expect(readLastChannel(storage, 4711)).toEqual({ kind: 'supervision' });
	});
});
