import * as React from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import './NotificationChoiceCard.styles.scss';

/**
 * "Wie sollen wir Sie erreichen?" — the post-dispatch notification choice
 * (ADR-018, ORISO-Frontend#825).
 *
 * <h3>Why three stacked buttons and not a form</h3>
 *
 * This lands on someone who has just written about something hard and now
 * wants an answer, not homework. A form asks them to produce something before
 * they know why; three buttons ask them to recognise something. Stacked and
 * full width, because the reference user is older, often on a phone, and a row
 * of small side-by-side targets is the classic way to lose them.
 *
 * <h3>Two honest limits, both visible in the copy</h3>
 *
 * 1. **A browser signal only reaches this device and this browser.** On iOS it
 *    needs the page on the home screen first. It is offered as the no-address
 *    option, never as the equal of an e-mail, and the label says so.
 * 2. **We cannot tell whether the browser already saved the password.** There
 *    is no API for it — `navigator.credentials.get` is Chromium-only and
 *    non-standard. So the third option does not claim to know; choosing it
 *    simply takes the person to the place where they set a password they will
 *    remember, which is also what makes Safari and Chrome offer to save it.
 */

export type NotificationChoice = 'EMAIL' | 'BROWSER' | 'BOTH';

export interface NotificationChoiceCardProps {
	onChoose: (choice: NotificationChoice) => void;
	/** Hides the browser options where the browser cannot deliver at all. */
	isBrowserNotificationSupported?: boolean;
	/** Reflects a choice already made, so the card does not ask twice. */
	chosen?: NotificationChoice | null;
}

export const NotificationChoiceCard: React.FC<NotificationChoiceCardProps> = ({
	onChoose,
	isBrowserNotificationSupported = true,
	chosen = null
}) => {
	const { t } = useTranslation();
	const [selected, setSelected] = useState<NotificationChoice | null>(chosen);

	const choose = (choice: NotificationChoice) => {
		setSelected(choice);
		onChoose(choice);
	};

	const options: {
		choice: NotificationChoice;
		label: string;
		hint?: string;
	}[] = [
		{
			choice: 'EMAIL',
			label: t(
				'erstantwort.notificationChoice.email',
				'Schreiben Sie mir eine E-Mail'
			),
			hint: t(
				'erstantwort.notificationChoice.emailHint',
				'Was Sie hier besprechen, steht nie in dieser E-Mail.'
			)
		},
		...(isBrowserNotificationSupported
			? [
					{
						choice: 'BROWSER' as const,
						label: t(
							'erstantwort.notificationChoice.browser',
							'Geben Sie mir hier ein Signal'
						),
						hint: t(
							'erstantwort.notificationChoice.browserHint',
							'Ohne Adresse — funktioniert aber nur auf diesem Gerät.'
						)
					}
				]
			: []),
		{
			choice: 'BOTH',
			label: t(
				'erstantwort.notificationChoice.both',
				'Beides, und Passwort jetzt selbst festlegen'
			),
			hint: t(
				'erstantwort.notificationChoice.bothHint',
				'Empfohlen. Dann kommen Sie auch wieder herein, wenn Sie etwas vergessen.'
			)
		}
	];

	return (
		<div className="notificationChoiceCard" data-cy="notification-choice">
			{options.map((option) => (
				<button
					key={option.choice}
					type="button"
					className={`notificationChoiceCard__option${
						selected === option.choice
							? ' notificationChoiceCard__option--selected'
							: ''
					}`}
					aria-pressed={selected === option.choice}
					onClick={() => choose(option.choice)}
				>
					<span className="notificationChoiceCard__label">
						{option.label}
					</span>
					{option.hint && (
						<span className="notificationChoiceCard__hint">
							{option.hint}
						</span>
					)}
				</button>
			))}
		</div>
	);
};
