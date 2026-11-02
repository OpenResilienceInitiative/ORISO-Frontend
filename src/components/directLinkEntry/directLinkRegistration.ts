import type { InviteLinkContext } from '../../api/apiGetInviteLinkContext';
import type { CallEntryAccount } from '../waitingRoom/callEntry/CallEntryRoom';

/**
 * A registration through a counsellor direct link (ORISO-UserService#1486):
 * the link's token and its temporary flag go along. The server then creates
 * no enquiry; the person's own conversation is opened right after.
 */
export const directLinkRegistration = (
	context: InviteLinkContext,
	{ username, password }: Pick<CallEntryAccount, 'username' | 'password'>,
	locale: string,
	token: string
) => ({
	directLinkToken: token,
	temporary: Boolean(context.temporaryAccount),
	username,
	password,
	agencyId: String(context.agencyId ?? ''),
	postcode: '00000',
	termsAccepted: 'true',
	preferredLanguage: locale,
	consultingType:
		context.consultingTypeId != null
			? String(context.consultingTypeId)
			: '0',
	...(context.topicId != null ? { mainTopicId: String(context.topicId) } : {})
});
