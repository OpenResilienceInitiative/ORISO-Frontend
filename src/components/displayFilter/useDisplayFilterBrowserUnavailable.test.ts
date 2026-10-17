// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useDisplayFilterBrowserMuted } from './useDisplayFilterBrowserUnavailable';

const isSuppressed = vi.fn();
vi.mock('../../hooks/useNotificationSettings', () => ({
	useNotificationSettings: () => ({ isSuppressed })
}));
vi.mock('../../utils/notificationHelpers', () => ({
	isBrowserNotificationTypeEnabled: () => true
}));
vi.mock('lottie-react', () => ({ default: () => null }));
vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));

describe('useDisplayFilterBrowserMuted', () => {
	it("asks delivery's own suppression gate for the section's family", () => {
		isSuppressed.mockImplementation((family) => family === 'messages');
		expect(
			renderHook(() => useDisplayFilterBrowserMuted('sessions')).result
				.current
		).toBe('erstantwort.notificationChoice.browserSilenced');
		expect(
			renderHook(() => useDisplayFilterBrowserMuted('requests')).result
				.current
		).toBeUndefined();
		// No Browser column, no notice.
		expect(
			renderHook(() => useDisplayFilterBrowserMuted('timeline')).result
				.current
		).toBeUndefined();
		expect(isSuppressed).toHaveBeenCalledWith('requests');
	});
});
