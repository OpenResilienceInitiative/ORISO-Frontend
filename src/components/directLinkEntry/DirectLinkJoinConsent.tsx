import * as React from 'react';
import { useContext, useEffect, useState } from 'react';
import { LocaleContext } from '../../globalState';
import type { InviteLinkContext } from '../../api/apiGetInviteLinkContext';
import { apiGetConsentText } from '../../api/apiGetConsentText';
import { apiPutSessionConsent } from '../../api/apiPutSessionConsent';
import { useConsentSentences } from '../waitingRoom/useConsentSentences';
import { useConsentContext } from '../waitingRoom/useConsentContext';
import {
	resolveEntryRoomConsent,
	type DepartmentConsentState
} from '../anonymousChat/entryRoom/entryRoomConsent';
import { InvitationConsent } from '../directInvitation/InvitationEntryStates';
import { Loading } from '../app/Loading';

type Department = { agencyId: number; topicId: number };

/**
 * The sentence an entry room asks for, for one department (ADR-003: agency
 * x topic): its own wording with its version when it has one, else the
 * platform's or the fixed warning, without a version (`resolveEntryRoomConsent`).
 */
const useDepartmentEntryConsent = (department: Department | null) => {
	const { locale } = useContext(LocaleContext) ?? { locale: 'de' };
	const { context: names, pending } = useConsentContext(department);
	const sentences = useConsentSentences(department?.agencyId);
	const [answer, setAnswer] = useState<DepartmentConsentState>({
		status: 'idle'
	});
	const agencyId = department?.agencyId;
	const topicId = department?.topicId;
	useEffect(() => {
		if (agencyId == null || topicId == null) return undefined;
		let active = true;
		apiGetConsentText(agencyId, topicId).then(
			(result) => {
				if (!active) return;
				setAnswer(
					result.status === 'ok'
						? {
								status: 'ok',
								sentence: result.consentText?.sentence ?? null,
								versionId: result.consentText?.versionId ?? null
							}
						: { status: 'unavailable' }
				);
			},
			() => active && setAnswer({ status: 'unavailable' })
		);
		return () => {
			active = false;
		};
	}, [agencyId, topicId]);
	const consent = resolveEntryRoomConsent({
		...sentences,
		hasDepartment: department !== null,
		department: answer,
		locale,
		context: names
	});
	return { ...consent, readable: consent.readable && !pending };
};

export interface DirectLinkJoinConsentProps {
	context: InviteLinkContext;
	/** The shared conversation the person is about to enter. */
	sessionId: number;
	/** The agreement is recorded: on into the conversation. */
	onAgreed: () => void;
	record?: typeof apiPutSessionConsent;
}

/**
 * #2252, decision B: a person entering a shared appointment conversation
 * agrees for themselves, as askers do in the waiting room. The centre's
 * version is pinned; the platform text records "agreed, no version".
 */
export const DirectLinkJoinConsent = ({
	context,
	sessionId,
	onAgreed,
	record = apiPutSessionConsent
}: DirectLinkJoinConsentProps) => {
	const department =
		context.agencyId != null && context.topicId != null
			? { agencyId: context.agencyId, topicId: context.topicId }
			: null;
	const consent = useDepartmentEntryConsent(department);
	if (!consent.readable) return <Loading />;
	return (
		<InvitationConsent
			consentHtml={consent.html}
			department={department}
			onAgree={async () => {
				await record(sessionId, consent.versionId);
				onAgreed();
			}}
		/>
	);
};
