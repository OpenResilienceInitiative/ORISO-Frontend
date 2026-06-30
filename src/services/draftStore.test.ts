// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	buildDraftKey,
	DRAFT_STORAGE_KEY,
	DRAFTS_UPDATED_EVENT,
	getAllDraftEntries,
	getDraftEntry,
	removeDraftEntry,
	saveDraftEntry
} from './draftStore';

const storage = new Map<string, string>();
const localStorageMock = {
	clear: vi.fn(() => storage.clear()),
	getItem: vi.fn((key: string) => storage.get(key) ?? null),
	removeItem: vi.fn((key: string) => storage.delete(key)),
	setItem: vi.fn((key: string, value: string) =>
		storage.set(key, String(value))
	)
};

describe('draftStore', () => {
	beforeEach(() => {
		Object.defineProperty(window, 'localStorage', {
			value: localStorageMock,
			configurable: true
		});
		Object.defineProperty(globalThis, 'localStorage', {
			value: localStorageMock,
			configurable: true
		});
		localStorage.clear();
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('builds stable draft keys for user, scope, and thread', () => {
		expect(buildDraftKey('user-1', 42)).toBe(
			'u:user-1|scope:42|thread:main'
		);
		expect(buildDraftKey(null, null, 'root-event')).toBe(
			'u:anonymous|scope:unknown|thread:root-event'
		);
	});

	it('saves, reads, sorts, and removes draft entries', () => {
		const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
		const olderDraft = {
			key: buildDraftKey('user-1', 'room-1'),
			userId: 'user-1',
			text: 'Older draft',
			updatedAt: 100
		};
		const newerDraft = {
			key: buildDraftKey('user-1', 'room-2'),
			userId: 'user-1',
			text: 'Newer draft',
			updatedAt: 200
		};

		saveDraftEntry(olderDraft);
		saveDraftEntry(newerDraft);

		expect(getDraftEntry(olderDraft.key)).toEqual(olderDraft);
		expect(getAllDraftEntries('user-1')).toEqual([newerDraft, olderDraft]);
		expect(dispatchSpy).toHaveBeenCalledWith(
			expect.objectContaining({ type: DRAFTS_UPDATED_EVENT })
		);

		removeDraftEntry(newerDraft.key);

		expect(getDraftEntry(newerDraft.key)).toBeNull();
		expect(getAllDraftEntries('user-1')).toEqual([olderDraft]);
	});

	it('removes a draft when saved text is empty', () => {
		const draft = {
			key: buildDraftKey('user-1', 'room-1'),
			userId: 'user-1',
			text: 'Text',
			updatedAt: 100
		};
		saveDraftEntry(draft);

		saveDraftEntry({ ...draft, text: '   ' });

		expect(getDraftEntry(draft.key)).toBeNull();
	});

	it('recovers from malformed draft storage data', () => {
		localStorage.setItem(DRAFT_STORAGE_KEY, '{not-json');

		expect(getAllDraftEntries()).toEqual([]);
		expect(getDraftEntry('missing')).toBeNull();
	});
});
