import * as React from 'react';
import { useRef, useState } from 'react';
import { ReactComponent as EnvelopeIcon } from '../../resources/img/icons/envelope.svg';
import {
	ChatMenuDropdownItem,
	ChatMenuDropdownNote
} from '../chatMenuDropdown/ChatMenuDropdown';
import { useTranslation } from 'react-i18next';
import { apiRequestContactSheetEmail } from '../../api/apiRequestContactSheetEmail';

type ContactSheetResult = 'sent' | 'failed' | null;

export interface ContactSheetRequestState {
	recipient?: string;
	pending: boolean;
	result: ContactSheetResult;
	request: () => Promise<void>;
}

/**
 * The request's state, owned by whoever outlives the menu that shows it:
 * a remounted menu keeps a request in flight and its result. A new session
 * starts idle, and a late answer for the previous session is dropped.
 */
export const useContactSheetRequest = (
	sessionId?: number,
	email?: string
): ContactSheetRequestState => {
	// Each change of session is a new visit: A → B → A starts A idle again,
	// and an answer only lands in the visit that asked.
	const visit = useRef({ sessionId, count: 0 });
	if (visit.current.sessionId !== sessionId) {
		visit.current = { sessionId, count: visit.current.count + 1 };
	}
	const currentVisit = visit.current.count;
	const [state, setState] = useState<{
		visit: number;
		pending: boolean;
		result: ContactSheetResult;
	}>({ visit: currentVisit, pending: false, result: null });
	const recipient = email?.trim();
	const own = state.visit === currentVisit;
	const pending = own && state.pending;
	const result = own ? state.result : null;

	const request = async () => {
		if (!recipient || pending || sessionId === undefined) return;
		const askedIn = currentVisit;
		setState({ visit: askedIn, pending: true, result: null });
		let next: ContactSheetResult;
		try {
			await apiRequestContactSheetEmail(sessionId);
			next = 'sent';
		} catch {
			next = 'failed';
		}
		if (visit.current.count === askedIn) {
			setState({ visit: askedIn, pending: false, result: next });
		}
	};

	return { recipient, pending, result, request };
};

interface ContactSheetRequestProps {
	sessionId: number;
	email?: string;
	/** State held above a remounting menu; without it the item keeps its own. */
	state?: ContactSheetRequestState;
}

export const ContactSheetRequest = ({
	sessionId,
	email,
	state
}: ContactSheetRequestProps) => {
	const { t } = useTranslation();
	const ownState = useContactSheetRequest(sessionId, email);
	const { recipient, pending, result, request } = state ?? ownState;

	return (
		<>
			<ChatMenuDropdownItem
				icon={<EnvelopeIcon aria-hidden="true" focusable="false" />}
				title={
					pending
						? t('contactSheet.sending')
						: t('contactSheet.request')
				}
				disabled={!recipient || pending}
				onClick={request}
			/>
			<ChatMenuDropdownNote>
				{recipient
					? t('contactSheet.recipient', { email: recipient })
					: t('contactSheet.missingEmail')}
			</ChatMenuDropdownNote>
			{(pending || result) && (
				<div role={result === 'failed' ? 'alert' : 'status'}>
					<ChatMenuDropdownNote>
						{pending
							? t('contactSheet.sending')
							: t(`contactSheet.${result}`, { email: recipient })}
					</ChatMenuDropdownNote>
				</div>
			)}
		</>
	);
};
