import * as React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppConfig } from '../../hooks/useAppConfig';
import {
	AgencyContact,
	AgencyContactPerson as Person,
	apiGetAgencyContactPerson
} from '../../api/apiGetAgencyContactPerson';
import { useInternalSubsetChatSubmit } from '../conversationCreate/useInternalSubsetChatSubmit';
import { internalSubsetErrorKey } from '../conversationCreate/internal/internalSubsetMessages';
import { AgencyContactPerson } from './AgencyContactPerson';

/** Server limits for a chat name: 3..50 characters. */
const NAME_MIN = 3;
const NAME_MAX = 50;

export const toChatName = (agencyName: string, fallback: string): string => {
	const name = (agencyName ?? '').trim().slice(0, NAME_MAX).trim();
	return name.length >= NAME_MIN ? name : fallback;
};

/** Shown when the contact cannot be loaded: the support address, never a blank. */
const SUPPORT_FALLBACK: AgencyContact = { source: 'SUPPORT_EMAIL', people: [] };

type State =
	| { status: 'loading' }
	| { status: 'error' }
	| { status: 'ready'; contact: AgencyContact };

interface AgencyContactPersonSectionProps {
	agencyId: number;
	/** The name shown for the centre; it becomes the name of the chat. */
	agencyName: string;
}

/**
 * Contact person of one of the counsellor's centres (ORISO-Admin#1534), loaded
 * from `GET /users/agencies/{id}/contact-person`. A person who also counsels
 * there can be chatted with: the internal chat is a members-only room named
 * after the centre, as the admin contact link of #117 did. Opening twice with
 * the same person reuses the room (decided by the UserService).
 */
export const AgencyContactPersonSection = ({
	agencyId,
	agencyName
}: AgencyContactPersonSectionProps) => {
	const { t: translate } = useTranslation();
	const [state, setState] = useState<State>({ status: 'loading' });
	const { submit, isSubmitting, errorReason } = useInternalSubsetChatSubmit();
	const supportEmail = useAppConfig()?.supportEmail;

	useEffect(() => {
		let cancelled = false;
		setState({ status: 'loading' });
		apiGetAgencyContactPerson(agencyId)
			.then(
				(contact) =>
					!cancelled && setState({ status: 'ready', contact })
			)
			.catch(() => !cancelled && setState({ status: 'error' }));
		return () => {
			cancelled = true;
		};
	}, [agencyId]);

	const startChat = useCallback(
		(person: Person) => {
			if (!person.chatConsultantId) return;
			submit({
				selectedIds: [person.chatConsultantId],
				agencyId,
				name: toChatName(
					agencyName,
					translate(
						'profile.data.agency.contactPerson.chatFallbackName'
					)
				)
			});
		},
		[submit, agencyId, agencyName, translate]
	);

	return (
		<AgencyContactPerson
			agencyId={agencyId}
			contact={
				state.status === 'ready' ? state.contact : SUPPORT_FALLBACK
			}
			loading={state.status === 'loading'}
			loadError={state.status === 'error'}
			supportEmail={supportEmail}
			onStartChat={startChat}
			isStartingChat={isSubmitting}
			chatError={
				errorReason
					? translate(internalSubsetErrorKey(errorReason))
					: null
			}
		/>
	);
};
