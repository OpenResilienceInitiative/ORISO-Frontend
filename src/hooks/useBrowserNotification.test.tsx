// @vitest-environment jsdom
/**
 * #1211 — new-enquiry notifications, driven through the hook the session list
 * actually calls. The hook used to make the opt-in decision itself, against
 * the legacy localStorage key and with no release-toggle check at all, so a
 * consultant using the cross-device panel never got an enquiry popup.
 */
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useBrowserNotification } from './useBrowserNotification';
import { setAppConfig } from '../utils/appConfig';
import { saveBrowserNotificationsSettings } from '../utils/notificationHelpers';
import { notificationSettingsStore } from '../utils/notificationSettings/store';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));
vi.mock('react-router-dom', () => ({ useNavigate: () => () => {} }));

const constructed: Array<{ title: string; options: any }> = [];

class FakeNotification {
	static permission: NotificationPermission = 'granted';
	static requestPermission = () => Promise.resolve('granted');
	onshow: any;
	onclick: any;
	onclose: any;
	constructor(title: string, options: any) {
		constructed.push({ title, options });
	}
}

/** Which notification panel the release toggle routes into the profile. */
const routePanel = (crossDevice: boolean) =>
	setAppConfig({
		releaseToggles: { enableNewNotifications: crossDevice }
	} as any);

/** An unassigned enquiry that arrived seconds ago — what the hook reacts to. */
const freshEnquiry = (secondsAgo = 5) =>
	({
		consultant: null,
		session: {
			createDate: new Date(Date.now() - secondsAgo * 1000).toISOString()
		}
	}) as any;

const notifyFor = (sessions: any[]) => {
	const { result } = renderHook(() => useBrowserNotification());
	result.current.maybeSendNewEnquiryNotification(sessions);
};

beforeEach(() => {
	constructed.length = 0;
	localStorage.clear();
	notificationSettingsStore.resetForTests();
	vi.stubGlobal('Notification', FakeNotification);
	routePanel(false);
});

afterEach(() => {
	vi.unstubAllGlobals();
	setAppConfig(null);
});

describe('useBrowserNotification', () => {
	// The regression: no toggle check here at all meant the cross-device
	// panel's opt-in was never consulted.
	it('leaves cross-device delivery to the event provider to avoid duplicate popups', () => {
		routePanel(true);
		notificationSettingsStore.updateSettings({
			browserNotifications: { enabled: true }
		});

		notifyFor([freshEnquiry()]);

		expect(constructed).toHaveLength(0);
	});

	it('fires for an opt-in made in the legacy panel when that is the routed one', () => {
		saveBrowserNotificationsSettings({ enabled: true });

		notifyFor([freshEnquiry()]);

		expect(constructed).toHaveLength(1);
	});

	it('respects the legacy per-type switch for enquiries', () => {
		saveBrowserNotificationsSettings({ enabled: true });
		saveBrowserNotificationsSettings({ initialEnquiry: false });

		notifyFor([freshEnquiry()]);

		expect(constructed).toHaveLength(0);
	});

	it('stays silent when nothing was opted into', () => {
		notifyFor([freshEnquiry()]);

		expect(constructed).toHaveLength(0);
	});

	it('ignores enquiries that are not new any more', () => {
		saveBrowserNotificationsSettings({ enabled: true });

		notifyFor([freshEnquiry(120)]);

		expect(constructed).toHaveLength(0);
	});
});
