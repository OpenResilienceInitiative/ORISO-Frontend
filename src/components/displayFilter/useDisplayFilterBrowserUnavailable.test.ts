// @vitest-environment oriso-jsdom
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { useDisplayFilterBrowserMuted } from './useDisplayFilterBrowserUnavailable';

const isSuppressed = vi.fn();
vi.mock('../../hooks/useNotificationSettings', () => ({
	useNotificationSettings: () => ({ isSuppressed })
}));
const device = vi.hoisted(() => ({
	supported: true,
	permission: 'granted' as NotificationPermission
}));
vi.mock('../../utils/notificationHelpers', () => ({
	isBrowserNotificationTypeEnabled: () => true,
	isSupported: () => device.supported,
	hasPermissions: (permission: NotificationPermission) =>
		device.permission === permission
}));
vi.mock('lottie-react', () => ({ default: () => null }));
vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));

describe('useDisplayFilterBrowserMuted', () => {
	beforeEach(() => {
		isSuppressed.mockReset();
		device.supported = true;
		device.permission = 'granted';
	});

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

	// Settings sync across devices: this device's state is a notice, the
	// cells stay editable (not an unavailable reason).
	it('says when this browser has blocked notifications', () => {
		isSuppressed.mockReturnValue(true);
		device.permission = 'denied';
		expect(
			renderHook(() => useDisplayFilterBrowserMuted('sessions')).result
				.current
		).toBe('erstantwort.notificationChoice.browserDenied');
		// No Browser column, no notice.
		expect(
			renderHook(() => useDisplayFilterBrowserMuted('timeline')).result
				.current
		).toBeUndefined();
	});

	it('says when this browser cannot show notifications at all', () => {
		isSuppressed.mockReturnValue(false);
		device.supported = false;
		expect(
			renderHook(() => useDisplayFilterBrowserMuted('requests')).result
				.current
		).toBe('erstantwort.notificationChoice.browserUnsupported');
	});

	it('adds no notice while the permission is still to be asked', () => {
		isSuppressed.mockReturnValue(false);
		device.permission = 'default';
		expect(
			renderHook(() => useDisplayFilterBrowserMuted('sessions')).result
				.current
		).toBeUndefined();
	});
});
