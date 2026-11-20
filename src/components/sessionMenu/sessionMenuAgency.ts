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

/**
 * The advice-centre department (agency × topic) whose published Impressum and
 * Datenschutzerklärung the ⋮ menu opens (ORISO-Admin#1490). The backend walks
 * the ADR-021 ladder from there (department → Beratungsstelle → Träger →
 * platform), so the menu shows the centre's document whenever one exists.
 * `null` when the session names no agency or no topic — the dialog then keeps
 * the tenant text. The topic object may be absent while the session still
 * names its topic via `mainTopicId`, as in the counsellor's AskerInfo.
 */
export const getSessionMenuLegalDepartment = (
	session: Pick<ExtendedSessionInterface, 'agency' | 'isGroup' | 'item'>
): { agencyId: number; topicId: number } | null => {
	const agencyId = getSessionMenuAgency(session)?.id;
	const topic = session.item?.topic;
	const topicId =
		(typeof topic === 'object' ? topic?.id : undefined) ??
		session.item?.mainTopicId;
	return agencyId != null && topicId != null ? { agencyId, topicId } : null;
};
