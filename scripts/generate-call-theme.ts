/**
 * Writes the Element Call theme stylesheet (Frontend#897).
 *
 * Thin CLI wrapper: the mapping and the CSS live in
 * `src/utils/theme/callTheme.ts`, so they stay unit-testable and this
 * file only decides where the artefact lands.
 *
 * Usage:
 *   npm run generate:call-theme                    # default target
 *   npm run generate:call-theme -- --out <path>    # e.g. the fork's src/
 *   npm run generate:call-theme -- --check         # CI/drift check
 */
import * as fs from 'fs';
import * as path from 'path';
import {
	buildCallThemeCss,
	CALL_THEME_ARTEFACT_PATH
} from '../src/utils/theme/callTheme';

/** The ORISO default tenant. Other tenants arrive at runtime, not here. */
const DEFAULT_SEED = '#A5000A';

/**
 * Checked-in copy. `ORISO-ElementCall` consumes its own copy of this
 * file; regenerate with `--out` pointing at the fork after any engine
 * change. (The follow-up on #896 replaces the copy with a shared
 * package.) The location itself is shared with the drift test via
 * CALL_THEME_ARTEFACT_PATH.
 */
const DEFAULT_OUT = path.join(__dirname, '..', CALL_THEME_ARTEFACT_PATH);

const argValue = (flag: string): string | undefined => {
	const i = process.argv.indexOf(flag);
	return i === -1 ? undefined : process.argv[i + 1];
};

const main = (): void => {
	const seed = argValue('--seed') ?? DEFAULT_SEED;
	const out = path.resolve(argValue('--out') ?? DEFAULT_OUT);
	const css = buildCallThemeCss(seed);

	if (process.argv.includes('--check')) {
		const current = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '';
		if (current !== css) {
			console.error(
				`Call theme is out of date: ${out}\n` +
					'Run `npm run generate:call-theme` and commit the result.'
			);
			process.exit(1);
		}
		console.log(`Call theme is up to date: ${out}`);
		return;
	}

	fs.mkdirSync(path.dirname(out), { recursive: true });
	fs.writeFileSync(out, css, 'utf8');
	console.log(`Wrote ${out} (seed ${seed})`);
};

main();
