/**
 * Emits the MailService (Thymeleaf) template set from the design system.
 *
 *   npm run emails:mailservice
 *
 * MailService is the upstream Online-Beratung service running unmodified, so we
 * do not get to choose the template names or the model. Both are fixed by what
 * UserService sends: the template ids in `EmailSupplier` and the
 * `TemplateDataDTO` keys each supplier puts on the wire.
 *
 * That is the whole difficulty. The design system's copy asks for values the
 * upstream model does not carry — a topic, a time of arrival, a case reference
 * — so each template here declares exactly which model variables it consumes,
 * and the build fails if a template needs one that is not in that list. A
 * template that silently renders an empty panel row is worse than a build
 * error, because it only shows up in a sent mail.
 *
 * Output: `src/emails/dist/mailservice/<template>.html` (German) and
 * `<template>.en.html`, matching upstream's `templates/` layout.
 */

import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	EMAIL_CONTENT,
	EMAIL_LANGUAGE_LOCALES,
	EMAIL_LOCALE_LANG,
	EMAIL_SOURCE_LOCALE,
	EmailId,
	EmailLocale
} from '../index';
import { EmailDataRow } from '../kit/emailAtoms';
import { toEmailDialectHtml } from '../kit/emailDialect';
import {
	EmailContent,
	renderEmailHtml,
	renderEmailText
} from '../kit/emailTemplate';
import { emailDefaultBrand } from '../kit/emailTokens';

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(here, '../dist/mailservice');

interface MailServiceTemplate {
	/** Upstream template name — fixed by `EmailSupplier` in UserService. */
	file: string;
	/** The designed occasion it renders. */
	id: EmailId;
	/**
	 * The `TemplateDataDTO` keys the sending supplier actually puts on the wire.
	 * Anything a template references outside this list is a build error.
	 */
	model: string[];
	/**
	 * Panel rows rebuilt from the variables that exist. The design's own rows
	 * are dropped, because they ask for values upstream never sends.
	 */
	panel?: EmailDataRow[];
	/** Where the button points. Always `url` — it is the only link upstream has. */
	cta?: string;
	/** Replace the headline with a model variable (the free-text mail). */
	headline?: string;
	/** Replace the body with a model variable (the free-text mail). */
	body?: string;
	/**
	 * Copy rewritten for the values upstream actually sends.
	 *
	 * The designed copy for the two handover mails names the counsellor on the
	 * other side of the handover, and upstream sends no such name — so rather
	 * than a blank in the middle of a sentence, the sentence changes.
	 */
	paragraphs?: Partial<Record<EmailLocale, string[]>>;
	/** Placeholders this template resolves itself, before the brand mapping. */
	values?: Record<string, string>;
}

