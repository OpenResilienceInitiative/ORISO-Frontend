import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const dialogStyles = () =>
	fs.readFileSync(
		path.join(
			process.cwd(),
			'src/components/twoFactorAuth/twoFactorSetupDialog.styles.scss'
		),
		'utf8'
	);

describe('two-factor setup dialog responsive layout', () => {
	it('scopes compact columns, connectors, and wrapping to the mobile stepper', () => {
		const scss = dialogStyles();
		const mobileStyles = scss.slice(
			scss.indexOf('@media (width <= 520px)')
		);

		expect(mobileStyles).toMatch(
			/&__paper\s*\{[^}]*width:\s*min\(368px, calc\(100vw - 22px\)\)\s*!important;[^}]*max-width:\s*calc\(100vw - 22px\)\s*!important;[^}]*margin:\s*11px\s*!important;/
		);
		expect(mobileStyles).toMatch(
			/&__stepper\s*\{[^}]*grid-auto-columns:\s*56px;[^}]*column-gap:\s*8px;/
		);
		expect(mobileStyles).toMatch(
			/&__stepUnit::after\s*\{[^}]*left:\s*calc\(50% \+ 18px\);[^}]*right:\s*calc\(-50% \+ 10px\);/
		);
		expect(mobileStyles).toMatch(
			/&__stepLabel\s*\{[^}]*font-size:\s*9px\s*!important;[^}]*line-height:\s*12px\s*!important;[^}]*white-space:\s*normal;[^}]*overflow-wrap:\s*anywhere;/
		);
	});
});
