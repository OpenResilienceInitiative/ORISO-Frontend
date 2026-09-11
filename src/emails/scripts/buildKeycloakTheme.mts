/**
 * Emits the Keycloak e-mail theme from the design system.
 *
 *   npm run emails:keycloak
 *
 * Keycloak is the one consumer that cannot take the generated templates as they
 * are, for two reasons:
 *
 *  1. It resolves copy through its own message bundle
 *     (`messages_<lang>.properties`) and picks the language itself. A template
 *     with the German copy baked in would need a second template for English,
 *     and Keycloak has no mechanism to choose between them.
 *  2. It supplies its own model variables — `otp`, `ttl`, `link`,
 *     `linkExpiration` — rather than the placeholder names the rest of the
 *     platform uses.
 *
 * So this emits the *skeleton* from the kit and the *copy* into Keycloak's
 * bundle: one source of truth for both, and Keycloak's locale switching still
 * works. The alternative — hand-writing the FTL to look like the design system
 * — is what produced the four different skeletons this epic exists to remove.
 *
 * Output: `src/emails/dist/keycloak/email/{html,text,messages}` — the exact
 * shape of a Keycloak theme's email directory, so it can be copied in whole.
 */

import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EMAIL_CONTENT, EmailId, EmailLocale } from '../index';
import {
	EmailContent,
	renderEmailHtml,
	renderEmailText
} from '../kit/emailTemplate';
import { emailDefaultBrand } from '../kit/emailTokens';

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(here, '../dist/keycloak/email');

/**
 * Brand values and legal links become theme properties.
 *
 * Keycloak templates are per-realm and a realm has no Träger, so per-Träger
 * branding on this path is out of scope (ADR-021). But an operator still has to
 * be able to set a logo and an imprint link without editing a generated file,
 * and `${properties.x}` reading from `theme.properties` is Keycloak's own
 * mechanism for exactly that.
 */
const themeDefaults: Record<string, string> = {
	orisoPlatformName: 'Online-Beratung',
	orisoOrgName: 'ORISO',
	orisoOrgAddress: '',
	orisoContactLine: '',
	orisoLogoUrl: '',
	orisoPrimaryColor: '#a5000a',
	orisoAccentColor: '#cc1e1c',
	orisoPrivacyUrl: 'https://app.oriso.org/datenschutz',
	orisoImprintUrl: 'https://app.oriso.org/impressum',
	orisoSettingsUrl: 'https://app.oriso.org/profile/settings',
	orisoUnsubscribeUrl: 'https://app.oriso.org/profile/settings/notifications',
	orisoLoginUrl: 'https://app.oriso.org/login',
	orisoAppUrl: 'https://app.oriso.org'
};

const themeProperty = (placeholder: string) =>
	`oriso${placeholder.charAt(0).toUpperCase()}${placeholder.slice(1)}`;

/**
 * A theme-property lookup that carries its own default.
 *
 * `theme.properties` is an *override*, not a requirement: the Helm chart mounts
 * `email/{html,messages,text}` and no theme.properties at all, so a template
 * that depended on it would render a button with an empty `background-color` —
 * that is, no button. The parentheses matter too: `${properties.x!''}` defaults
 * only the last step and dies if `properties` itself is missing.
 */
