import * as React from 'react';
import { displayFilterStore } from '../../utils/displayFilter/store';
import {
	DEFAULT_DISPLAY_FILTERS,
	OrisoDisplayFilters
} from '../../utils/displayFilter/model';

const noop = () => undefined;

/**
 * Storybook/test helper (#1377): attaches a synced fake Matrix client that
 * holds `record` in account data, so the store accepts writes and the
 * dialogs are live. Detaches on unmount.
 */
export const DisplayFilterStoreBinding = ({
	record,
	children
}: {
	record: OrisoDisplayFilters;
	children: React.ReactNode;
}) => {
	React.useEffect(() => {
		let stored: OrisoDisplayFilters = record;
		const client = {
			getUserId: () => '@storybook:oriso',
			getSyncState: () => 'PREPARED',
			getAccountData: () => ({ getContent: () => stored }),
			setAccountData: async (
				_type: string,
				content: OrisoDisplayFilters
			) => {
				stored = content;
			},
			on: noop,
			removeListener: noop
		};
		displayFilterStore.attachClient(client as any);
		return () => displayFilterStore.detachClient();
	}, [record]);
	return <>{children}</>;
};

/** Story decorator: reads the record from `parameters.displayFilters`. */
export const withDisplayFilterStore = (
	Story: React.ComponentType,
	context: { parameters: { displayFilters?: OrisoDisplayFilters } }
) => (
	<DisplayFilterStoreBinding
		record={context.parameters.displayFilters ?? DEFAULT_DISPLAY_FILTERS}
	>
		<Story />
	</DisplayFilterStoreBinding>
);
