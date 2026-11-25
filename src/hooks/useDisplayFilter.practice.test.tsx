// @vitest-environment oriso-jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import {
	DEFAULT_DISPLAY_FILTERS,
	withGlobalFilter
} from '../utils/displayFilter/model';
import { displayFilterStore } from '../utils/displayFilter/store';

let practising = false;
const listeners = new Set<() => void>();
vi.mock('../practice/practiceMode', () => ({
	isPracticeMode: () => practising,
	subscribePractice: (listener: () => void) => {
		listeners.add(listener);
		return () => listeners.delete(listener);
	}
}));

import { useDisplayFilter } from './useDisplayFilter';

const setPractising = (next: boolean) =>
	act(() => {
		practising = next;
		listeners.forEach((listener) => listener());
	});

// The counsellor hid Live-Chat in their request list (real preference).
const hiddenLiveChat = withGlobalFilter(DEFAULT_DISPLAY_FILTERS, 'requests', {
	kinds: { liveChat: { show: false, pill: true } },
	autoReadHidden: false
});

describe('useDisplayFilter while practising (FE#2545)', () => {
	afterEach(() => {
		practising = false;
		vi.restoreAllMocks();
	});

	it('uses the defaults, so a hidden kind cannot hide the practice case, and writes nothing', () => {
		const realState = displayFilterStore.getState();
		vi.spyOn(displayFilterStore, 'getState').mockReturnValue({
			...realState,
			filters: hiddenLiveChat,
			synced: true,
			readOnly: false
		});
		const setSection = vi.spyOn(displayFilterStore, 'setSection');
		const setGlobal = vi.spyOn(displayFilterStore, 'setGlobal');
		const { result } = renderHook(() => useDisplayFilter('requests'));

		expect(result.current.effective.kinds.liveChat?.show).toBe(false);

		setPractising(true);
		expect(result.current.effective.kinds.liveChat).toBeUndefined();
		expect(result.current.canWrite).toBe(false);
		expect(result.current.setGlobal(hiddenLiveChat.global.requests)).toBe(
			false
		);
		expect(result.current.setSection({} as never)).toBe(false);
		expect(setSection).not.toHaveBeenCalled();
		expect(setGlobal).not.toHaveBeenCalled();

		setPractising(false);
		expect(result.current.effective.kinds.liveChat?.show).toBe(false);
	});
});
