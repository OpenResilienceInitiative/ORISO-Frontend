import {
	AUTHORITIES,
	hasUserAuthority,
	type ExtendedSessionInterface,
	type UserDataInterface
} from '../../globalState';
import type { SessionConsultantInterface } from '../../globalState/interfaces';
import { isAnonymousMatrixUsername } from '../../utils/anonymousChatDisplayName';
import { isEmailShapedLogin } from '../../utils/isEmailShapedLogin';
import { isMatrixUserId } from '../../utils/messageMentions';
import { getModality, Modality } from './getModality';

export const isRegisteredAskerOneOnOne = (
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

export const resolveAssignedConsultantLabel = (
	consultant: SessionConsultantInterface,
	fallback: string
): string => {
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
	return fallback;
};