const themeLookup = (placeholder: string): string => {
	const key = themeProperty(placeholder);
	const fallback = (themeDefaults[key] ?? '').replace(/'/g, "\\'");
	return `(properties.${key})!'${fallback}'`;
};

/** Which mails Keycloak sends, and what it calls the values they need. */
const TEMPLATES: {
	id: EmailId;
	file: string;
	/** Prefix for this template's message keys. */
	name: string;
	/**
	 * The key the *sender* looks up for the subject. Not ours to choose: the
	 * vendored OTP SPI calls `send("emailSubject", …)` and Keycloak's own reset
	 * flow uses `passwordResetSubject`. Renaming either loses the subject line.
	 */
	subjectKey: string;
	/** `{{kit placeholder}}` → FreeMarker expression Keycloak provides. */
	variables: Record<string, string>;
	/** Drop the call to action — see `einmalcode` below. */
	dropCta?: boolean;
}[] = [
	{
		id: 'einmalcode',
		file: 'otp-email',
		name: 'orisoOtp',
		subjectKey: 'emailSubject',
		// No button: the recipient is already in the window that asked for the
		// code, and a link back to the login screen would compete with the flow
		// they are halfway through.
		dropCta: true,
		variables: {
			otpCode: '${otp}',
			// Keycloak passes the code's lifetime in minutes as `ttl`.
			expiryMinutes: '${ttl}'
		}
	},
	{
		id: 'passwort-zuruecksetzen',
		file: 'password-reset',
		name: 'orisoReset',
		subjectKey: 'passwordResetSubject',
		variables: {
			resetUrl: '${link}',
			expiryHours: '${linkExpirationFormatter(linkExpiration)}'
		}
	}
];

/**
 * The message key for each string of the content model.
 *
 * Namespaced per template: Keycloak resolves one bundle for the whole theme, so
 * unprefixed keys would let the second template silently overwrite the first.
 */
const keysFor = (name: string, subjectKey: string) => ({
	subject: subjectKey,
	headline: `${name}Headline`,
	paragraph: (index: number) => `${name}Body${index + 1}`,
	panelLabel: (index: number) => `${name}PanelLabel${index + 1}`,
	codeLabel: `${name}CodeLabel`,
	ctaLabel: `${name}CtaLabel`,
	footnote: `${name}Footnote`,
	assurance: `${name}Assurance`,
	offeredBy: `${name}OfferedBy`,
	footerLink: (index: number) => `${name}FooterLink${index + 1}`,
	automatedNote: `${name}AutomatedNote`
});

type Keys = ReturnType<typeof keysFor>;

/** A sentinel the renderer will escape-safely carry through to the output. */
const marker = (key: string) => `@@${key}@@`;

/**
 * The content model with every human string swapped for a marker.
 *
 * Rendering *this* gives the skeleton; the real content gives the properties
 * files. Both come from the same object, so a copy change lands in both.
 */
const keyed = (
	content: EmailContent,
	KEYS: Keys,
	dropCta: boolean
): EmailContent => ({
	subject: marker(KEYS.subject),
	preheader: '',
	headline: marker(KEYS.headline),
	paragraphs: content.paragraphs.map((_, i) => marker(KEYS.paragraph(i))),
	panel: content.panel?.map((row, i) => ({
		label: marker(KEYS.panelLabel(i)),
		value: row.value
	})),
	code: content.code
		? { label: marker(KEYS.codeLabel), value: content.code.value }
		: undefined,
	cta:
		content.cta && !dropCta
			? { label: marker(KEYS.ctaLabel), href: content.cta.href }
			: undefined,
	footnote: content.footnote ? marker(KEYS.footnote) : undefined,
	assurance: marker(KEYS.assurance),
	footer: {
		offeredBy: marker(KEYS.offeredBy),
		links: content.footer.links.map((link, i) => ({
			label: marker(KEYS.footerLink(i)),
			href: link.href
		})),
		automatedNote: marker(KEYS.automatedNote)
	}
});

/** Every message key with its value, for one locale. */
const messages = (
	content: EmailContent,
	KEYS: Keys,
	dropCta: boolean
): Record<string, string> => {
	const out: Record<string, string> = {
		[KEYS.subject]: content.subject,
		[KEYS.headline]: content.headline,
		[KEYS.assurance]: content.assurance,
		[KEYS.offeredBy]: content.footer.offeredBy,
		[KEYS.automatedNote]: content.footer.automatedNote
	};
	content.paragraphs.forEach((text, i) => {
		out[KEYS.paragraph(i)] = text;
	});
	content.panel?.forEach((row, i) => {
		out[KEYS.panelLabel(i)] = row.label;
	});
	if (content.code) {
		out[KEYS.codeLabel] = content.code.label;
	}
	if (content.cta && !dropCta) {
		out[KEYS.ctaLabel] = content.cta.label;
	}
	if (content.footnote) {
		out[KEYS.footnote] = content.footnote;
	}
	content.footer.links.forEach((link, i) => {
		out[KEYS.footerLink(i)] = link.label;
	});
	return out;
};

/** Turns kit placeholders and copy markers into what Keycloak understands. */
const finish = (
	source: string,
	variables: Record<string, string>,
	messageArgs: Record<string, string[]>,
	freemarkerEscape: boolean
): string => {
	let out = source;

	// Kit placeholder → the expression Keycloak actually provides.
	for (const [placeholder, expression] of Object.entries(variables)) {
		out = out.split(`{{${placeholder}}}`).join(expression);
	}

	// Everything still in `{{…}}` is a brand value or a legal link, which an
	// operator sets in theme.properties.
	out = out.replace(
		/\{\{\s*([\w.]+)\s*\}\}/g,
		(_, placeholder: string) => `\${${themeLookup(placeholder)}}`
	);

	// Marker → message lookup, carrying whatever theme properties that string
	// interpolates. `?no_esc` because the bundle is ours, not user input.
	out = out.replace(/@@([A-Za-z0-9]+)@@/g, (_, key: string) => {
		const args = (messageArgs[key] ?? [])
			.map((expression) => `, ${expression}`)
			.join('');
		const call = `msg("${key}"${args})`;
		return freemarkerEscape ? `\${${call}?no_esc}` : `\${${call}}`;
	});

	return out;
};

/**
 * Splits a copy string into a MessageFormat pattern and the theme properties it
 * needs as arguments.
 *
 * A `.properties` value cannot reference `${properties.x}`, so
 * "{{platformName}} ist ein Angebot von {{orgName}}." becomes the pattern
 * "{0} ist ein Angebot von {1}." plus the two property names, and the template
 * calls `msg(key, properties.orisoPlatformName, properties.orisoOrgName)`.
 */
const toMessageFormat = (
	value: string,
	variables: Record<string, string>
): { pattern: string; args: string[] } => {
	const args: string[] = [];
	// MessageFormat treats a single quote as an escape character, so any
	// apostrophe in the copy has to be doubled or the rest of the string
	// disappears.
	const pattern = value
		.replace(/'/g, "''")
		.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, placeholder: string) => {
			// A placeholder in a copy string is either a value Keycloak passes
			// in — `${otp}`, `${link}` — or a theme property. Getting this wrong
			// turns a link expiry into a blank.
			const expression =
				variables[placeholder] !== undefined
					? variables[placeholder].replace(/^\$\{(.*)\}$/, '$1')
					: themeLookup(placeholder);
			const existing = args.indexOf(expression);
			if (existing >= 0) {
				return `{${existing}}`;
			}
			args.push(expression);
			return `{${args.length - 1}}`;
		});
	return { pattern, args };
};