const TEMPLATES: MailServiceTemplate[] = [
	{
		file: 'enquiry-notification-consultant',
		id: 'neue-anfrage',
		model: ['name', 'plz', 'beratungsstelle', 'url'],
		panel: [
			{ label: 'Beratungsstelle', value: '${beratungsstelle}' },
			{ label: 'Postleitzahl', value: '${plz}' }
		],
		cta: '${url}'
	},
	{
		file: 'direct-enquiry-notification-consultant',
		id: 'direkte-anfrage',
		model: ['name', 'plz', 'url'],
		panel: [{ label: 'Postleitzahl', value: '${plz}' }],
		cta: '${url}'
	},
	{
		file: 'assign-enquiry-notification',
		id: 'anfrage-zugewiesen',
		model: ['name_recipient', 'name_sender', 'name_user', 'url'],
		panel: [
			{ label: 'Ratsuchende Person', value: '${name_user}' },
			{ label: 'Zugewiesen von', value: '${name_sender}' }
		],
		cta: '${url}'
	},
	{
		file: 'daily-enquiry-notification',
		id: 'tagesuebersicht',
		model: [
			'consultant_name',
			'agency_name',
			'enquiries',
			'subject',
			'url'
		],
		panel: [
			{ label: 'Offene Anfragen', value: '${enquiries}' },
			{ label: 'Beratungsstelle', value: '${agency_name}' }
		],
		cta: '${url}'
	},
	{
		file: 'reassign-request-notification',
		id: 'uebergabe-angefragt',
		// Upstream sends only the recipient's name and a link — no case
		// reference, no requesting counsellor. So this one carries no panel.
		model: ['name_recipient', 'url'],
		paragraphs: {
			'de-sie': [
				'Eine laufende Beratung soll an Sie übergeben werden.',
				'Bitte prüfen Sie im Beratungsbereich, ob Sie die Beratung übernehmen können.'
			],
			'en': [
				'An ongoing counselling case is to be handed over to you.',
				'Please check in the counselling area whether you can take it on.'
			]
		},
		cta: '${url}'
	},
	{
		file: 'reassign-confirmation-notification',
		id: 'uebergabe-bestaetigt',
		model: ['name_recipient', 'name_from_consultant', 'url'],
		paragraphs: {
			'de-sie': [
				'Die Übergabe ist bestätigt. Ab sofort sind Sie für diese Beratung zuständig.',
				'Die ratsuchende Person wurde in der Anwendung darüber informiert.'
			],
			'en': [
				'The handover is confirmed. You are responsible for this counselling from now on.',
				'The person seeking advice has been informed in the application.'
			]
		},
		panel: [
			{
				label: 'Bisherige Zuständigkeit',
				value: '${name_from_consultant}'
			}
		],
		cta: '${url}'
	},
	{
		file: 'free-text',
		id: 'mitteilung',
		model: ['subject', 'text', 'url'],
		headline: '${subject}',
		body: '${text}',
		// The subject and the preview line are the same string here: an
		// administrator writes one subject, and a preheader repeating it beats
		// a preheader dumping the whole message onto the lock screen.
		values: {
			messageSubject: '${subject}',
			messagePreview: '${subject}'
		},
		cta: '${url}'
	}
];

/**
 * One file per language, taken from the catalogue rather than listed here.
 *
 * Upstream names its templates `<file>.html` for the default language and
 * `<file>.<lang>.html` for the rest, so this set can carry one tone per
 * language and nothing that is still waiting for a human —
 * `EMAIL_LANGUAGE_LOCALES` decides both. A language signed off in
 * `translationReview.json` reaches MailService without this file being touched;
 * `adapt` below fails the build if its copy overrides have not caught up.
 */
const LOCALES: { locale: EmailLocale; suffix: string }[] =
	EMAIL_LANGUAGE_LOCALES.map((locale) => ({
		locale,
		suffix:
			locale === EMAIL_SOURCE_LOCALE
				? ''
				: `.${EMAIL_LOCALE_LANG[locale]}`
	}));

/**
 * Rebuilds the content against what upstream actually sends.
 *
 * Every remaining `{{placeholder}}` is a brand value, which the mounted
 * template set resolves from the tenant attributes upstream already supplies
 * (`tenant_name`, `tenant_urldatenschutz`, `tenant_urlimpressum`) or from a
 * default. Those are mapped after rendering.
 */
const adapt = (
	content: EmailContent,
	template: MailServiceTemplate,
	locale: EmailLocale
): EmailContent => {
	// A template that rewrites its copy has to rewrite it in every language it
	// is emitted in. Falling back to the designed paragraphs would put a
	// counsellor's name back into a sentence upstream cannot fill, and falling
	// back to German would put German into a Turkish mail — so neither.
	if (template.paragraphs && !template.paragraphs[locale]) {
		throw new Error(
			`${template.file}: no ${locale} copy override. This template rewrites ` +
				'its paragraphs for the values upstream actually sends, and ' +
				`${locale} is now released, so it needs its own wording.`
		);
	}

	return {
		...content,
		headline: template.headline ?? content.headline,
		paragraphs: template.body
			? [template.body]
			: (template.paragraphs?.[locale] ?? content.paragraphs),
		panel: template.panel,
		code: undefined,
		cta: template.cta
			? { label: content.cta?.label ?? 'Öffnen', href: template.cta }
			: undefined
	};
};

/** Brand values upstream can supply, and what to fall back to when it cannot. */
const BRAND: Record<string, string> = {
	platformName: '${tenant_name}',
	orgName: '${tenant_name}',
	orgAddress: '',
	contactLine: '',
	logoUrl: '',
	primaryColor: '#a5000a',
	accentColor: '#cc1e1c',
	privacyUrl: '${tenant_urldatenschutz}',
	imprintUrl: '${tenant_urlimpressum}',
	settingsUrl: '${url}',
	unsubscribeUrl: '${url}',
	appUrl: '${url}',
	requestUrl: '${url}',
	messageUrl: '${url}',
	loginUrl: '${url}'
};

