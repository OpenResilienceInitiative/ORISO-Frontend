import {
	TenantDataInterface,
	UserDataInterface
} from '../../globalState/interfaces';

/**
 * Whether the tenant published a newer version of `field` than the one this user
 * agreed to.
 *
 * A missing user value means *never agreed*, which is not the same as *out of
 * date*. It is the normal, deliberate state of a help-seeker in the waiting
 * room: no Beratungsstelle is assigned yet, so there is no document of theirs to
 * update (ADR-022 — exactly two gates, no third). Treating null as "changed"
 * fired the privacy-update overlay at exactly the place it must never appear,
 * and because its only action cannot succeed for such a user, the overlay became
 * a dead end that blocked the entire live chat (ORISO-Frontend#1087,
 * ORISO-UserService#431).
 *
 * Kept in its own module so it can be tested as the pure comparison it is —
 * importing the component pulls in Lottie and the whole overlay tree.
 */
export const hasChanged = (
	tenantData: TenantDataInterface,
	userData: UserDataInterface,
	field: string
): boolean => {
	if (!tenantData?.content?.[field]) {
		return false;
	}
	const agreedAt = userData?.[field];
	if (!agreedAt) {
		return false;
	}
	return new Date(agreedAt) < new Date(tenantData.content[field]);
};
