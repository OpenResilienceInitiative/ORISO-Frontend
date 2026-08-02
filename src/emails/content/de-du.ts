/**
 * German, informal address ("du"). The tone used by youth counselling and by
 * Träger who address their clients informally.
 *
 * Same structure as `de-sie`, same anonymity rules — only the address form and
 * the phrasing change.
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
		'Diese E-Mail wurde automatisch versendet. Bitte antworte nicht darauf.'
};

const assurance =
	'Deine Nachrichten sind Ende-zu-Ende verschlüsselt. Niemand außer dir und deiner Beratung kann sie lesen – auch wir nicht.';

export const deDu: Record<EmailId, EmailContent> = {
	'neue-nachricht': {
		subject: 'Du hast eine neue Nachricht',
		preheader:
			'In deiner Beratung liegt eine neue Nachricht für dich bereit.',
		headline: 'Du hast eine neue Nachricht',
		paragraphs: [
			'In deiner Beratung bei {{platformName}} liegt eine neue Nachricht für dich bereit.',
			'Aus Datenschutzgründen zeigen wir hier weder Inhalt noch Namen. Du liest die Nachricht verschlüsselt nach der Anmeldung.'
		],
		cta: { label: 'Zur Nachricht', href: '{{messageUrl}}' },
		footnote:
			'Du musst nicht sofort antworten. Die Nachricht bleibt in deinem Postfach, solange du sie brauchst.',
		assurance,
		footer
	},

	'willkommen': {
		subject: 'Willkommen bei {{platformName}}',
		preheader: 'Dein anonymer Zugang ist eingerichtet – so geht es weiter.',
		headline: 'Dein Zugang ist eingerichtet',
		paragraphs: [
			'Du hast dich anonym bei {{platformName}} registriert. Schön, dass du da bist.',
			'Bitte bewahre deinen Benutzernamen gut auf. Aus Datenschutzgründen können wir ihn nicht wiederherstellen.'
		],
		panel: [{ label: 'Benutzername', value: '{{username}}' }],
		cta: { label: 'Zur Beratung anmelden', href: '{{loginUrl}}' },
		footnote:
			'Deine Beraterin oder dein Berater antwortet innerhalb von 2 Werktagen.',
		assurance,
		footer
	},

	'passwort-zuruecksetzen': {
		subject: 'Neues Passwort festlegen',
		preheader: 'Der Link ist {{expiryHours}} Stunden gültig.',
		headline: 'Neues Passwort festlegen',
		paragraphs: [
			'Du hast ein neues Passwort für deinen Zugang bei {{platformName}} angefordert.',
			'Der Link ist {{expiryHours}} Stunden gültig und lässt sich nur einmal verwenden.'
		],
		cta: { label: 'Passwort neu setzen', href: '{{resetUrl}}' },
		footnote:
			'Wenn du das nicht angefordert hast, ignoriere diese E-Mail einfach. Dein Passwort bleibt dann unverändert.',
		assurance,
		footer
	},

	'termin': {
		subject: 'Dein Termin am {{appointmentDate}}',
		preheader:
			'{{appointmentDate}}, {{appointmentTime}} Uhr – {{appointmentType}}.',
		headline: 'Dein Termin ist bestätigt',
		paragraphs: [
			'Wir haben deinen Termin notiert. Du brauchst nichts vorzubereiten – komm einfach, wie du bist.'
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
			'Du erhältst 24 Stunden vorher eine Erinnerung. Absagen ist jederzeit möglich.',
		assurance,
		footer
	},

	'beraterin-kontakt': {
		subject: 'So erreichst du deine Beratung',
		preheader: 'Durchwahl, Sprechzeiten und Terminbuchung auf einen Blick.',
		headline: 'So erreichst du deine Beratung',
		paragraphs: [
			'Neben dem geschützten Chat kannst du deine Beratung auch telefonisch erreichen oder direkt einen Termin buchen.',
			'Dein Zugang bleibt dabei anonym – du entscheidest, was du erzählst.'
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
			'Außerhalb der Sprechzeiten schreib am besten im Chat. Wir melden uns innerhalb von 2 Werktagen.',
		assurance,
		footer
	},

	'anfrage-zugewiesen': {
		subject: 'Neue Beratungsanfrage',
		preheader: 'Eine neue Anfrage wartet auf dich.',
		headline: 'Eine neue Anfrage wartet auf dich',
		paragraphs: [
			'Dir wurde eine neue Beratungsanfrage zugewiesen. Die Details siehst du nach der Anmeldung im Beratungsbereich.'
		],
		panel: [
			{ label: 'Thema', value: '{{requestTopic}}' },
			{ label: 'Postleitzahl', value: '{{requestPostcode}}' },
			{ label: 'Eingang', value: '{{requestReceivedAt}}' }
		],
		cta: { label: 'Anfrage öffnen', href: '{{requestUrl}}' },
		footnote: 'Bitte nimm die Anfrage innerhalb von 2 Werktagen an.',
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
			'Danach kannst du wie gewohnt weiterschreiben.'
		],
		cta: { label: 'Statusseite ansehen', href: '{{statusUrl}}' },
		footnote: 'Bereits geschriebene Nachrichten gehen nicht verloren.',
		assurance,
		footer
	}
};
