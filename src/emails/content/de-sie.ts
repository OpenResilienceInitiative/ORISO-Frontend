/**
 * German, formal address ("Sie"). The default tone for adult counselling.
 *
 * Copy rules that apply to every string in this file:
 *   - never name the counselling centre, the counsellor or the message content
 *     in a mail to an asker, unless the asker triggered it themselves;
 *   - one action per mail;
 *   - "Träger" is the term for the organisation, never "Mandant".
 */

import { EmailContent } from '../kit/emailTemplate';
import { EmailId } from './emailCatalogue';

const footer = {
	offeredBy: '{{platformName}} ist ein Angebot von {{orgName}}.',
	links: [
		{ label: 'Einstellungen', href: '{{settingsUrl}}' },
		{ label: 'Datenschutz', href: '{{privacyUrl}}' },
		{ label: 'Impressum', href: '{{imprintUrl}}' },
		{ label: 'Benachrichtigungen abbestellen', href: '{{unsubscribeUrl}}' }
	],
	automatedNote:
		'Diese E-Mail wurde automatisch versendet. Bitte antworten Sie nicht darauf.'
};

const assurance =
	'Ihre Nachrichten sind Ende-zu-Ende verschlüsselt. Niemand außer Ihnen und Ihrer Beratung kann sie lesen – auch wir nicht.';

/**
 * Footer for mails nobody may switch off — account access and contracts
 * (ADR-019). The unsubscribe link is deliberately absent: there is no switch
 * behind it, and sending someone to a settings screen to hunt for a control
 * that does not exist is worse than saying so.
 */
const securityFooter = {
	offeredBy: '{{platformName}} ist ein Angebot von {{orgName}}.',
	links: [
		{ label: 'Datenschutz', href: '{{privacyUrl}}' },
		{ label: 'Impressum', href: '{{imprintUrl}}' }
	],
	automatedNote:
		'Diese E-Mail gehört zur Anmeldung und lässt sich nicht abbestellen. Bitte antworten Sie nicht darauf.'
};

const legalFooter = {
	...securityFooter,
	automatedNote:
		'Diese E-Mail gehört zum Vertragsverhältnis und lässt sich nicht abbestellen. Bitte antworten Sie nicht darauf.'
};

/**
 * The closing line for mails to a counsellor. Says the same thing as the asker
 * version from the other side: the mail is thin because the content stays where
 * it is encrypted.
 */
const staffAssurance =
	'Inhalte aus Beratungen stehen nie in einer E-Mail. Sie sehen sie ausschließlich verschlüsselt nach der Anmeldung.';

const securityAssurance =
	'Wir fragen Sie nie per E-Mail nach Ihrem Passwort. Geben Sie diesen Link an niemanden weiter.';

const codeAssurance =
	'Wir fragen Sie nie per E-Mail nach Ihrem Passwort. Geben Sie diesen Code an niemanden weiter.';

const accountAssurance =
	'Wir fragen Sie nie per E-Mail nach Ihrem Passwort. Änderungen an Ihrem Zugang melden wir Ihnen immer.';

const legalAssurance =
	'Diese E-Mail gehört zum Vertragsverhältnis zwischen {{orgName}} und {{tenantName}}.';