/**
 * Checks that a rendered template only references variables the sender puts on
 * the wire, plus the tenant attributes that always travel with them.
 */
const TENANT_ATTRIBUTES = [
	'tenant_name',
	'tenant_claim',
	'tenant_urldatenschutz',
	'tenant_urlimpressum'
];

const run = async () => {
	await rm(outDir, { recursive: true, force: true });
	await mkdir(outDir, { recursive: true });

	let written = 0;
	const report: string[] = [];

	for (const template of TEMPLATES) {
		const allowed = new Set([...template.model, ...TENANT_ATTRIBUTES]);

		for (const { locale, suffix } of LOCALES) {
			const content = adapt(
				EMAIL_CONTENT[locale][template.id],
				template,
				locale
			);
			let html = renderEmailHtml(content, {
				brand: emailDefaultBrand,
				lang: EMAIL_LOCALE_LANG[locale]
			});

			for (const [placeholder, value] of Object.entries({
				...(template.values ?? {}),
				...BRAND
			})) {
				html = html.split(`{{${placeholder}}}`).join(value);
			}

			const leftover = html.match(/\{\{\s*[\w.]+\s*\}\}/g);
			if (leftover) {
				throw new Error(
					`${template.file}${suffix}: no MailService value for ` +
						`${Array.from(new Set(leftover)).join(', ')}`
				);
			}

			// Now that every value is a `${…}` expression, hand the markup to
			// the Thymeleaf rewrite so attributes get their th:* twins.
			const thymeleaf = toEmailDialectHtml(
				html.replace(/\$\{([\w.]+)\}/g, '{{$1}}'),
				'thymeleaf'
			);

			for (const used of new Set(
				Array.from(thymeleaf.matchAll(/\$\{([\w.]+)\}/g)).map(
					(match) => match[1]
				)
			)) {
				if (!allowed.has(used)) {
					throw new Error(
						`${template.file}${suffix} references \${${used}}, which ` +
							'the sending supplier does not put on the wire. ' +
							`It sends: ${template.model.join(', ')}.`
					);
				}
			}

			await writeFile(
				path.join(outDir, `${template.file}${suffix}.html`),
				thymeleaf,
				'utf8'
			);
			written += 1;
		}

		report.push(
			`| \`${template.file}\` | \`${template.id}\` | ${template.model
				.map((key) => `\`${key}\``)
				.join(' ')} |`
		);
	}

	await writeFile(
		path.join(outDir, 'README.md'),
		`# MailService template set

Generated — do not edit by hand. Run \`npm run emails:mailservice\`.

Mounted over the upstream Online-Beratung mail service's \`templates/\`
directory; see ADR-020 for why an override rather than a fork.

German is \`<name>.html\`, English \`<name>.en.html\`, matching upstream's layout.

## The model contract

Each template consumes only what the sending supplier in ORISO-UserService puts
on the wire. The build fails if a template references anything else, because a
missing model variable renders as a blank line rather than as an error.

| Template | Designed as | Model variables |
| --- | --- | --- |
${report.join('\n')}

Tenant attributes (\`tenant_name\`, \`tenant_claim\`, \`tenant_urldatenschutz\`,
\`tenant_urlimpressum\`) travel with every mail when multitenancy is on.

## What upstream sends that ORISO does not

Upstream also ships \`message-notification-consultant\`,
\`message-notification-asker\` and \`feedback-message-notification\`. **This
UserService never triggers them** — the only template ids it sends are the seven
above. They are left untouched by the override.

## Not covered

\`name\` / \`name_recipient\` reach every template and are deliberately unused: no
mail in the design system opens with a salutation. Adding one is a copy
decision, not a technical gap.
`,
		'utf8'
	);

	// eslint-disable-next-line no-console
	console.log(
		`emails: wrote ${written} MailService templates to ${path.relative(
			process.cwd(),
			outDir
		)}`
	);
};

run().catch((error) => {
	// eslint-disable-next-line no-console
	console.error(String(error instanceof Error ? error.message : error));
	process.exitCode = 1;
});
