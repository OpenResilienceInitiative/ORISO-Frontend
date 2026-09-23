import type { ExtendedSessionInterface } from '../../../globalState';
import { getModalityIfKnown, Modality } from '../../session/getModality';
import type { GroupChatAccess } from '../useGroupChatAccess';

/**
 * The group a counsellor may knock on, or `undefined`. Only self-help groups
 * (Gesprächskreise) take knocks — never an internal team chat; the server
 * refuses those too (ORISO-UserService#1243). An unknown format counts as
 * "no": the notice then stays what #1534 shipped.
 */
export const knockableGroupId = (
	session: ExtendedSessionInterface | undefined,
	access: GroupChatAccess
): number | undefined =>
	access === 'notMember' &&
	session?.isGroup &&
	getModalityIfKnown(session) === Modality.SELF_HELP
		? session.item?.id
		: undefined;
