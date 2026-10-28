import * as React from 'react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppConfig } from '../../hooks/useAppConfig';
import {
	AgencyAdminContact as AdminContact,
	apiGetAgencyAdminContacts
} from '../../api/apiGetAgencyAdminContacts';
import { useInternalSubsetChatSubmit } from '../conversationCreate/useInternalSubsetChatSubmit';
import { internalSubsetErrorKey } from '../conversationCreate/internal/internalSubsetMessages';

/** Server limits for a chat name: 3..50 characters. */
const NAME_MIN = 3;
const NAME_MAX = 50;

const toChatName = (agencyName: string, fallback: string): string => {
	const name = (agencyName ?? '').trim().slice(0, NAME_MAX).trim();
	return name.length >= NAME_MIN ? name : fallback;
};

/**
 * One plain address only. The value comes from a public setting and ends up in
 * a `mailto:` href, so anything that could add recipients, headers or a body
 * (`?`, `&`, `,`, `;`, whitespace, angle brackets) is rejected rather than
 * escaped: the hint then simply shows without a link.
 */
const SUPPORT_EMAIL_PATTERN =
	/^[^\s@?&#,;<>"']+@[^\s@?&#,;<>"']+\.[^\s@?&#,;<>"']+$/;

const toSupportEmail = (value: unknown): string | null => {
	const email = typeof value === 'string' ? value.trim() : '';
	return SUPPORT_EMAIL_PATTERN.test(email) ? email : null;
};

type State =
	| { status: 'loading' }
	| { status: 'error' }
	| { status: 'ready'; admins: AdminContact[] };

interface AgencyAdminContactProps {
	agencyId: number;
	/** The name shown for the centre; it becomes the name of the chat. */
	agencyName: string;
}

/**
 * Settings entry of one counselling centre (OBP 2.1 #117): contact the
 * centre's admin(s) in an internal chat named after the centre. The admins
 * come from the UserService (`admin-contacts`); with none, or when they cannot
 * be loaded, a hint replaces the link — never a dead button. With none, the
 * hint also names the platform's fallback support address (global setting
 * `supportEmail`) as a mailto link when one is configured. Opening twice
 * with the same people reuses the room (decided by the UserService).
 */
export const AgencyAdminContact = ({
	agencyId,
	agencyName
}: AgencyAdminContactProps) => {
	const { t: translate } = useTranslation();
	const [state, setState] = useState<State>({ status: 'loading' });
	const { submit, isSubmitting, errorReason } = useInternalSubsetChatSubmit();
	const supportEmail = toSupportEmail(useAppConfig()?.supportEmail);

	useEffect(() => {
		let cancelled = false;
		setState({ status: 'loading' });
		apiGetAgencyAdminContacts(agencyId)
			.then(
				(admins) => !cancelled && setState({ status: 'ready', admins })
			)
			.catch(() => !cancelled && setState({ status: 'error' }));
		return () => {
			cancelled = true;
		};
	}, [agencyId]);

	if (state.status === 'loading') {
		return null;
	}
	if (state.status === 'error') {
		return (
			<p className="text--tertiary mt--1" role="status">
				{translate('profile.data.agency.adminContact.error')}
			</p>
		);
	}
	if (state.admins.length === 0) {
		return (
			<p className="text--tertiary mt--1" role="status">
				<span>
					{translate('profile.data.agency.adminContact.none')}
				</span>
				{supportEmail && (
					<>
						{' '}
						{translate(
							'profile.data.agency.adminContact.supportEmail'
						)}{' '}
						<a className="primary" href={`mailto:${supportEmail}`}>
							{supportEmail}
						</a>
					</>
				)}
			</p>
		);
	}

	const contactAdmins = () =>
		submit({
			selectedIds: state.admins.map((admin) => admin.consultantId),
			agencyId,
			name: toChatName(
				agencyName,
				translate('profile.data.agency.adminContact.fallbackName')
			)
		});

	return (
		<div className="mt--1">
			<button
				className="text--tertiary primary button-as-link"
				type="button"
				onClick={contactAdmins}
				disabled={isSubmitting}
				aria-describedby={
					errorReason ? `admin-contact-error-${agencyId}` : undefined
				}
			>
				{translate('profile.data.agency.adminContact.link')}
			</button>
			{errorReason && (
				<p
					id={`admin-contact-error-${agencyId}`}
					className="text--tertiary mt--1"
					role="alert"
				>
					{translate(internalSubsetErrorKey(errorReason))}
				</p>
			)}
		</div>
	);
};
