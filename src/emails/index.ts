/**
 * Public entry point of the transactional e-mail kit.
 *
 * Everything a caller needs: the catalogue, the content per tone variant, the
 * two renderers, and a sample-data helper for previews.
 */

import { deDu } from './content/de-du';
import { deSie } from './content/de-sie';
import {
	EMAIL_LOCALE_LANG,
	EmailId,
	EmailLocale
} from './content/emailCatalogue';
import { en } from './content/en';
import {
	EmailContent,
	renderEmailHtml,
	renderEmailText
} from './kit/emailTemplate';
import { EmailBrand, emailDefaultBrand } from './kit/emailTokens';

export * from './content/emailCatalogue';
export * from './kit/emailTokens';
export type { EmailContent } from './kit/emailTemplate';

export const EMAIL_CONTENT: Record<
	EmailLocale,
	Record<EmailId, EmailContent>
> = {
	'de-sie': deSie,
	'de-du': deDu,
	en
};

export const getEmailContent = (
	id: EmailId,
	locale: EmailLocale
): EmailContent => EMAIL_CONTENT[locale][id];

export interface BuildEmailOptions {
	/** Defaults to the placeholder brand, i.e. a send-ready template file. */
	brand?: EmailBrand;
}

export interface BuiltEmail {
	subject: string;
	preheader: string;
	html: string;
	text: string;
}

/** Builds both MIME parts of one mail. */
export const buildEmail = (
	id: EmailId,
	locale: EmailLocale,
	{ brand = emailDefaultBrand }: BuildEmailOptions = {}
): BuiltEmail => {
	const content = getEmailContent(id, locale);
	const options = { brand, lang: EMAIL_LOCALE_LANG[locale] };
	return {
		subject: content.subject,
		preheader: content.preheader,
		html: renderEmailHtml(content, options),
		text: renderEmailText(content, options)
	};
};

/**
 * Sample data for every `{{placeholder}}` the templates use.
 *
 * Preview-only. The values are deliberately fictional: no real counselling
 * centre, no real phone number, and an example.org host throughout.
 */
export const EMAIL_SAMPLE_VALUES: Record<string, string> = {
	messageUrl: 'https://beratung.example.org/nachrichten',
	loginUrl: 'https://beratung.example.org/login',
	resetUrl: 'https://beratung.example.org/passwort/neu?token=8f3a',
	appointmentUrl: 'https://beratung.example.org/termine',
	requestUrl: 'https://beratung.example.org/anfragen/4711',
	statusUrl: 'https://status.example.org',
	settingsUrl: 'https://beratung.example.org/einstellungen',
	privacyUrl: 'https://beratung.example.org/datenschutz',
	imprintUrl: 'https://beratung.example.org/impressum',
	unsubscribeUrl:
		'https://beratung.example.org/einstellungen/benachrichtigungen',
	bookingUrl: 'https://beratung.example.org/termine/buchen',
	username: 'ruhiges-yak-1428',
	expiryHours: '24',
	appointmentDate: 'Dienstag, 4. August 2026',
	appointmentTime: '14:30',
	appointmentType: 'Persönliches Gespräch',
	locationName: 'Beratungsstelle Mainz-Neustadt',
	locationAddress: 'Bahnhofstraße 6, 55116 Mainz',
	mapUrl: 'https://www.openstreetmap.org/search?query=Bahnhofstra%C3%9Fe%206%2C%2055116%20Mainz',
	consultantName: 'Suchtberatung Mainz',
	consultantPhone: '06131 0000-247',
	consultantHours: 'Mo–Do 9–12 Uhr, Di 14–17 Uhr',
	consultantEmail: 'suchtberatung@beratung.example.org',
	requestTopic: 'Suchtberatung',
	requestPostcode: '55116',
	requestReceivedAt: 'heute, 09:12',
	maintenanceDate: 'Sonntag, 9. August 2026',
	maintenanceStart: '02:00',
	maintenanceEnd: '04:30'
};

/**
 * Substitutes `{{placeholders}}`. Unknown keys are left in place on purpose —
 * a visible `{{foo}}` in a preview is a bug report, a silent blank is not.
 */
export const fillEmailPlaceholders = (
	source: string,
	values: Record<string, string>
): string =>
	source.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (whole, key: string) =>
		key in values ? values[key] : whole
	);

/** Every distinct `{{placeholder}}` a rendered template still contains. */
export const listEmailPlaceholders = (source: string): string[] =>
	Array.from(
		new Set(
			(source.match(/\{\{\s*[\w.]+\s*\}\}/g) ?? []).map((token) =>
				token.replace(/\s+/g, '')
			)
		)
	);
