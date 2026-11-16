import * as React from 'react';
import { useTranslation } from 'react-i18next';
import type {
	AgencyContact,
	AgencyContactPerson as Person
} from '../../api/apiGetAgencyContactPerson';
import { Tag } from '../tag/Tag';
import {
	canStartChat,
	fallbackGroupKeyFor,
	headingKeyFor,
	orderedPeople,
	roleLabelKeyFor,
	showsCounsellorBadge,
	toMailAddress
} from './agencyContactPersonModel';
import './agencyContactPerson.styles.scss';

const KEY = 'profile.data.agency.contactPerson';

export interface AgencyContactPersonProps {
	/** Keeps ids unique when several centres are listed. */
	agencyId: number;
	contact: AgencyContact;
	/** The platform's global `supportEmail`; used when nobody else is set. */
	supportEmail?: unknown;
	/** Opens the chat with one person; without it no chat button is shown. */
	onStartChat?: (person: Person) => void;
	/** Disables the chat buttons while a room is being opened. */
	isStartingChat?: boolean;
	/** Already translated reason why the last chat could not be opened. */
	chatError?: string | null;
}

/** An address as a `mailto:` link, or as plain text when it is not one plain address. */
const MailAddress = ({ value }: { value: string }) => {
	const address = toMailAddress(value);
	return address ? (
		<a className="agencyContactPerson__email" href={`mailto:${address}`}>
			{address}
		</a>
	) : (
		<span className="agencyContactPerson__email">{value}</span>
	);
};

/**
 * "Ansprechperson" of one counselling centre in the counsellor's profile
 * (ORISO-Admin#1534). Shows the centre's own contact and deputy, the Träger
 * default, or — while nobody is set — the admins responsible instead, and as
 * last resort the platform's support address. A person who also counsels at
 * the centre gets a badge and, when reachable, a "Chat starten" button.
 * Presentational: the data comes from `GET /users/agencies/{id}/contact-person`.
 */
export const AgencyContactPerson = ({
	agencyId,
	contact,
	supportEmail,
	onStartChat,
	isStartingChat = false,
	chatError
}: AgencyContactPersonProps) => {
	const { t: translate } = useTranslation();
	const titleId = `agency-contact-person-${agencyId}`;
	const errorId = `agency-contact-person-error-${agencyId}`;
	const headingKey = headingKeyFor(contact.source);
	const groupKey = fallbackGroupKeyFor(contact.source);
	const people = orderedPeople(contact.people);
	const support = toMailAddress(supportEmail);
	const traegerEmail = contact.traegerContactEmail;

	return (
		<section
			className="agencyContactPerson"
			aria-labelledby={titleId}
			data-source={contact.source}
		>
			<p className="agencyContactPerson__title" id={titleId}>
				{translate(`${KEY}.title`)}
			</p>
			{headingKey && (
				<p className="agencyContactPerson__heading">
					{translate(headingKey)}
				</p>
			)}
			{groupKey && (
				<p className="agencyContactPerson__group">
					{translate(groupKey)}
				</p>
			)}
			{people.length > 0 && (
				<ul className="agencyContactPerson__people">
					{people.map((person, index) => {
						const roleKey = roleLabelKeyFor(person.role);
						const chat = onStartChat && canStartChat(person);
						return (
							<li
								className="agencyContactPerson__person"
								key={`${person.role}-${index}`}
								data-role={person.role}
							>
								<div className="agencyContactPerson__nameRow">
									<span className="agencyContactPerson__name">
										{person.displayName}
									</span>
									{roleKey && (
										<span className="agencyContactPerson__role">
											{translate(roleKey)}
										</span>
									)}
									{showsCounsellorBadge(person) && (
										<Tag
											className="agencyContactPerson__badge"
											color="yellow"
											text={translate(
												`${KEY}.alsoCounsellor`
											)}
										/>
									)}
								</div>
								{person.email && (
									<MailAddress value={person.email} />
								)}
								{chat && (
									<button
										className="agencyContactPerson__chat button-as-link primary"
										type="button"
										onClick={() => onStartChat(person)}
										disabled={isStartingChat}
										aria-label={translate(
											`${KEY}.startChatWith`,
											{ name: person.displayName }
										)}
										aria-describedby={
											chatError ? errorId : undefined
										}
									>
										{translate(`${KEY}.startChat`)}
									</button>
								)}
							</li>
						);
					})}
				</ul>
			)}
			{contact.source === 'SUPPORT_EMAIL' && (
				<p className="agencyContactPerson__support">
					{support ? (
						<>
							{translate(`${KEY}.support.text`)}{' '}
							<MailAddress value={support} />
						</>
					) : (
						translate(`${KEY}.support.none`)
					)}
				</p>
			)}
			{traegerEmail && (
				<p className="agencyContactPerson__traegerEmail">
					<span className="agencyContactPerson__traegerEmailLabel">
						{translate(`${KEY}.traegerContactEmail`)}
					</span>
					<MailAddress value={traegerEmail} />
				</p>
			)}
			{chatError && (
				<p
					id={errorId}
					className="agencyContactPerson__error"
					role="alert"
				>
					{chatError}
				</p>
			)}
		</section>
	);
};
