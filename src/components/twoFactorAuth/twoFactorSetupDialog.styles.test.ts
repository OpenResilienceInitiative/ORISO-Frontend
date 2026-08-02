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

describe('two-factor setup dialog success step', () => {
	it('paints the success checkmark with the M3 brand role, not success green', () => {
		const scss = dialogStyles();
		const iconStart = scss.indexOf('&__successIcon');
		const successIcon = scss.slice(
			iconStart,
			scss.indexOf('}', iconStart) + 1
		);

		expect(successIcon).toContain('fill: var(--m3-primary, #a5000a);');
		expect(successIcon).not.toContain('--m3-success');
		expect(successIcon).not.toContain('#0a882f');
	});

	it('keeps the lone close action on one right-aligned row, desktop and mobile', () => {
		const scss = dialogStyles();

		expect(scss).toMatch(
			/&__actions--single\s*\{[^}]*grid-template-columns:\s*1fr;[^}]*justify-items:\s*end;/
		);
		expect(scss).toMatch(
			/&__primaryAction\s*\{[^}]*white-space:\s*nowrap\s*!important;/
		);

		// The mobile block re-declares the icon tracks, so it has to re-declare
		// the single-action override too or it silently wins by source order.
		const mobileStyles = scss.slice(
			scss.indexOf('@media (width <= 520px)')
		);
		expect(mobileStyles).toMatch(
			/&__actions--single\s*\{[^}]*grid-template-columns:\s*1fr;/
		);
	});
});
