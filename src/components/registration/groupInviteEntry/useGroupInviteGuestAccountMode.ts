import { useEffect, useState } from 'react';
import { apiGetGroupInviteContext } from '../../../api/apiGetGroupInviteContext';
import { parseGroupChatInviteId } from '../../groupChat/groupChatInviteLink';
import {
	GuestAccountMode,
	isGuestAccountMode
} from '../../guestAccountMode/guestAccountMode';

/** The entry before #1662: the newcomer picks with or without an account. */
const OLD_ENTRY: GuestAccountMode = 'GUEST_CHOOSES';

const signedInvite = (
	gcid: string | null | undefined,
	aid: string | null | undefined
) => {
	const invite = parseGroupChatInviteId(gcid);
	const agencyId = aid?.trim();
	return invite?.inviteToken && agencyId
		? {
				chatId: Number(invite.seriesId),
				agencyId,
				inviteToken: invite.inviteToken
			}
		: null;
};

/**
 * UserService#1662: which account the Gesprächskreis invite gives a person
 * without one, as the server caps it. `undefined` while it loads, so the entry
 * never offers a way the server would refuse. A link without agency or invite
 * token asks nothing (the server refuses that join anyway), and a server that
 * cannot tell keeps the old entry; the registration enforces the mode either
 * way.
 */
export const useGroupInviteGuestAccountMode = (
	gcid: string | null | undefined,
	aid: string | null | undefined
): GuestAccountMode | undefined => {
	const invite = signedInvite(gcid, aid);
	const key = invite ? JSON.stringify(invite) : null;
	const [loaded, setLoaded] = useState<{
		key: string;
		mode: GuestAccountMode;
	} | null>(null);

	useEffect(() => {
		if (!key) return undefined;
		const { chatId, agencyId, inviteToken } = JSON.parse(
			key
		) as NonNullable<ReturnType<typeof signedInvite>>;
		let current = true;
		const read = async (): Promise<GuestAccountMode> => {
			try {
				const context = await apiGetGroupInviteContext(
					chatId,
					agencyId,
					inviteToken
				);
				return isGuestAccountMode(context?.guestAccountMode)
					? context.guestAccountMode
					: OLD_ENTRY;
			} catch {
				return OLD_ENTRY;
			}
		};
		void read().then((mode) => {
			if (current) setLoaded({ key, mode });
		});
		return () => {
			current = false;
		};
	}, [key]);

	if (!key) return OLD_ENTRY;
	return loaded?.key === key ? loaded.mode : undefined;
};
