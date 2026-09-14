import * as React from 'react';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import { ReactComponent as RequestIcon } from '../../resources/img/icons/timeline-request-client.svg';
import { ReactComponent as MessageIcon } from '../../resources/img/icons/speech-bubble.svg';
import { ReactComponent as DraftIcon } from '../../resources/img/icons/pen-paper.svg';
import { ReactComponent as HandoverIcon } from '../../resources/img/icons/persons-two.svg';
import { ReactComponent as CallIcon } from '../../resources/img/icons/call.svg';
import { ReactComponent as SystemIcon } from '../../resources/img/icons/notification_bell.svg';
import { ReactComponent as AppointmentIcon } from '../../resources/img/icons/chat-booking.svg';
import { DisplayFilterKindOption, OTHER_KIND_ID } from './displayFilterTypes';
import { DisplayFilterDialogLabels } from './DisplayFilterDialog';

/**
 * Story fixtures (#1377 slice 1): the seven Timeline families plus the
 * catch-all, with plain German labels so the stories and unit tests need no
 * i18n. The app passes translated labels through `useDisplayFilterLabels`.
 */
export const TIMELINE_KINDS: DisplayFilterKindOption[] = [
	{ id: 'requests', label: 'Anfragen', icon: RequestIcon, unreadCount: 2 },
	{ id: 'messages', label: 'Nachrichten', icon: MessageIcon, unreadCount: 5 },
	{ id: 'drafts', label: 'Entwürfe', icon: DraftIcon, unreadCount: 1 },
	{ id: 'handover', label: 'Übergabe', icon: HandoverIcon, unreadCount: 0 },
	{ id: 'calls', label: 'Anrufe', icon: CallIcon, unreadCount: 0 },
	{ id: 'system', label: 'System', icon: SystemIcon, unreadCount: 12 },
	{
		id: 'appointments',
		label: 'Termine',
		icon: AppointmentIcon,
		unreadCount: 0
	},
	{
		id: OTHER_KIND_ID,
		label: 'Sonstiges',
		icon: MoreHorizIcon as unknown as React.ComponentType<
			React.SVGProps<SVGSVGElement>
		>,
		unreadCount: 0
	}
];

export const STORY_LABELS: DisplayFilterDialogLabels = {
	title: 'Anzeige-Filter · Zeitstrahl',
	description:
		'Welche Arten in dieser Liste erscheinen und welche eine Pille bekommen.',
	showColumn: 'Anzeigen',
	pillColumn: 'Pille',
	showKind: (kind) => `Anzeigen: ${kind}`,
	pillKind: (kind) => `Pille: ${kind}`,
	otherFixed:
		'Sonstiges wird immer angezeigt, damit nichts unbemerkt verschwindet.',
	autoRead: 'Ausgeblendetes sofort als gelesen markieren',
	autoReadDescription:
		'Gilt nur für diese Liste. An Chats werden keine Lesebestätigungen gesendet.',
	reset: 'Auf meine Standards zurücksetzen',
	done: 'Fertig',
	close: 'Schließen',
	profileLink:
		'Standards und weitere Optionen in Profil › Benachrichtigungen',
	readOnlyHint:
		'Diese Einstellungen stammen aus einer neueren App-Version. Zum Ändern bitte die App aktualisieren.'
};
