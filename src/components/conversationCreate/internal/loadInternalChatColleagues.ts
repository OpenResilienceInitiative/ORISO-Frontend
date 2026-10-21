import {
	apiGetTenantConsultantList,
	Consultant,
	fetchAgencyConsultantList
} from '../../../api/apiGetAgencyConsultantList';
import {
	filterColleaguesForScope,
	InternalChatRecipientScope
} from './recipientScope';

interface LoadInput {
	scope: InternalChatRecipientScope;
	/** The counselling centre the chat is created for. */
	agencyId: number | null;
	/** The counsellor themself is never offered as a recipient. */
	currentUserId?: string;
}

const withoutSelfAndDuplicates = (
	colleagues: Consultant[],
	currentUserId?: string
): Consultant[] =>
	colleagues.reduce<Consultant[]>((unique, colleague) => {
		const isSelf = colleague.consultantId === currentUserId;
		const isKnown = unique.some(
			(known) => known.consultantId === colleague.consultantId
		);
		return isSelf || isKnown ? unique : [...unique, colleague];
	}, []);

/**
 * The colleagues the picker may offer (#1772), narrowed to the Träger's
 * recipient scope:
 *
 * - AGENCY: the chosen counselling centre. The centre list needs an authority
 *   not every role carries (#993); when it is refused the Träger directory is
 *   used instead, narrowed to colleagues it names as members of the centre
 *   (see `filterColleaguesForScope`; unknown membership is not offered). The
 *   UserService refuses anyone out of scope as well.
 * - TENANT / PLATFORM: the Träger directory (see `filterColleaguesForScope`).
 *
 * Rejects when no list can be read, so the caller can offer a retry instead
 * of claiming that nobody is available.
 */
export const loadInternalChatColleagues = async ({
	scope,
	agencyId,
	currentUserId
}: LoadInput): Promise<Consultant[]> => {
	if (scope !== 'AGENCY') {
		return withoutSelfAndDuplicates(
			await apiGetTenantConsultantList(),
			currentUserId
		);
	}
	if (agencyId === null) {
		return [];
	}
	try {
		const centre = await fetchAgencyConsultantList(String(agencyId));
		// 204 (empty centre) resolves as an empty object, not a list.
		return withoutSelfAndDuplicates(
			Array.isArray(centre) ? centre : [],
			currentUserId
		);
	} catch {
		const directory = await apiGetTenantConsultantList();
		return withoutSelfAndDuplicates(
			filterColleaguesForScope({
				scope,
				colleagues: directory,
				agencyId
			}),
			currentUserId
		);
	}
};
