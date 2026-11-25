/**
 * The enquiry's team chat as a pennant hanging from the header divider,
 * beside the topic tag (FE#2494, Frank 2026-11-24: "Teamchat würde ich
 * tatsächlich auch als Wimpeldesign … sehr viel platzsparender … auch
 * mobil"). It replaces the grey "Team-Chat" chip in the name row, which cut
 * the advice seeker's name short on the phone.
 *
 * Same shape as the appointment pennant: a round bubble with the team icon
 * peeking out below, the word beside it (desktop), a large touch zone. It
 * wears the Teamberatung's own colour pair, as the team side room does. A
 * press opens the team chat; there is no menu.
 */
import * as React from 'react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import '../sessionsList/timeline/appointmentPennant.styles.scss';
import { ReactComponent as TeamGlyph } from '../../resources/img/icons/speech-bubble-team.svg';

export interface TeamChatPennantProps {
	/** The team chat is the panel on screen right now. */
	'active'?: boolean;
	'onOpen': () => void;
	'data-cy'?: string;
}

export const TeamChatPennant = ({
	active,
	onOpen,
	'data-cy': dataCy = 'session-header-team-chat'
}: TeamChatPennantProps) => {
	const { t } = useTranslation();
	const label = t('teamDiscussion.title');
	return (
		<span className="roomAppointmentPennants roomTeamChatPennant">
			<button
				type="button"
				className={clsx(
					'appointmentPennant',
					'appointmentPennant--team',
					active && 'appointmentPennant--pressed'
				)}
				// The phone hides the word: the name stays on the button.
				aria-label={label}
				aria-pressed={active === undefined ? undefined : active}
				title={`${label} – ${t('teamDiscussion.teamOnlyMarker')}`}
				onClick={onOpen}
				data-cy={dataCy}
			>
				<span className="appointmentPennant__bubble" aria-hidden>
					<TeamGlyph focusable="false" />
				</span>
				<span className="appointmentPennant__label">
					<span className="appointmentPennant__text">{label}</span>
				</span>
			</button>
		</span>
	);
};
