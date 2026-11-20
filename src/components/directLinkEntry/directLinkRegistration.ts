import type { InviteLinkContext } from '../../api/apiGetInviteLinkContext';
import type { CallEntryAccount } from '../waitingRoom/callEntry/CallEntryRoom';
import {
	asksDirectLinkPostcode,
	DIRECT_LINK_FALLBACK_POSTCODE,
	isDirectLinkPostcodeMissing
} from './directLinkPostcode';

/**
 * A registration through a counsellor direct link (ORISO-UserService#1486):
 * the link's token and its temporary flag go along. The server then creates
 * no enquiry; the person's own conversation is opened right after.
 * A registered account carries the postcode the person entered
 * (ORISO-Frontend#1795); a temporary one keeps the placeholder.
 */
export const directLinkRegistration = (
	context: InviteLinkContext,
	{
		username,
		password,
		postcode
	}: Pick<CallEntryAccount, 'username' | 'password' | 'postcode'>,
	locale: string,
	token: string
) => {
	if (
		isDirectLinkPostcodeMissing(
			asksDirectLinkPostcode(context),
			postcode ?? ''
		)
	) {
		throw new Error('A registered direct-link account needs a postcode');
	}
	return {
		directLinkToken: token,
		temporary: Boolean(context.temporaryAccount),
		username,
		password,
		agencyId: String(context.agencyId ?? ''),
		postcode: asksDirectLinkPostcode(context)
			? (postcode as string)
			: DIRECT_LINK_FALLBACK_POSTCODE,
		termsAccepted: 'true',
		preferredLanguage: locale,
		consultingType:
			context.consultingTypeId != null
				? String(context.consultingTypeId)
				: '0',
		...(context.topicId != null
			? { mainTopicId: String(context.topicId) }
			: {})
	};
};
