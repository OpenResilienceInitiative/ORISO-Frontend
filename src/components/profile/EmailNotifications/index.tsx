import React from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import {
	AUTHORITIES,
	UserDataContext,
	hasUserAuthority
} from '../../../globalState';
import { Headline } from '../../headline/Headline';
import { Text } from '../../text/Text';
import { EmailToggle } from './EmailToggle';
import { NoEmailSet } from './NoEmailSet';
// This screen's styles live in the shared profile stylesheet, which until now
// only reached it because a sibling profile component happened to import it
// first. Carrying its own import means the screen is styled wherever it is
// rendered — including on its own route, and in Storybook.
import '../profile.styles';
import { NotificationSwitchRow } from './NotificationSwitchRow';
import {
	ADVICE_SEEKER_SWITCHES,
	ALWAYS_SENT_KEYS,
	CONSULTANT_SWITCHES,
	switchForOccasion
} from './notificationMatrix';

/**
 * E-mail notification settings, as ADR-019 specifies them.
 *
 * Two lists rather than one filtered by role — three switches for an advice
 * seeker, seven for a counsellor. See `notificationMatrix.ts` for why that
 * distinction is the point rather than an implementation detail.
 */
export const EmailNotification = () => {
	const { userData } = React.useContext(UserDataContext);
	const { t } = useTranslation();
	const { search } = useLocation();

	const isConsultant = hasUserAuthority(
		AUTHORITIES.CONSULTANT_DEFAULT,
		userData
	);
	const switches = isConsultant
		? CONSULTANT_SWITCHES
		: ADVICE_SEEKER_SWITCHES;

	// Every ORISO mail's footer links here with `?mail=<occasion>`, so the
	// recipient lands on the switch that produced the mail in their hand rather
	// than on a list they have to search.
	const occasion = new URLSearchParams(search).get('mail');
	const highlighted = switchForOccasion(switches, occasion);

	return (
		<div className="notifications__content notifications__content--enhanced">
			<div className="profile__content__title notifications__hero">
				<Headline
					text={t('profile.notifications.title')}
					semanticLevel="5"
				/>
				<Text
					text={t(
						isConsultant
							? 'profile.notifications.descriptionConsultant'
							: 'profile.notifications.descriptionAsker'
					)}
					type="standard"
					className="tertiary"
				/>
			</div>

			{!userData.email && (
				<div className="notifications__panel">
					<NoEmailSet />
				</div>
			)}

			{userData.email && (
				<>
					<div className="notifications__panel">
						<EmailToggle
							name="emailNotificationsEnabled"
							titleKey="profile.notifications.mainEmail.title"
						/>
					</div>

					<div
						className="notifications__panel"
						data-cy="notification-matrix"
					>
						{switches.map((entry) => (
							<NotificationSwitchRow
								key={entry.id}
								entry={entry}
								highlighted={highlighted?.id === entry.id}
							/>
						))}
					</div>

					{/*
						Named rather than left out. Someone arriving from an
						unsubscribe link on a password-reset mail should read why
						there is no switch, instead of searching for one.
					*/}
					<div className="notifications__panel notifications__panel--muted">
						<Text
							text={t(
								'profile.notifications.matrix.alwaysSent.title'
							)}
							type="standard"
						/>
						<ul className="notifications__alwaysSent">
							{ALWAYS_SENT_KEYS.map((key) => (
								<li key={key}>{t(key)}</li>
							))}
						</ul>
					</div>
				</>
			)}
		</div>
	);
};