export const deSie: Record<EmailId, EmailContent> = {
	'neue-nachricht': {
		subject: 'Sie haben eine neue Nachricht',
		preheader:
			'In Ihrer Beratung liegt eine neue Nachricht für Sie bereit.',
		headline: 'Sie haben eine neue Nachricht',
		paragraphs: [
			'In Ihrer Beratung bei {{platformName}} liegt eine neue Nachricht für Sie bereit.',
			'Aus Datenschutzgründen zeigen wir hier weder Inhalt noch Namen. Sie lesen die Nachricht verschlüsselt nach der Anmeldung.'
		],
		cta: { label: 'Zur Nachricht', href: '{{messageUrl}}' },
		footnote:
			'Sie müssen nicht sofort antworten. Die Nachricht bleibt in Ihrem Postfach, solange Sie sie brauchen.',
		assurance,
		footer
	},

	'willkommen': {
		subject: 'Willkommen bei {{platformName}}',
		preheader: 'Ihr anonymer Zugang ist eingerichtet – so geht es weiter.',
		headline: 'Ihr Zugang ist eingerichtet',
		paragraphs: [
			'Sie haben sich anonym bei {{platformName}} registriert. Schön, dass Sie da sind.',
			'Bitte bewahren Sie Ihren Benutzernamen gut auf. Aus Datenschutzgründen können wir ihn nicht wiederherstellen.'
		],
		panel: [{ label: 'Benutzername', value: '{{username}}' }],
		cta: { label: 'Zur Beratung anmelden', href: '{{loginUrl}}' },
		footnote:
			'Ihre Beraterin oder Ihr Berater antwortet innerhalb von 2 Werktagen.',
		assurance,
		footer
	},

	'passwort-zuruecksetzen': {
		subject: 'Neues Passwort festlegen',
		preheader: 'Der Link ist {{expiryHours}} Stunden gültig.',
		headline: 'Neues Passwort festlegen',
		paragraphs: [
			'Sie haben ein neues Passwort für Ihren Zugang bei {{platformName}} angefordert.',
			'Der Link ist {{expiryHours}} Stunden gültig und lässt sich nur einmal verwenden.'
		],
		cta: { label: 'Passwort neu setzen', href: '{{resetUrl}}' },
		footnote:
			'Wenn Sie das nicht angefordert haben, ignorieren Sie diese E-Mail einfach. Ihr Passwort bleibt dann unverändert.',
		assurance,
		footer
	},

	'termin': {
		subject: 'Ihr Termin am {{appointmentDate}}',
		preheader:
			'{{appointmentDate}}, {{appointmentTime}} Uhr – {{appointmentType}}.',
		headline: 'Ihr Termin ist bestätigt',
		paragraphs: [
			'Wir haben Ihren Termin notiert. Sie brauchen nichts vorzubereiten – kommen Sie einfach, wie Sie sind.'
		],
		panel: [
			{ label: 'Datum', value: '{{appointmentDate}}' },
			{ label: 'Uhrzeit', value: '{{appointmentTime}} Uhr' },
			{ label: 'Art', value: '{{appointmentType}}' },
			{ label: 'Ort', value: '{{locationName}}<br>{{locationAddress}}' }
		],
		cta: { label: 'Termin ansehen', href: '{{appointmentUrl}}' },
		secondaryAction: {
			label: 'Adresse auf der Karte öffnen',
			href: '{{mapUrl}}'
		},
		footnote:
			'Sie erhalten 24 Stunden vorher eine Erinnerung. Absagen ist jederzeit möglich.',
		assurance,
		footer
	},

	'beraterin-kontakt': {
		subject: 'So erreichen Sie Ihre Beratung',
		preheader: 'Durchwahl, Sprechzeiten und Terminbuchung auf einen Blick.',
		headline: 'So erreichen Sie Ihre Beratung',
		paragraphs: [
			'Neben dem geschützten Chat können Sie Ihre Beratung auch telefonisch erreichen oder direkt einen Termin buchen.',
			'Ihr Zugang bleibt dabei anonym – Sie entscheiden, was Sie erzählen.'
		],
		panel: [
			{ label: 'Beratung', value: '{{consultantName}}' },
			{ label: 'Durchwahl', value: '{{consultantPhone}}' },
			{ label: 'Sprechzeiten', value: '{{consultantHours}}' },
			{ label: 'E-Mail', value: '{{consultantEmail}}' }
		],
		cta: { label: 'Termin buchen', href: '{{bookingUrl}}' },
		secondaryAction: {
			label: 'Zum geschützten Chat',
			href: '{{messageUrl}}'
		},
		footnote:
			'Außerhalb der Sprechzeiten schreiben Sie am besten im Chat. Wir melden uns innerhalb von 2 Werktagen.',
		assurance,
		footer
	},

	'anfrage-zugewiesen': {
		subject: 'Neue Beratungsanfrage',
		preheader: 'Eine neue Anfrage wartet auf Sie.',
		headline: 'Eine neue Anfrage wartet auf Sie',
		paragraphs: [
			'Ihnen wurde eine neue Beratungsanfrage zugewiesen. Die Details sehen Sie nach der Anmeldung im Beratungsbereich.'
		],
		panel: [
			{ label: 'Thema', value: '{{requestTopic}}' },
			{ label: 'Postleitzahl', value: '{{requestPostcode}}' },
			{ label: 'Eingang', value: '{{requestReceivedAt}}' }
		],
		cta: { label: 'Anfrage öffnen', href: '{{requestUrl}}' },
		footnote: 'Bitte nehmen Sie die Anfrage innerhalb von 2 Werktagen an.',
		assurance,
		footer
	},

	'systemhinweis': {
		subject: 'Geplante Wartung am {{maintenanceDate}}',
		preheader:
			'{{maintenanceStart}} bis {{maintenanceEnd}} Uhr nicht erreichbar.',
		headline: 'Kurze Wartungspause',
		paragraphs: [
			'Am {{maintenanceDate}} ist {{platformName}} zwischen {{maintenanceStart}} und {{maintenanceEnd}} Uhr nicht erreichbar.',
			'Danach können Sie wie gewohnt weiterschreiben.'
		],
		cta: { label: 'Statusseite ansehen', href: '{{statusUrl}}' },
		footnote: 'Bereits geschriebene Nachrichten gehen nicht verloren.',
		assurance,
		footer
	},

	'neue-anfrage': {
		subject: 'Neue Anfrage in Ihrer Beratungsstelle',
		preheader: 'Eine Anfrage wartet auf Annahme.',
		headline: 'Eine neue Anfrage ist eingegangen',
		paragraphs: [
			'In Ihrer Beratungsstelle ist eine neue Beratungsanfrage eingegangen. Sie ist noch niemandem zugewiesen.',
			'Wer sie annimmt, übernimmt die Beratung.'
		],
		panel: [
			{ label: 'Thema', value: '{{requestTopic}}' },
			{ label: 'Postleitzahl', value: '{{requestPostcode}}' },
			{ label: 'Eingang', value: '{{requestReceivedAt}}' }
		],
		cta: { label: 'Anfrage ansehen', href: '{{requestUrl}}' },
		footnote: 'Bitte nehmen Sie die Anfrage innerhalb von 2 Werktagen an.',
		assurance: staffAssurance,
		footer
	},

	'direkte-anfrage': {
		subject: 'Eine Anfrage richtet sich direkt an Sie',
		preheader: 'Diese Anfrage wurde für Sie geschrieben.',
		headline: 'Eine Anfrage richtet sich direkt an Sie',
		paragraphs: [
			'Eine ratsuchende Person hat sich beim Schreiben der Anfrage ausdrücklich für Sie entschieden.',
			'Wenn Sie die Anfrage nicht übernehmen können, geben Sie sie bitte an die Beratungsstelle zurück, damit sie nicht liegen bleibt.'
		],
		panel: [
			{ label: 'Thema', value: '{{requestTopic}}' },
			{ label: 'Eingang', value: '{{requestReceivedAt}}' }
		],
		cta: { label: 'Anfrage öffnen', href: '{{requestUrl}}' },
		footnote: 'Bitte antworten Sie innerhalb von 2 Werktagen.',
		assurance: staffAssurance,
		footer
	},

	'tagesuebersicht': {
		subject: 'Ihre Tagesübersicht',
		preheader: 'Offene Anfragen in Ihrer Beratungsstelle.',
		headline: 'Ihre Tagesübersicht',
		paragraphs: [
			'In Ihrer Beratungsstelle warten offene Anfragen auf Annahme.'
		],
		panel: [
			{ label: 'Offene Anfragen', value: '{{openRequestCount}}' },
			{ label: 'Längste Wartezeit', value: '{{oldestRequestAge}}' },
			{ label: 'Stand', value: '{{digestGeneratedAt}}' }
		],
		cta: { label: 'Anfragen ansehen', href: '{{requestUrl}}' },
		footnote:
			'Diese Übersicht kommt einmal täglich. Sie können sie in den Einstellungen abbestellen.',
		assurance: staffAssurance,
		footer
	},

	'uebergabe-angefragt': {
		subject: 'Übergabe angefragt',
		preheader: 'Eine Beratung soll an Sie übergeben werden.',
		headline: 'Eine Beratung soll an Sie übergeben werden',
		paragraphs: [
			'{{fromConsultantName}} bittet darum, eine laufende Beratung an Sie zu übergeben.',
			'Bitte prüfen Sie im Beratungsbereich, ob Sie die Beratung übernehmen können.'
		],
		panel: [
			{ label: 'Fall', value: '{{caseReference}}' },
			{ label: 'Angefragt von', value: '{{fromConsultantName}}' },
			{ label: 'Angefragt am', value: '{{requestReceivedAt}}' }
		],
		cta: { label: 'Übergabe prüfen', href: '{{requestUrl}}' },
		footnote:
			'Bis Sie zustimmen, bleibt die Beratung bei der bisherigen Fachkraft.',
		assurance: staffAssurance,
		footer
	},

	'uebergabe-bestaetigt': {
		subject: 'Übergabe bestätigt',
		preheader: 'Die Zuständigkeit hat gewechselt.',
		headline: 'Die Übergabe ist bestätigt',
		paragraphs: [
			'Die Beratung wurde übernommen. Ab sofort ist {{toConsultantName}} zuständig.',
			'Die ratsuchende Person wurde in der Anwendung darüber informiert.'
		],
		panel: [
			{ label: 'Fall', value: '{{caseReference}}' },
			{ label: 'Neue Zuständigkeit', value: '{{toConsultantName}}' },
			{ label: 'Übergeben am', value: '{{handoverAt}}' }
		],
		cta: { label: 'Beratung öffnen', href: '{{requestUrl}}' },
		footnote:
			'Ihr Zugriff auf den bisherigen Verlauf endet mit der Übergabe.',
		assurance: staffAssurance,
		footer
	},

	'rueckmeldung': {
		subject: 'Neue Rückmeldung im Fachaustausch',
		preheader: 'Im Fachaustausch liegt eine Rückmeldung für Sie.',
		headline: 'Neue Rückmeldung im Fachaustausch',
		paragraphs: [
			'Im geschützten Fachaustausch zu einer Ihrer Beratungen liegt eine neue Rückmeldung.',
			'Den Inhalt sehen Sie verschlüsselt nach der Anmeldung.'
		],
		panel: [
			{ label: 'Fall', value: '{{caseReference}}' },
			{ label: 'Eingang', value: '{{requestReceivedAt}}' }
		],
		cta: { label: 'Rückmeldung lesen', href: '{{messageUrl}}' },
		footnote:
			'Der Fachaustausch ist für die ratsuchende Person nicht sichtbar.',
		assurance: staffAssurance,
		footer
	},

	'mitteilung': {
		subject: '{{messageSubject}}',
		preheader: '{{messagePreview}}',
		headline: '{{messageHeadline}}',
		paragraphs: ['{{messageBody}}'],
		cta: { label: 'Zu {{platformName}}', href: '{{loginUrl}}' },
		assurance,
		footer
	},

	'anmeldelink': {
		subject: 'Ihr Anmeldelink für {{platformName}}',
		preheader: 'Der Link gilt {{expiryMinutes}} Minuten.',
		headline: 'Ihr Anmeldelink',
		paragraphs: [
			'Mit diesem Link melden Sie sich ohne Passwort an.',
			'Der Link gilt {{expiryMinutes}} Minuten und funktioniert genau einmal.'
		],
		cta: { label: 'Jetzt anmelden', href: '{{loginUrl}}' },
		footnote:
			'Wenn Sie sich nicht anmelden wollten, ignorieren Sie diese E-Mail. Ohne den Link passiert nichts.',
		assurance: securityAssurance,
		footer: securityFooter
	},

	'einmalcode': {
		subject: 'Ihr Einmalcode für die Anmeldung',
		preheader: 'Der Code gilt {{expiryMinutes}} Minuten.',
		headline: 'Ihr Einmalcode',
		paragraphs: ['Geben Sie diesen Code im Anmeldefenster ein.'],
		code: { label: 'Code', value: '{{otpCode}}' },
		cta: { label: 'Zur Anmeldung', href: '{{loginUrl}}' },
		footnote:
			'Wenn Sie sich nicht anmelden wollten, ändern Sie bitte Ihr Passwort.',
		assurance: codeAssurance,
		footer: securityFooter
	},

	'einladung-traeger': {
		subject: 'Einladung: {{tenantName}} bei {{platformName}}',
		preheader: 'Richten Sie Ihren Zugang zur Administration ein.',
		headline: 'Willkommen bei {{platformName}}',
		paragraphs: [
			'Für {{tenantName}} wurde ein Zugang zur Administration von {{platformName}} eingerichtet.',
			'Über den Link legen Sie Ihr Passwort fest und schließen die Einrichtung ab.'
		],
		panel: [
			{ label: 'Träger', value: '{{tenantName}}' },
			{ label: 'Link gültig bis', value: '{{inviteExpiresAt}}' }
		],
		cta: { label: 'Zugang einrichten', href: '{{inviteUrl}}' },
		footnote:
			'Wenn Sie diese Einladung nicht erwartet haben, melden Sie sich bitte bei der Person, die Sie eingeladen hat.',
		assurance: securityAssurance,
		footer: securityFooter
	},

	'einladung-fachkraft': {
		subject: 'Einladung in die Beratung bei {{platformName}}',
		preheader: 'Richten Sie Ihren Zugang als Fachkraft ein.',
		headline: 'Sie wurden zur Beratung eingeladen',
		paragraphs: [
			'{{agencyName}} hat Sie als Fachkraft zu {{platformName}} eingeladen.',
			'Über den Link legen Sie Ihr Passwort fest und richten die Zwei-Faktor-Anmeldung ein.'
		],
		panel: [
			{ label: 'Beratungsstelle', value: '{{agencyName}}' },
			{ label: 'Link gültig bis', value: '{{inviteExpiresAt}}' }
		],
		cta: { label: 'Zugang einrichten', href: '{{inviteUrl}}' },
		footnote:
			'Ohne Zwei-Faktor-Anmeldung ist kein Zugriff auf Beratungen möglich.',
		assurance: securityAssurance,
		footer: securityFooter
	},

	'avv-unterschrift': {
		subject: 'Auftragsverarbeitungsvertrag zur Unterschrift',
		preheader: 'Der AVV für {{tenantName}} liegt bereit.',
		headline: 'Der AVV liegt zur Unterschrift bereit',
		paragraphs: [
			'Für {{tenantName}} wurde ein Auftragsverarbeitungsvertrag erstellt.',
			'Bitte prüfen Sie den Vertrag und zeichnen Sie ihn digital.'
		],
		panel: [
			{ label: 'Träger', value: '{{tenantName}}' },
			{ label: 'Bereitgestellt am', value: '{{dpaProvidedAt}}' },
			{ label: 'Zu unterschreiben bis', value: '{{dpaExpiresAt}}' }
		],
		cta: { label: 'Vertrag öffnen', href: '{{dpaUrl}}' },
		footnote:
			'Ohne unterzeichneten AVV bleibt die Beratung für diesen Träger gesperrt.',
		assurance: legalAssurance,
		footer: legalFooter
	},

	'team-aenderung': {
		subject: 'Änderung in Ihrem Team',
		preheader: 'Ihre Zuständigkeiten haben sich geändert.',
		headline: 'Es hat sich etwas in Ihrem Team geändert',
		paragraphs: [
			'{{teamChangeStatement}}',
			'Was das für Ihre Zuständigkeiten bedeutet, sehen Sie im Beratungsbereich.'
		],
		panel: [
			{ label: 'Vorgang', value: '{{caseReference}}' },
			{ label: 'Geändert am', value: '{{teamChangedAt}}' }
		],
		cta: { label: 'Zum Beratungsbereich', href: '{{appUrl}}' },
		footnote:
			'Ob diese Benachrichtigung verschickt wird, entscheidet Ihr Träger.',
		assurance: staffAssurance,
		footer
	},

	'smtp-test': {
		subject: 'SMTP-Test erfolgreich',
		preheader: 'Der Versand über {{smtpHost}} funktioniert.',
		headline: 'Der SMTP-Test ist angekommen',
		paragraphs: [
			'Wenn Sie diese E-Mail lesen, funktioniert der Versand über die hinterlegten SMTP-Daten.'
		],
		panel: [
			{ label: 'Server', value: '{{smtpHost}}' },
			{ label: 'Absender', value: '{{smtpFrom}}' },
			{ label: 'Gesendet', value: '{{sentAt}}' }
		],
		cta: { label: 'Zur Administration', href: '{{appUrl}}' },
		footnote:
			'Diese E-Mail wird nur auf Anforderung aus der Administration versendet.',
		assurance: staffAssurance,
		footer
	},

	'email-geaendert': {
		subject: 'Ihre E-Mail-Adresse wurde geändert',
		preheader: 'Die Änderung ist ab sofort aktiv.',
		headline: 'Ihre E-Mail-Adresse wurde geändert',
		paragraphs: [
			'Die E-Mail-Adresse für den Zugang {{username}} wurde geändert. Ab sofort gehen Benachrichtigungen an diese Adresse.',
			'Wenn Sie das nicht waren, ändern Sie bitte sofort Ihr Passwort.'
		],
		cta: { label: 'Zum Profil', href: '{{appUrl}}' },
		assurance: accountAssurance,
		footer: securityFooter
	}
};
