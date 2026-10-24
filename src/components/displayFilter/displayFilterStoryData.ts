import { ReactComponent as RequestIcon } from '../../resources/img/icons/display-filter-request.svg';
import { ReactComponent as MessageIcon } from '../../resources/img/icons/speech-bubble.svg';
import { ReactComponent as DraftIcon } from '../../resources/img/icons/display-filter-draft.svg';
import { ReactComponent as HandoverIcon } from '../../resources/img/icons/display-filter-handover.svg';
import { ReactComponent as CallIcon } from '../../resources/img/icons/display-filter-call.svg';
import { ReactComponent as SystemIcon } from '../../resources/img/icons/display-filter-system.svg';
import { ReactComponent as AppointmentIcon } from '../../resources/img/icons/display-filter-appointment.svg';
import { ReactComponent as OtherIcon } from '../../resources/img/icons/display-filter-other.svg';
import { DisplayFilterKindOption, OTHER_KIND_ID } from './displayFilterTypes';
import { DisplayFilterDialogLabels } from './DisplayFilterDialog';
import { SESSION_KIND_ICONS } from './kindOptions';

/**
 * Story fixtures (#1377 slice 1): the seven Timeline families plus the
 * catch-all, with plain German labels so the stories and unit tests need no
 * i18n. The app passes translated labels through `useDisplayFilterLabels`.
 * Icons are Frank's `display-filter-*.svg` set (issue #1377, comment of
 * 2026-09-14); "Nachrichten" keeps the speech bubble the rail already uses.
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
		icon: OtherIcon,
		unreadCount: 0
	}
];

export const STORY_LABELS: DisplayFilterDialogLabels = {
	title: 'Ansicht · Zeitstrahl',
	description:
		'Welche Arten diese Liste zeigt, welche eine Pille bekommen und wie sie klingen.',
	showColumn: 'In der Liste',
	pillColumn: 'Anzeigen',
	showKind: (kind) => `In der Liste: ${kind}`,
	soundColumn: 'Ton',
	soundKind: (kind) => `Ton anhören: ${kind}`,
	soundMenu: (kind) => `Ton wählen: ${kind}`,
	soundDefault: 'Standard',
	soundRing: 'Klingelton',
	soundTone: (number) => `Ton ${number}`,
	soundMuted: 'Stumm',
	pillMenu: (kind) => `Anzeige wählen: ${kind}`,
	pillOn: 'An',
	pillOff: 'Aus',
	liveChatDynamic: 'Dynamisch',
	liveChatSession: 'Bei Sitzung',
	liveChatFixed: 'Fest',
	placeholderHint: 'Kommt bald.',
	pillKind: (kind) => `Pille: ${kind}`,
	otherFixed:
		'Sonstiges wird immer angezeigt, damit nichts unbemerkt verschwindet.',
	pillNotApplicable: 'Keine Pille für diese Art',
	autoRead: 'Ausgeblendetes sofort als gelesen markieren',
	autoReadDescription:
		'Gilt nur für diese Liste. An Chats werden keine Lesebestätigungen gesendet.',
	reset: 'Auf meine Standards zurücksetzen',
	done: 'Fertig',
	close: 'Schließen',
	profileLink: 'Standards bearbeiten',
	overrideNotice: 'Diese Liste weicht von Ihren Standards ab.',
	resetShort: 'Zurücksetzen',
	readOnlyHint:
		'Diese Einstellungen stammen aus einer neueren App-Version. Zum Ändern bitte die App aktualisieren.',
	viewTitle: 'Filter-Button Anzeige-Optionen',
	viewIcons: 'Icons',
	viewLabels: 'Icons + Text',
	viewText: 'Text',
	autoSort: 'Ungelesenes nach links sortieren',
	autoSortDescription:
		'Pillen mit ungelesenen Einträgen rücken an den Anfang der Reihe.',
	deactivatedHint:
		'Vom Träger abgeschaltet. Bestehende Gespräche bleiben sichtbar, bis sie archiviert sind.'
};

/**
 * Gespräche kinds as the consultant list renders them on Dev (2026-10-15):
 * icons, the pill-only rows with a dash under "Ton", the live-chat modes and
 * the Termine placeholder. The phone stories need the real names — a short
 * fixture without icons hid the one-letter-per-line wrap.
 */
export const SESSION_KINDS: DisplayFilterKindOption[] = [
	{ id: 'create', label: 'Chat erstellen', pillOnly: true },
	{ id: 'unread', label: 'Ungelesen', pillOnly: true },
	{ id: 'drafts', label: 'Entwürfe', pillOnly: true },
	{ id: 'oneToOne', label: 'Mail-Beratung' },
	{ id: 'liveChat', label: 'Live-Chat', modes: true },
	{ id: 'internalGroup', label: 'Interner Gruppenchat' },
	{ id: 'circle', label: 'Gesprächskreis' },
	{ id: 'supervision', label: 'Supervision' },
	{ id: 'archive', label: 'Archiviert', pillOnly: true },
	{ id: 'appointments', label: 'Termine', placeholder: true },
	{ id: OTHER_KIND_ID, label: 'Sonstiges' }
].map((kind) => ({
	...kind,
	icon: SESSION_KIND_ICONS[kind.id],
	unreadCount: 0
}));

/** Anfragen kinds as rendered on Dev (2026-10-15). */
export const REQUEST_KINDS: DisplayFilterKindOption[] = [
	{ id: 'nearby', label: 'Mail' },
	{ id: 'liveChat', label: 'Live-Chat', modes: true },
	{ id: OTHER_KIND_ID, label: 'Sonstiges' }
].map((kind) => ({
	...kind,
	icon: SESSION_KIND_ICONS[kind.id],
	unreadCount: 0
}));
