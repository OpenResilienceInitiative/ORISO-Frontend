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
	it('sizes the confirmation animation without repainting it green', () => {
		const scss = dialogStyles();
		const iconStart = scss.indexOf('&__successIcon');
		const successIcon = scss.slice(
			iconStart,
			scss.indexOf('}', iconStart) + 1
		);

		// The animation carries its own M3 roles; the dialog only boxes it.
		expect(successIcon).toContain('width: 120px !important;');
		expect(successIcon).toContain('height: 120px !important;');
		expect(successIcon).not.toContain('--m3-success');
		expect(successIcon).not.toContain('#0a882f');
	});

	it('keeps the lone close action on one right-aligned row', () => {
		const scss = dialogStyles();

		expect(scss).toMatch(
			/&__actions--single\s*\{[^}]*justify-content:\s*flex-end;/
		);
		expect(scss).toMatch(
			/&__primaryAction\s*\{[^}]*white-space:\s*nowrap\s*!important;/
		);
	});

	it('gives the primary action the remaining width however many icon buttons precede it', () => {
		const scss = dialogStyles();

		// The forced setup hides the close button. With fixed 72px 72px 1fr
		// tracks the primary action then landed in a 72px track and was cut off.
		expect(scss).not.toMatch(/grid-template-columns:\s*72px 72px 1fr/);
		expect(scss).toMatch(/&__actions\s*\{[^}]*display:\s*flex;/);
		expect(scss).toMatch(/&__primaryAction\s*\{[^}]*flex:\s*1 1 auto;/);
	});

	it('grows the container, not the type, from tablet width up', () => {
		const scss = dialogStyles();
		const wide = scss.slice(scss.indexOf('@media (width >= 768px)'));

		expect(wide).toMatch(/&__paper\s*\{[^}]*width:\s*min\(650px,/);
		expect(wide).toMatch(/&__paper\s*\{[^}]*padding:\s*44px;/);
		expect(wide).not.toMatch(/font-size/);
	});
});
