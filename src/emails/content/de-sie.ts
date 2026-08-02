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
	}
};
