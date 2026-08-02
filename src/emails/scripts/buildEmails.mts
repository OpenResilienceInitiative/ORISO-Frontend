/**
 * Emits the send-ready template files from the kit.
 *
 *   npm run emails:build
 *
 * Writes `src/emails/dist/<tone>/<id>.html` and `.txt` — 7 occasions × 3 tone
 * variants × 2 MIME parts = 42 files, all still carrying their
 * `{{placeholders}}`. Those files are the artefact the sending services consume;
 * Storybook renders the same kit, so a preview and a send can no longer drift.
 *
 * The output is committed, so `git diff` after a run is the review surface: any
 * change to an atom shows up as a diff in every mail it touches.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EMAIL_IDS, EMAIL_LOCALES, buildEmail } from '../index';

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(here, '../dist');

const readme = `# Send-ready e-mail templates

Generated — do not edit by hand. Run \`npm run emails:build\` after changing
anything under \`src/emails/\`.

Layout: \`<tone>/<id>.html\` and \`<tone>/<id>.txt\`.

Tones: ${EMAIL_LOCALES.join(', ')}.
Occasions: ${EMAIL_IDS.join(', ')}.

Both MIME parts are generated from one content model, so the plain-text twin
cannot drift from the HTML. Placeholders use \`{{mustache}}\` syntax; see
\`src/emails/index.ts\` for the full list and \`Email/Foundations → Catalogue\` in
Storybook for which mail needs which.
`;

const run = async () => {
	let written = 0;

	for (const locale of EMAIL_LOCALES) {
		await mkdir(path.join(outDir, locale), { recursive: true });

		for (const id of EMAIL_IDS) {
			const built = buildEmail(id, locale);
			await writeFile(
				path.join(outDir, locale, `${id}.html`),
				built.html,
				'utf8'
			);
			await writeFile(
				path.join(outDir, locale, `${id}.txt`),
				built.text,
				'utf8'
			);
			written += 2;
		}
	}

	await writeFile(path.join(outDir, 'README.md'), readme, 'utf8');
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
