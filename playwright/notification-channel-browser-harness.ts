/** Local-only: real channel consumers, synthetic OS/audio boundary, no backend. */
import { setAppConfig } from '../src/utils/appConfig';
import { sendNotification } from '../src/utils/notificationHelpers';
import { resolveEventChannelContract } from '../src/utils/notificationSettings/occasionChannelContract';
import { setKindField } from '../src/utils/notificationSettings/notificationConfig';
import { notificationSettingsStore } from '../src/utils/notificationSettings/store';
import {
	__resetSoundThrottlesForTests,
	playNotificationSound
} from '../src/utils/notificationSettings/soundPlayback';

const control = (id: string) => document.getElementById(id) as HTMLInputElement;
const result = document.getElementById('result')!;
const banners: { title: string; requireInteraction: boolean }[] = [];
let sounds = 0;

class FixtureNotification {
	static get permission(): NotificationPermission {
		return control('permission').checked ? 'granted' : 'denied';
	}
	static requestPermission = () =>
		Promise.resolve(FixtureNotification.permission);
	constructor(title: string, options: NotificationOptions) {
		banners.push({
			title,
			requireInteraction: options.requireInteraction === true
		});
	}
}
class FixtureAudio {
	src = '';
	volume = 1;
	muted = false;
	play() {
		sounds += 1;
		return Promise.resolve();
	}
}
Object.defineProperty(window, 'Notification', {
	value: FixtureNotification,
	configurable: true
});
Object.defineProperty(window, 'Audio', {
	value: FixtureAudio,
	configurable: true
});

setAppConfig({ releaseToggles: { enableNewNotifications: true } } as Parameters<
	typeof setAppConfig
>[0]);
notificationSettingsStore.resetForTests();

const emit = (eventType: string, recipientRole: string) => {
	const channel = resolveEventChannelContract(eventType, recipientRole);
	const { area, kind, family } = channel.browser;
	let config =
		notificationSettingsStore.getState().settings.notificationConfig;
	config = setKindField(
		config,
		area,
		kind,
		'banner',
		control('banner').checked ? 'persistent' : 'off'
	);
	config = setKindField(
		config,
		area,
		kind,
		'sound',
		control('sound').checked ? 'chime' : 'none'
	);
	config = setKindField(
		config,
		area,
		kind,
		'email',
		control('email').checked
	);
	notificationSettingsStore.updateSettings({
		browserNotifications: { enabled: true },
		notificationConfig: config
	});
	notificationSettingsStore.setDeviceSilenced(control('mute').checked);
	__resetSoundThrottlesForTests();
	const { settings, device } = notificationSettingsStore.getState();
	playNotificationSound(
		settings,
		device,
		family,
		eventType,
		false,
		Date.now(),
		undefined,
		recipientRole
	);
	sendNotification(
		'Configured Care Portal: new notification',
		{
			family,
			eventType,
			showAlways: true
		},
		recipientRole
	);
	result.textContent = JSON.stringify({
		banners,
		sounds,
		association: channel.association
	});
};
control('message').onclick = () => emit('message.new', 'user');
control('unmapped').onclick = () => emit('inquiry.accepted', 'user');
control('unknown').onclick = () => emit('message.new', 'future-role');
result.textContent = 'ready';
