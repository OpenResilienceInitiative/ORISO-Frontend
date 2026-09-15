/**
 * React binding for the display-filter store (#1377 slice 2, spec §7).
 *
 * `useDisplayFilterStoreBinding` owns the store's attach/detach lifecycle
 * and is mounted once (AuthenticatedApp): it follows the published Matrix
 * client, including the client swap on token refresh, and detaches when
 * the service is cleared on logout. `useDisplayFilter(section)` only reads
 * and re-renders on every change, local or synced in from another device.
 */

import {
	useCallback,
	useContext,
	useEffect,
	useSyncExternalStore
} from 'react';
import { MatrixClientContext } from '../globalState/context/MatrixClientContext';
import { DisplayFilterValue } from '../components/displayFilter/displayFilterTypes';
import {
	DisplayFilter,
	DisplayFilterSection,
	resolveEffective
} from '../utils/displayFilter/model';
import { displayFilterStore } from '../utils/displayFilter/store';

export const useDisplayFilterStoreBinding = (): void => {
	const matrixContext = useContext(MatrixClientContext);
	const service = matrixContext?.matrixClientService ?? null;

	useEffect(() => {
		if (!service) {
			displayFilterStore.detachClient();
			return undefined;
		}
		const attach = (client: ReturnType<typeof service.getClient>) => {
			if (client) {
				displayFilterStore.attachClient(client);
			} else {
				displayFilterStore.detachClient();
			}
		};
		attach(service.getClient());
		const unsubscribe = service.onClientChange(attach);
		return () => {
			unsubscribe();
			displayFilterStore.detachClient();
		};
	}, [service]);
};

export interface UseDisplayFilterResult {
	/** What the list applies: global default overlaid by the override (§4). */
	effective: DisplayFilter;
	/** The section override, or `null` when none exists. */
	override: DisplayFilterValue | null;
	/** The profile default for this section. */
	global: DisplayFilter;
	/** False before attach/sync and while the record is newer than us. */
	canWrite: boolean;
	readOnly: boolean;
	setSection: (value: DisplayFilterValue) => boolean;
	resetSection: () => boolean;
	setGlobal: (filter: DisplayFilter) => boolean;
}

export const useDisplayFilter = (
	section: DisplayFilterSection
): UseDisplayFilterResult => {
	const state = useSyncExternalStore(
		(listener) => displayFilterStore.subscribe(listener),
		() => displayFilterStore.getState()
	);
	const override = state.filters.sections[section] ?? null;

	const setSection = useCallback(
		(value: DisplayFilterValue) =>
			displayFilterStore.setSection(section, value),
		[section]
	);
	const resetSection = useCallback(
		() => displayFilterStore.resetSection(section),
		[section]
	);
	const setGlobal = useCallback(
		(filter: DisplayFilter) =>
			displayFilterStore.setGlobal(section, filter),
		[section]
	);

	return {
		effective: resolveEffective(state.filters, section),
		override,
		global: state.filters.global[section],
		canWrite: state.synced && !state.readOnly,
		readOnly: state.readOnly,
		setSection,
		resetSection,
		setGlobal
	};
};
