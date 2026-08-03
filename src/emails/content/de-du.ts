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

/** See `de-sie` — same rule, informal address. */
const securityFooter = {
	offeredBy: '{{platformName}} ist ein Angebot von {{orgName}}.',
	links: [
		{ label: 'Datenschutz', href: '{{privacyUrl}}' },
		{ label: 'Impressum', href: '{{imprintUrl}}' }
	],
	automatedNote:
		'Diese E-Mail gehört zur Anmeldung und lässt sich nicht abbestellen. Bitte antworte nicht darauf.'
};

const legalFooter = {
	...securityFooter,
	automatedNote:
		'Diese E-Mail gehört zum Vertragsverhältnis und lässt sich nicht abbestellen. Bitte antworte nicht darauf.'
};

const staffAssurance =
	'Inhalte aus Beratungen stehen nie in einer E-Mail. Du siehst sie ausschließlich verschlüsselt nach der Anmeldung.';

const securityAssurance =
	'Wir fragen dich nie per E-Mail nach deinem Passwort. Gib diesen Link an niemanden weiter.';

const codeAssurance =
	'Wir fragen dich nie per E-Mail nach deinem Passwort. Gib diesen Code an niemanden weiter.';

const legalAssurance =
	'Diese E-Mail gehört zum Vertragsverhältnis zwischen {{orgName}} und {{tenantName}}.';

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
	},

	'neue-anfrage': {
		subject: 'Neue Anfrage in deiner Beratungsstelle',
		preheader: 'Eine Anfrage wartet auf Annahme.',
		headline: 'Eine neue Anfrage ist da',
		paragraphs: [
			'In deiner Beratungsstelle ist eine neue Beratungsanfrage eingegangen. Sie ist noch niemandem zugewiesen.',
			'Wer sie annimmt, übernimmt die Beratung.'
		],
		panel: [
			{ label: 'Thema', value: '{{requestTopic}}' },
			{ label: 'Postleitzahl', value: '{{requestPostcode}}' },
			{ label: 'Eingang', value: '{{requestReceivedAt}}' }
		],
		cta: { label: 'Anfrage ansehen', href: '{{requestUrl}}' },
		footnote: 'Bitte nimm die Anfrage innerhalb von 2 Werktagen an.',
		assurance: staffAssurance,
		footer
	},

	'direkte-anfrage': {
		subject: 'Eine Anfrage richtet sich direkt an dich',
		preheader: 'Diese Anfrage wurde für dich geschrieben.',
		headline: 'Eine Anfrage richtet sich direkt an dich',
		paragraphs: [
			'Eine ratsuchende Person hat sich beim Schreiben der Anfrage ausdrücklich für dich entschieden.',
			'Wenn du die Anfrage nicht übernehmen kannst, gib sie bitte an die Beratungsstelle zurück, damit sie nicht liegen bleibt.'
		],
		panel: [
			{ label: 'Thema', value: '{{requestTopic}}' },
			{ label: 'Eingang', value: '{{requestReceivedAt}}' }
		],
		cta: { label: 'Anfrage öffnen', href: '{{requestUrl}}' },
		footnote: 'Bitte antworte innerhalb von 2 Werktagen.',
		assurance: staffAssurance,
		footer
	},

	'tagesuebersicht': {
		subject: 'Deine Tagesübersicht',
		preheader: 'Offene Anfragen in deiner Beratungsstelle.',
		headline: 'Deine Tagesübersicht',
		paragraphs: [
			'In deiner Beratungsstelle warten offene Anfragen auf Annahme.'
		],
		panel: [
			{ label: 'Offene Anfragen', value: '{{openRequestCount}}' },
			{ label: 'Längste Wartezeit', value: '{{oldestRequestAge}}' },
			{ label: 'Stand', value: '{{digestGeneratedAt}}' }
		],
		cta: { label: 'Anfragen ansehen', href: '{{requestUrl}}' },
		footnote:
			'Diese Übersicht kommt einmal täglich. Du kannst sie in den Einstellungen abbestellen.',
		assurance: staffAssurance,
		footer
	},

	'uebergabe-angefragt': {
		subject: 'Übergabe angefragt',
		preheader: 'Eine Beratung soll an dich übergeben werden.',
		headline: 'Eine Beratung soll an dich übergeben werden',
		paragraphs: [
			'{{fromConsultantName}} bittet darum, eine laufende Beratung an dich zu übergeben.',
			'Bitte prüf im Beratungsbereich, ob du die Beratung übernehmen kannst.'
		],
		panel: [
			{ label: 'Fall', value: '{{caseReference}}' },
			{ label: 'Angefragt von', value: '{{fromConsultantName}}' },
			{ label: 'Angefragt am', value: '{{requestReceivedAt}}' }
		],
		cta: { label: 'Übergabe prüfen', href: '{{requestUrl}}' },
		footnote:
			'Bis du zustimmst, bleibt die Beratung bei der bisherigen Fachkraft.',
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
			'Dein Zugriff auf den bisherigen Verlauf endet mit der Übergabe.',
		assurance: staffAssurance,
		footer
	},

	'rueckmeldung': {
		subject: 'Neue Rückmeldung im Fachaustausch',
		preheader: 'Im Fachaustausch liegt eine Rückmeldung für dich.',
		headline: 'Neue Rückmeldung im Fachaustausch',
		paragraphs: [
			'Im geschützten Fachaustausch zu einer deiner Beratungen liegt eine neue Rückmeldung.',
			'Den Inhalt siehst du verschlüsselt nach der Anmeldung.'
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
		subject: 'Dein Anmeldelink für {{platformName}}',
		preheader: 'Der Link gilt {{expiryMinutes}} Minuten.',
		headline: 'Dein Anmeldelink',
		paragraphs: [
			'Mit diesem Link meldest du dich ohne Passwort an.',
			'Der Link gilt {{expiryMinutes}} Minuten und funktioniert genau einmal.'
		],
		cta: { label: 'Jetzt anmelden', href: '{{loginUrl}}' },
		footnote:
			'Wenn du dich nicht anmelden wolltest, ignorier diese E-Mail. Ohne den Link passiert nichts.',
		assurance: securityAssurance,
		footer: securityFooter
	},

	'einmalcode': {
		subject: 'Dein Einmalcode für die Anmeldung',
		preheader: 'Der Code gilt {{expiryMinutes}} Minuten.',
		headline: 'Dein Einmalcode',
		paragraphs: ['Gib diesen Code im Anmeldefenster ein.'],
		code: { label: 'Code', value: '{{otpCode}}' },
		cta: { label: 'Zur Anmeldung', href: '{{loginUrl}}' },
		footnote:
			'Wenn du dich nicht anmelden wolltest, ändere bitte dein Passwort.',
		assurance: codeAssurance,
		footer: securityFooter
	},

	'einladung-traeger': {
		subject: 'Einladung: {{tenantName}} bei {{platformName}}',
		preheader: 'Richte deinen Zugang zur Administration ein.',
		headline: 'Willkommen bei {{platformName}}',
		paragraphs: [
			'Für {{tenantName}} wurde ein Zugang zur Administration von {{platformName}} eingerichtet.',
			'Über den Link legst du dein Passwort fest und schließt die Einrichtung ab.'
		],
		panel: [
			{ label: 'Träger', value: '{{tenantName}}' },
			{ label: 'Link gültig bis', value: '{{inviteExpiresAt}}' }
		],
		cta: { label: 'Zugang einrichten', href: '{{inviteUrl}}' },
		footnote:
			'Wenn du diese Einladung nicht erwartet hast, meld dich bitte bei der Person, die dich eingeladen hat.',
		assurance: securityAssurance,
		footer: securityFooter
	},

	'einladung-fachkraft': {
		subject: 'Einladung in die Beratung bei {{platformName}}',
		preheader: 'Richte deinen Zugang als Fachkraft ein.',
		headline: 'Du wurdest zur Beratung eingeladen',
		paragraphs: [
			'{{agencyName}} hat dich als Fachkraft zu {{platformName}} eingeladen.',
			'Über den Link legst du dein Passwort fest und richtest die Zwei-Faktor-Anmeldung ein.'
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
			'Bitte prüf den Vertrag und zeichne ihn digital.'
		],
		panel: [
			{ label: 'Träger', value: '{{tenantName}}' },
			{ label: 'Bereitgestellt von', value: '{{senderName}}' },
			{ label: 'Bereitgestellt am', value: '{{dpaProvidedAt}}' }
		],
		cta: { label: 'Vertrag öffnen', href: '{{dpaUrl}}' },
		footnote:
			'Ohne unterzeichneten AVV bleibt die Beratung für diesen Träger gesperrt.',
		assurance: legalAssurance,
		footer: legalFooter
	},

	'team-aenderung': {
		subject: 'Änderung in deinem Team',
		preheader: 'Deine Zuständigkeiten haben sich geändert.',
		headline: 'Es hat sich etwas in deinem Team geändert',
		paragraphs: [
			'{{teamChangeStatement}}',
			'Was das für deine Zuständigkeiten bedeutet, siehst du im Beratungsbereich.'
		],
		panel: [
			{ label: 'Beratungsstelle', value: '{{agencyName}}' },
			{ label: 'Geändert am', value: '{{teamChangedAt}}' }
		],
		cta: { label: 'Zum Beratungsbereich', href: '{{appUrl}}' },
		footnote:
			'Ob diese Benachrichtigung verschickt wird, entscheidet dein Träger.',
		assurance: staffAssurance,
		footer
	},

	'smtp-test': {
		subject: 'SMTP-Test erfolgreich',
		preheader: 'Der Versand über {{smtpHost}} funktioniert.',
		headline: 'Der SMTP-Test ist angekommen',
		paragraphs: [
			'Wenn du diese E-Mail liest, funktioniert der Versand über die hinterlegten SMTP-Daten.'
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
	}
};