/** Escapes a value for a Java `.properties` file. */
const propertiesValue = (value: string): string =>
	value
		.replace(/\\/g, '\\\\')
		.replace(/\n/g, '\\n')
		.replace(/:/g, '\\:')
		.replace(/=/g, '\\=');

const KEYCLOAK_LOCALES: { locale: EmailLocale; lang: string }[] = [
	{ locale: 'de-sie', lang: 'de' },
	{ locale: 'en', lang: 'en' }
];

const run = async () => {
	await rm(outDir, { recursive: true, force: true });
	await mkdir(path.join(outDir, 'html'), { recursive: true });
	await mkdir(path.join(outDir, 'text'), { recursive: true });
	await mkdir(path.join(outDir, 'messages'), { recursive: true });

	const bundles: Record<string, Record<string, string>> = {};
	const messageArgs: Record<string, string[]> = {};
	const pending: {
		template: (typeof TEMPLATES)[number];
		skeleton: EmailContent;
		options: { brand: typeof emailDefaultBrand; lang: string };
	}[] = [];
	let written = 0;

	// The argument list per key comes from the German copy; the English copy
	// interpolates the same properties in the same order, and the build fails
	// below if it ever does not.

	for (const template of TEMPLATES) {
		// The skeleton is language-independent: the copy is looked up at render
		// time, so one file serves every locale Keycloak knows.
		const KEYS = keysFor(template.name, template.subjectKey);
		const skeleton = keyed(
			EMAIL_CONTENT['de-sie'][template.id],
			KEYS,
			template.dropCta === true
		);
		const options = {
			brand: emailDefaultBrand,
			lang: '${locale.language}'
		};

		pending.push({ template, skeleton, options });

		for (const { locale, lang } of KEYCLOAK_LOCALES) {
			const raw = messages(
				EMAIL_CONTENT[locale][template.id],
				KEYS,
				template.dropCta === true
			);
			const converted: Record<string, string> = {};
			for (const [key, value] of Object.entries(raw)) {
				const { pattern, args } = toMessageFormat(
					value,
					template.variables
				);
				converted[key] = pattern;
				const known = messageArgs[key];
				if (known === undefined) {
					messageArgs[key] = args;
				} else if (known.join() !== args.join()) {
					throw new Error(
						`Keycloak bundle: "${key}" interpolates ` +
							`[${args.join(', ')}] in ${lang} but ` +
							`[${known.join(', ')}] elsewhere — the argument ` +
							'order has to match across locales.'
					);
				}
			}
			bundles[lang] = { ...bundles[lang], ...converted };
		}
	}

	for (const { template, skeleton, options } of pending) {
		await writeFile(
			path.join(outDir, 'html', `${template.file}.ftl`),
			// The output format has to be declared: `?no_esc` is a syntax error
			// unless FreeMarker knows it is producing markup, and whether the
			// surrounding Configuration sets one is not ours to assume.
			'<#ftl output_format="HTML">\n' +
				finish(
					renderEmailHtml(skeleton, options),
					template.variables,
					messageArgs,
					true
				),
			'utf8'
		);
		await writeFile(
			path.join(outDir, 'text', `${template.file}.ftl`),
			'<#ftl output_format="plainText">\n' +
				finish(
					// A fixed rule: the underline in the text part is sized from
					// the headline, and here the headline is a marker.
					renderEmailText(skeleton, options).replace(
						/^=+$/m,
						'='.repeat(40)
					),
					template.variables,
					messageArgs,
					false
				),
			'utf8'
		);
		written += 2;
	}

	for (const { lang } of KEYCLOAK_LOCALES) {
		const body = Object.entries(bundles[lang])
			.map(([key, value]) => `${key}=${propertiesValue(value)}`)
			.join('\n');
		await writeFile(
			path.join(outDir, 'messages', `messages_${lang}.properties`),
			`# Generated from the ORISO e-mail design system — do not edit by hand.\n` +
				`# Run 'npm run emails:keycloak' in ORISO-Frontend after changing the copy.\n` +
				`${body}\n`,
			'utf8'
		);
		written += 1;
	}

	await writeFile(
		path.join(outDir, 'theme.properties'),
		'parent=base\n' +
			'# Generated defaults from the ORISO e-mail design system.\n' +
			'# An operator may override any of these per realm.\n' +
			Object.entries(themeDefaults)
				.map(([key, value]) => `${key}=${value}`)
				.join('\n') +
			'\n',
		'utf8'
	);
	written += 1;

	// eslint-disable-next-line no-console
	console.log(
		`emails: wrote ${written} Keycloak theme files to ${path.relative(
			process.cwd(),
			outDir
		)}`
	);
};

run().catch((error) => {
	// eslint-disable-next-line no-console
	console.error(error);
	process.exitCode = 1;
});
