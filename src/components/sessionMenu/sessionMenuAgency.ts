import { ExtendedSessionInterface } from '../../globalState/helpers/stateHelpers';

/**
 * The agency the ⋮ menu names and passes to the legal links (`aid`).
 * A group's hosting agency is `assignedAgencies[0]`, as in the waiting room
 * and the Chat-Info; a one-to-one session carries `agency`.
 */
export const getSessionMenuAgency = (
	session: Pick<ExtendedSessionInterface, 'agency' | 'isGroup' | 'item'>
) =>
	(session.isGroup ? session.item?.assignedAgencies?.[0] : undefined) ??
	session.agency;
