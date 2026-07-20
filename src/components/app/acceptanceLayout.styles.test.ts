import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const navigationStyles = () =>
	fs.readFileSync(
		path.join(process.cwd(), 'src/components/app/navigation.styles.scss'),
		'utf8'
	);

describe('mobile navigation acceptance layout', () => {
	it('keeps language pinned immediately left of sticky logout', () => {
		const scss = navigationStyles();
		const mobileBlock = scss.slice(
			scss.indexOf('@media screen and (width < 900px)')
		);

		expect(mobileBlock).toContain('.navigation__item--nav-language');
		expect(mobileBlock).toMatch(
			/\.navigation__item--nav-language\s*\{[\s\S]*?position:\s*sticky;[\s\S]*?right:\s*72px;/
		);
		expect(mobileBlock).toMatch(
			/\.navigation__item--nav-logout\s*\{[\s\S]*?position:\s*sticky;[\s\S]*?right:\s*0;/
		);
	});
});
