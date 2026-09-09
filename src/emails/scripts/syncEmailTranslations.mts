/**
 * Records what each translation was translated from.
 *
 *   npm run emails:sync           # re-stamp the manifest
 *   npm run emails:sync -- --check  # report drift, write nothing
 *
 * Writes `src/emails/content/translationManifest.json`: for every locale and
 * every occasion, the fingerprint of the German source at translation time and
 * the fingerprint of the translation itself. `emailTranslationSync.test.ts`
 * compares those against the content on every run, so a German string that
 * moves without its translations turns the build red instead of shipping five
 * languages that quietly say last month's thing.
 *
 * The one rule worth stating out loud: **a re-stamp is refused when the German
 * changed and the translation did not.** Without that, `npm run emails:sync`
 * would be a one-command way to make stale copy look current, which is exactly
 * the failure this whole mechanism exists to prevent. `--force` overrides it
 * for the real case where a German edit genuinely does not reach a given
 * language (fixing a German typo, say) — and prints what it forced.
 */

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	EMAIL_CONTENT,
	EMAIL_IDS,
	EMAIL_LOCALE_PROVENANCE,
	EMAIL_LOCALE_RELEASE,
	EMAIL_SOURCE_LOCALE,
	EMAIL_TRANSLATED_LOCALES,
	EmailTranslationManifest,
	EmailTranslationReview,
	emailFingerprint,
	emailOccasionFingerprint,
	emailReviewGaps
} from '../index';

const here = path.dirname(fileURLToPath(import.meta.url));
const manifestPath = path.resolve(here, '../content/translationManifest.json');
const reviewPath = path.resolve(here, '../content/translationReview.json');

const args = process.argv.slice(2);
const check = args.includes('--check');
const force = args.includes('--force');

const readJson = async <T,>(file: string, fallback: T): Promise<T> => {
	try {
		return JSON.parse(await readFile(file, 'utf8')) as T;
	} catch {
		return fallback;
	}
};

const run = async () => {
	const previous = await readJson<EmailTranslationManifest>(manifestPath, {
		source: EMAIL_SOURCE_LOCALE,
		locales: {}
	});
	const review = await readJson<EmailTranslationReview>(reviewPath, {
		locales: {}
	});

	const next: EmailTranslationManifest = {
		source: EMAIL_SOURCE_LOCALE,
		locales: {}
	};

	const stale: string[] = [];
	const restamped: string[] = [];
	const added: string[] = [];

	for (const locale of EMAIL_TRANSLATED_LOCALES) {
		const occasions: EmailTranslationManifest['locales'][string]['occasions'] =
			{};

		for (const id of EMAIL_IDS) {
			const source = emailOccasionFingerprint(
				EMAIL_CONTENT[EMAIL_SOURCE_LOCALE][id]
			);
			const target = emailOccasionFingerprint(EMAIL_CONTENT[locale][id]);
			const before = previous.locales[locale]?.occasions[id];

			if (!before) {
				added.push(`${locale}/${id}`);
				occasions[id] = { source, target };
				continue;
			}

			const sourceMoved = before.source !== source;
			const targetMoved = before.target !== target;

			if (sourceMoved && !targetMoved && !force) {
				// The case this script exists to refuse.
				stale.push(`${locale}/${id}`);
				occasions[id] = before;
				continue;
			}

			if (sourceMoved || targetMoved) restamped.push(`${locale}/${id}`);
			occasions[id] = { source, target };
		}

		next.locales[locale] = {
			provenance: EMAIL_LOCALE_PROVENANCE[locale],
			release: EMAIL_LOCALE_RELEASE[locale],
			occasions
		};
	}

	// The human-review side: which protected strings still have no signature,
	// and which signatures now point at a string that has since been edited.
	const unsigned: string[] = [];
	const orphaned: string[] = [];

	for (const locale of EMAIL_TRANSLATED_LOCALES) {
		if (EMAIL_LOCALE_PROVENANCE[locale] !== 'machine') continue;

		const gaps = emailReviewGaps(
			EMAIL_CONTENT[locale],
			EMAIL_IDS,
			review.locales[locale] ?? {}
		);

		gaps.unsigned.forEach((entry) =>
			unsigned.push(
				`${locale} ${emailFingerprint(entry.value)} ${entry.path}  "${entry.value.slice(0, 56)}"`
			)
		);
		gaps.orphaned.forEach((signature) =>
			orphaned.push(`${locale} "${signature.text.slice(0, 48)}"`)
		);
	}

	const report = (label: string, items: string[]) => {
		if (items.length === 0) return;
		// eslint-disable-next-line no-console
		console.log(
			`emails:sync ${label} (${items.length})\n  ${items.join('\n  ')}`
		);
	};

	report('added', added);
	report('re-stamped', restamped);
	report('unsigned protected strings', unsigned);
	report('signatures pointing at edited copy', orphaned);

	if (stale.length > 0) {
		// eslint-disable-next-line no-console
		console.error(
			`emails:sync refused: the German copy moved and the translation did not.\n  ${stale.join(
				'\n  '
			)}\nTranslate those occasions, or re-stamp deliberately with --force.`
		);
		process.exitCode = 1;
		return;
	}

	if (check) {
		const drift = [...added, ...restamped];
		if (drift.length > 0) {
			// eslint-disable-next-line no-console
			console.error(
				'emails:sync --check: the manifest is out of date. Run npm run emails:sync.'
			);
			process.exitCode = 1;
		}
		return;
	}

	await writeFile(manifestPath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
	// eslint-disable-next-line no-console
	console.log(
		`emails: stamped ${EMAIL_TRANSLATED_LOCALES.length} locales × ${EMAIL_IDS.length} occasions in ${path.relative(
			process.cwd(),
			manifestPath
		)}`
	);
};

run().catch((error) => {
	// eslint-disable-next-line no-console
	console.error(error);
	process.exitCode = 1;
});
