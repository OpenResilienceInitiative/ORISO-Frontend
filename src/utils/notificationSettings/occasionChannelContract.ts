import {
	EMAIL_AUDIENCE,
	EMAIL_IDS,
	type EmailId
} from '../../emails/content/emailCatalogue';
import {
	ADVICE_SEEKER_SWITCHES,
	CONSULTANT_SWITCHES,
	switchForOccasion,
	type NotificationSource
} from '../../components/profile/EmailNotifications/notificationMatrix';
import {
	getEventDescriptor,
	isKnownEventType
} from '../../components/notificationsCenter/eventDescriptors/registry';
import type { EventFamily } from '../../components/notificationsCenter/eventDescriptors/types';
import {
	areaForFamily,
	kindForEvent,
	type NotificationArea,
	type NotificationKind
} from './notificationConfig';

type RecipientRole = 'asker' | 'consultant' | 'admin';
type BrowserAssociation =
	| { kind: 'descriptor'; eventTypes: readonly string[] }
	| { kind: 'unmapped' };
type EmailPreference =
	| { kind: 'switch'; source: NotificationSource }
	| { kind: 'no-switch' };

/**
 * A seeded browser descriptor is a UI route, not proof that a producer emits it.
 * Keep an explicit entry for every mail so adding one requires a channel review.
 */
const BROWSER_ASSOCIATIONS: Record<EmailId, BrowserAssociation> = {
	'neue-nachricht': { kind: 'descriptor', eventTypes: ['message.new'] },
	'neue-nachricht-beratung': {
		kind: 'descriptor',
		eventTypes: ['message.new']
	},
	'willkommen': { kind: 'unmapped' },
	'passwort-zuruecksetzen': { kind: 'unmapped' },
	'termin': { kind: 'unmapped' },
	'beraterin-kontakt': { kind: 'unmapped' },
	'anfrage-zugewiesen': { kind: 'unmapped' },
	'systemhinweis': { kind: 'unmapped' },
	'neue-anfrage': { kind: 'descriptor', eventTypes: ['request.new'] },
	'direkte-anfrage': { kind: 'unmapped' },
	'tagesuebersicht': { kind: 'unmapped' },
	'uebergabe-angefragt': {
		kind: 'descriptor',
		eventTypes: ['handover.requested']
	},
	'uebergabe-bestaetigt': {
		kind: 'descriptor',
		eventTypes: ['handover.all_confirmed']
	},
	'rueckmeldung': { kind: 'unmapped' },
	'mitteilung': { kind: 'unmapped' },
	'anmeldelink': { kind: 'unmapped' },
	'einmalcode': { kind: 'unmapped' },
	'email-geaendert': { kind: 'unmapped' },
	'einladung-traeger': { kind: 'unmapped' },
	'einladung-fachkraft': { kind: 'unmapped' },
	'avv-unterschrift': { kind: 'unmapped' },
	'einladung-freitext': { kind: 'unmapped' },
	'team-aenderung': {
		kind: 'descriptor',
		eventTypes: [
			'supervisor.added',
			'supervisor.removed',
			'supervisor.assigned',
			'counselor.renamed'
		]
	},
	'smtp-test': { kind: 'unmapped' }
};

/**
 * The catalogue names one primary audience, while the email matrix can show
 * another role's switch for the same occasion. These are existing settings,
 * not proof that a sender reaches either role.
 */
const rolesFor = (id: EmailId): readonly RecipientRole[] => {
	const roles: RecipientRole[] = [EMAIL_AUDIENCE[id]];
	if (
		switchForOccasion(ADVICE_SEEKER_SWITCHES, id) &&
		!roles.includes('asker')
	) {
		roles.push('asker');
	}
	if (
		switchForOccasion(CONSULTANT_SWITCHES, id) &&
		!roles.includes('consultant')
	) {
		roles.push('consultant');
	}
	return roles;
};

export function occasionChannelContract(id: EmailId): {
	roles: readonly RecipientRole[];
};
export function occasionChannelContract(
	id: EmailId,
	role: RecipientRole
):
	| { emailPreference: EmailPreference; browser: BrowserAssociation }
	| undefined;
export function occasionChannelContract(id: EmailId, role?: RecipientRole) {
	const roles = rolesFor(id);
	if (role === undefined) {
		return { roles };
	}
	if (!roles.includes(role)) {
		return undefined;
	}
	const switches =
		role === 'asker'
			? ADVICE_SEEKER_SWITCHES
			: role === 'consultant'
				? CONSULTANT_SWITCHES
				: [];
	const source = switchForOccasion(switches, id)?.source;
	return {
		emailPreference: source
			? { kind: 'switch' as const, source }
			: { kind: 'no-switch' as const },
		browser: BROWSER_ASSOCIATIONS[id]
	};
}

export type EventChannelContract = {
	association:
		| { kind: 'mapped'; role: RecipientRole; occasions: readonly EmailId[] }
		| { kind: 'unmapped'; role: RecipientRole }
		| { kind: 'unknown-recipient' }
		| { kind: 'unknown-event' };
	browser: {
		family: EventFamily;
		area: NotificationArea;
		kind: NotificationKind;
	};
};

/**
 * Classifies an existing feed row against the mail catalogue and routes its
 * browser channels through the existing area×kind choices. The server's
 * recipient role is metadata, never authority. A missing mail association
 * neither suppresses the feed nor changes browser permission or opt-in.
 */
export const resolveEventChannelContract = (
	eventType: string | null | undefined,
	recipientRole?: string | null,
	options: { family?: EventFamily; mentioned?: boolean } = {}
): EventChannelContract => {
	const descriptor = getEventDescriptor(eventType);
	const family = options.family ?? descriptor.family ?? 'system';
	const browser = {
		family,
		area: areaForFamily(family),
		kind: kindForEvent(family, eventType || '', options.mentioned === true)
	};
	if (!isKnownEventType(eventType) || descriptor.eventType !== eventType) {
		return { association: { kind: 'unknown-event' }, browser };
	}
	const role = recipientRole === 'user' ? 'asker' : recipientRole;
	if (role !== 'asker' && role !== 'consultant' && role !== 'admin') {
		return { association: { kind: 'unknown-recipient' }, browser };
	}
	const occasions = EMAIL_IDS.filter((id) => {
		const channel = occasionChannelContract(id, role)?.browser;
		return (
			channel?.kind === 'descriptor' &&
			channel.eventTypes.includes(eventType)
		);
	});
	return {
		association: occasions.length
			? { kind: 'mapped', role, occasions }
			: { kind: 'unmapped', role },
		browser
	};
};
