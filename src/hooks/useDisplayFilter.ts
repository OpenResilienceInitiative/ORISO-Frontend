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
	DEFAULT_DISPLAY_FILTERS,
	DisplayFilter,
	DisplayFilterSection,
	resolveEffective
} from '../utils/displayFilter/model';
import { displayFilterStore } from '../utils/displayFilter/store';
import { isPracticeMode, subscribePractice } from '../practice/practiceMode';

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
	/** The last write was rejected and the state rolled back (§7.4). */
	writeFailed: boolean;
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
	// FE#2545: while practising, the lists use the defaults, so a kind the
	// counsellor has hidden (e.g. Live-Chat) cannot hide the practice case,
	// and no change made during practice reaches the real preferences.
	const practising = useSyncExternalStore(subscribePractice, isPracticeMode);
	const filters = practising ? DEFAULT_DISPLAY_FILTERS : state.filters;
	const override = filters.sections[section] ?? null;

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

	if (practising) {
		return {
			effective: resolveEffective(filters, section),
			override,
			global: filters.global[section],
			canWrite: false,
			readOnly: false,
			writeFailed: false,
			setSection: () => false,
			resetSection: () => false,
			setGlobal: () => false
		};
	}

	return {
		effective: resolveEffective(state.filters, section),
		override,
		global: state.filters.global[section],
		canWrite: state.synced && !state.readOnly,
		readOnly: state.readOnly,
		writeFailed: state.writeFailed,
		setSection,
		resetSection,
		setGlobal
	};
};
