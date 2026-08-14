/**
 * Emits the send-ready template files from the kit.
 *
 *   npm run emails:build
 *
 * Writes `src/emails/dist/<dialect>/<tone>/<id>` for every occasion, in both
 * MIME parts and in every placeholder dialect the sending services need. Those
 * files are the artefact the services consume; Storybook renders the same kit
 * from the same content model, so a preview and a send cannot drift.
 *
 * The output is committed, so `git diff` after a run is the review surface: any
 * change to an atom shows up as a diff in every mail it touches.
 */

import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	EMAIL_AUDIENCE,
	EMAIL_CLASS,
	EMAIL_DIALECTS,
	EMAIL_DIALECT_INFO,
	EMAIL_IDS,
	EMAIL_LOCALES,
	EMAIL_LOCALE_LANG,
	buildEmail,
	emailIsUnsubscribable,
	listEmailPlaceholders
} from '../index';

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(here, '../dist');

const dialectTable = EMAIL_DIALECTS.map((dialect) => {
	const info = EMAIL_DIALECT_INFO[dialect];
	return `| \`${dialect}/\` | ${info.consumer} | \`${info.syntax}\` | \`.${info.extension.html}\` / \`.${info.extension.text}\` |`;
}).join('\n');

const readme = (
	placeholders: Record<string, string[]>
) => `# Send-ready e-mail templates

Generated — do not edit by hand. Run \`npm run emails:build\` after changing
anything under \`src/emails/\`.

Layout: \`<dialect>/<tone>/<id>.<ext>\`.

| Dialect | Consumer | Placeholder | Files |
| --- | --- | --- | --- |
${dialectTable}

Tones: ${EMAIL_LOCALES.join(', ')}.

Both MIME parts are generated from one content model, so the plain-text twin
cannot drift from the HTML, and all three dialects come from one renderer, so a
dialect cannot disagree with what Storybook shows.

## What each mail needs

| Occasion | Audience | Placeholders |
| --- | --- | --- |
${EMAIL_IDS.map(
	(id) =>
		`| \`${id}\` | ${EMAIL_AUDIENCE[id]} | ${placeholders[id]
			.map((token) => `\`${token}\``)
			.join(' ')} |`
).join('\n')}

Brand placeholders (\`platformName\`, \`primaryColor\`, \`accentColor\`,
\`logoUrl\`, \`orgName\`, \`orgAddress\`, \`contactLine\`) appear in every mail and
are omitted from the table.

## How a downstream repository picks this up

See \`docs/architecture/adr-020-email-template-distribution.md\`. In short: this directory
is the published artefact, consumed as a build input rather than copied by hand,
and a template change is reviewed as a diff in this repository before it reaches
any service.
`;

const BRAND_PLACEHOLDERS = new Set([
	'{{platformName}}',
	'{{primaryColor}}',
	'{{accentColor}}',
	'{{logoUrl}}',
	'{{orgName}}',
	'{{orgAddress}}',
	'{{contactLine}}'
]);

const run = async () => {
	// A removed occasion or a renamed dialect must not leave a stale file
	// behind that still looks send-ready.
	await rm(outDir, { recursive: true, force: true });

	let written = 0;
	const placeholders: Record<string, string[]> = {};

	for (const dialect of EMAIL_DIALECTS) {
		const info = EMAIL_DIALECT_INFO[dialect];

		for (const locale of EMAIL_LOCALES) {
			await mkdir(path.join(outDir, dialect, locale), {
				recursive: true
			});

			for (const id of EMAIL_IDS) {
				const built = buildEmail(id, locale, { dialect });

				if (dialect === 'plain' && locale === 'de-sie') {
					placeholders[id] = listEmailPlaceholders(built.html).filter(
						(token) => !BRAND_PLACEHOLDERS.has(token)
					);
				}

				await writeFile(
					path.join(
						outDir,
						dialect,
						locale,
						`${id}.${info.extension.html}`
					),
					built.html,
					'utf8'
				);
				await writeFile(
					path.join(
						outDir,
						dialect,
						locale,
						`${id}.${info.extension.text}`
					),
					built.text,
					'utf8'
				);
				written += 2;
			}
		}
	}

	// The consuming services need the subject and the preview line, and neither
	// belongs in the HTML file: a subject is a mail header, not a document. One
	// JSON at the root beats parsing <title> out of 21 templates.
	await writeFile(
		path.join(outDir, 'catalogue.json'),
		`${JSON.stringify(
			{
				dialects: EMAIL_DIALECTS,
				tones: EMAIL_LOCALES,
				mails: Object.fromEntries(
					EMAIL_IDS.map((id) => [
						id,
						{
							audience: EMAIL_AUDIENCE[id],
							class: EMAIL_CLASS[id],
							unsubscribable: emailIsUnsubscribable(id),
							placeholders: placeholders[id],
							tones: Object.fromEntries(
								EMAIL_LOCALES.map((locale) => {
									const built = buildEmail(id, locale);
									return [
										locale,
										{
											lang: EMAIL_LOCALE_LANG[locale],
											subject: built.subject,
											preheader: built.preheader
										}
									];
								})
							)
						}
					])
				)
			},
			null,
			2
		)}\n`,
		'utf8'
	);

	await writeFile(
		path.join(outDir, 'README.md'),
		readme(placeholders),
		'utf8'
	);
	// eslint-disable-next-line no-console
	console.log(
		`emails: wrote ${written} files to ${path.relative(process.cwd(), outDir)}`
	);
};

run().catch((error) => {
	// eslint-disable-next-line no-console
	console.error(error);
	process.exitCode = 1;
});
