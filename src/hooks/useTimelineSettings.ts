/**
 * React binding for the timeline settings store (ADR-021). The binding is
 * mounted once (AuthenticatedApp) and follows the published Matrix client
 * like the display-filter binding; `useTimelineSettings` only reads.
 */

import { useContext, useEffect, useSyncExternalStore } from 'react';
import { MatrixClientContext } from '../globalState/context/MatrixClientContext';
import type { TimelineSettings } from '../utils/timelineSettings/model';
import { timelineSettingsStore } from '../utils/timelineSettings/store';

export const useTimelineSettingsStoreBinding = (): void => {
	const matrixContext = useContext(MatrixClientContext);
	const service = matrixContext?.matrixClientService ?? null;

	useEffect(() => {
		if (!service) {
			timelineSettingsStore.detachClient();
			return undefined;
		}
		const attach = (client: ReturnType<typeof service.getClient>) => {
			if (client) timelineSettingsStore.attachClient(client);
			else timelineSettingsStore.detachClient();
		};
		attach(service.getClient());
		const unsubscribe = service.onClientChange(attach);
		return () => {
			unsubscribe();
			timelineSettingsStore.detachClient();
		};
	}, [service]);
};

export interface UseTimelineSettingsResult {
	settings: TimelineSettings;
	canWrite: boolean;
	writeFailed: boolean;
	update: (patch: Partial<Omit<TimelineSettings, 'version'>>) => boolean;
}

const update: UseTimelineSettingsResult['update'] = (patch) =>
	timelineSettingsStore.update(patch);

export const useTimelineSettings = (): UseTimelineSettingsResult => {
	const state = useSyncExternalStore(
		(listener) => timelineSettingsStore.subscribe(listener),
		() => timelineSettingsStore.getState()
	);
	return {
		settings: state.settings,
		canWrite: state.synced && !state.readOnly,
		writeFailed: state.writeFailed,
		update
	};
};
