import { ExtendedSessionInterface } from '../../globalState/helpers/stateHelpers';

/**
 * The agency the ⋮ menu names and passes to the legal links (`aid`).
 * A one-to-one session carries `agency`; a group names its hosting agency
 * only in `assignedAgencies`.
 */
export const getSessionMenuAgency = (
	session: Pick<ExtendedSessionInterface, 'agency' | 'isGroup' | 'item'>
) =>
	session.agency ??
	(session.isGroup ? session.item?.assignedAgencies?.[0] : undefined);
