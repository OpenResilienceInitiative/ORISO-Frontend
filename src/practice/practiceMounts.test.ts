import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

const appRoot = resolve(
	dirname(fileURLToPath(import.meta.url)),
	'../components/app'
);
const read = (file: string) => readFileSync(resolve(appRoot, file), 'utf8');

/**
 * Source-level contract for where the practice area plugs into the app. A full
 * render of `AuthenticatedApp` or `Routing` needs the whole provider stack, so
 * this pins the mount points cheaply; the parts themselves have their own tests.
 */
describe('practice mount points', () => {
	it('wraps Routing in the practice layer inside the authenticated app, so navigation never remounts it', () => {
		const source = read('AuthenticatedApp.tsx');

		expect(source).toMatch(
			/<PracticeLayer>\s*<Routing\b[^>]*\/>\s*<\/PracticeLayer>/
		);
	});

	it('renders the banner and the sandbox slot in the layout route, next to the tour host', () => {
		const source = read('Routing.tsx');
		const shell = source.slice(source.indexOf('<Walkthrough />'));

		expect(shell).toMatch(
			/<Walkthrough \/>\s*<PracticeBanner \/>\s*<PracticeSurface \/>\s*<E2EEProvider>/
		);
	});
});
