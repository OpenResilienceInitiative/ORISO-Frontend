import { TenantDataInterface } from '../../../globalState/interfaces';
import { StageEffectName } from './types';

/** Contract value -> the name the loader understands. */
const BY_CONTRACT_VALUE: Record<string, StageEffectName> = {
	NONE: 'none',
	LINES: 'lines',
	CONNECTED_DOTS: 'connectedDots',
	CRACKS: 'cracks'
};

/**
 * Which stage effect this tenant asked for.
 *
 * Anything unrecognised — an older backend that does not send the field, a
 * value from a newer Admin, a hand-edited row — resolves to `none`. A login
 * screen must never fail over decoration, and `none` is exactly the screen
 * every tenant has today.
 */
export const resolveTenantStageEffect = (
	tenant?: TenantDataInterface | null
): StageEffectName =>
	BY_CONTRACT_VALUE[tenant?.theming?.loginEffect ?? ''] ?? 'none';
