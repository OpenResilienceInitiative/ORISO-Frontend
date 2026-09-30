import {
	EMAIL_AUDIENCE,
	type EmailId
} from '../../emails/content/emailCatalogue';
import {
	ADVICE_SEEKER_SWITCHES,
	CONSULTANT_SWITCHES,
	switchForOccasion,
	type NotificationSource
} from '../../components/profile/EmailNotifications/notificationMatrix';

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
