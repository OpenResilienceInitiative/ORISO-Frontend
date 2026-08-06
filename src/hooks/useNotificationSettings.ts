/**
 * WP-06 Slice 6a — React binding for the cross-device notification settings.
 *
 * Attaches the logged-in Matrix client (when available) to the settings store
 * and re-renders on any change — local or synced in from another device via
 * account data. Works without a client too (defaults / localStorage mirror),
 * so Storybook and the pre-login shell render fine.
 */

import { useContext, useEffect, useSyncExternalStore } from 'react';
import { MatrixClientContext } from '../globalState/context/MatrixClientContext';
import {
	NotificationSettingsUpdate,
	isNotificationSuppressed
} from '../utils/notificationSettings/model';
import { notificationSettingsStore } from '../utils/notificationSettings/store';
import { EventFamily } from '../components/notificationsCenter/eventDescriptors/types';

export const useNotificationSettings = () => {
	// Deliberately tolerant of a missing provider (Storybook, tests).
	const matrixContext = useContext(MatrixClientContext);
	const client = matrixContext?.matrixClientService?.getClient?.() ?? null;

	useEffect(() => {
		if (client) {
			notificationSettingsStore.attachClient(client);
		}
	}, [client]);

	const state = useSyncExternalStore(
		(listener) => notificationSettingsStore.subscribe(listener),
		() => notificationSettingsStore.getState()
	);

	return {
		settings: state.settings,
		deviceSilenced: state.device.silenced,
		/** 'defaults' | 'mirror' | 'account' — mostly for diagnostics/UI hints. */
		source: state.source,
		updateSettings: (update: NotificationSettingsUpdate) =>
			notificationSettingsStore.updateSettings(update),
		setDeviceSilenced: (silenced: boolean) =>
			notificationSettingsStore.setDeviceSilenced(silenced),
		isSuppressed: (family: EventFamily) =>
			isNotificationSuppressed(state.settings, state.device, family)
	};
};
