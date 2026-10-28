import { AvatarChoice, AvatarIdentity, chosenAvatarOf } from './avatarChoice';

export interface AvatarMember extends AvatarIdentity {
	_id?: string | null;
}

/** Only an exact Matrix author id may select another member's stored choice. */
export const memberAvatarChoice = (
	authorId: string,
	members: readonly AvatarMember[]
) => chosenAvatarOf(members.find((member) => member._id === authorId));

interface DirectAvatarSession {
	item?: { askerMatrixUserId?: string; consultantMatrixUserId?: string };
	user?: AvatarIdentity;
	consultant?: AvatarIdentity;
}

/** Historical counsellors must never inherit the currently assigned person's choice. */
export const directAvatarChoice = (
	authorId: string,
	session: DirectAvatarSession
): AvatarChoice | null => {
	if (authorId === session.item?.consultantMatrixUserId)
		return chosenAvatarOf(session.consultant);
	if (authorId === session.item?.askerMatrixUserId)
		return chosenAvatarOf(session.user);
	return null;
};
