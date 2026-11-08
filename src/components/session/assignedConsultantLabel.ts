import {
	AUTHORITIES,
	hasUserAuthority,
	type ExtendedSessionInterface
} from '../../globalState';
import type { UserDataInterface } from '../../globalState/interfaces';
import { isAnonymousMatrixUsername } from '../../utils/anonymousChatDisplayName';
import { isEmailShapedLogin } from '../../utils/isEmailShapedLogin';
import { isMatrixUserId } from '../../utils/messageMentions';
import { getModality, Modality } from './getModality';

const isRegisteredAskerOneOnOne = (
	session: ExtendedSessionInterface,
	user: UserDataInterface
): boolean =>
	!!session.isSession &&
	!session.isGroup &&
	getModality(session) === Modality.AGENCY_COUNSELLING &&
	hasUserAuthority(AUTHORITIES.ASKER_DEFAULT, user) &&
	!hasUserAuthority(AUTHORITIES.ANONYMOUS_DEFAULT, user) &&
	!hasUserAuthority(AUTHORITIES.CONSULTANT_DEFAULT, user) &&
	!user?.userRoles?.some(
		(role) => role === 'ANONYMOUS' || role === 'CONSULTANT'
	);

/** Undefined means another viewer or modality. Null means no counsellor is assigned. */
export const resolveAssignedConsultantLabel = (
	session: ExtendedSessionInterface,
	user: UserDataInterface,
	translate: (key: string) => string
): string | null | undefined => {
	if (!isRegisteredAskerOneOnOne(session, user)) return undefined;

	const consultant = session.consultant;
	if (!consultant) return null;

	for (const candidate of [consultant.displayName, consultant.username]) {
		const value = candidate?.trim();
		if (
			value &&
			!isEmailShapedLogin(value) &&
			!isMatrixUserId(value) &&
			!isAnonymousMatrixUsername(value) &&
			!value.startsWith('enc.')
		) {
			return value;
		}
	}
	return translate('consultant.assignedLabel');
};
