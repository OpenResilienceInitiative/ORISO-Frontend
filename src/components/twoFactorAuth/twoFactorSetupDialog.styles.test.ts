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

const wideStyles = (scss: string) =>
	scss.slice(scss.indexOf('@media (width >= 768px)'));

const baseStyles = (scss: string) =>
	scss.slice(0, scss.indexOf('@media (width <= 520px)'));

const phoneStyles = (scss: string) =>
	scss.slice(
		scss.indexOf('@media (width <= 520px)'),
		scss.indexOf('@media (width >= 768px)')
	);

const fieldStyles = () =>
	fs.readFileSync(
		path.join(
			process.cwd(),
			'src/components/twoFactorAuth/accountSetupField.styles.scss'
		),
		'utf8'
	);

describe('two-factor setup dialog paper', () => {
	// The artboards are a 366px phone board and a 650px desktop board, so the
	// base block is the phone one and the media query grows it.
	it('is the phone board by default and the desktop board from 768px up', () => {
		const scss = dialogStyles();

		expect(baseStyles(scss)).toMatch(
			/&__paper\s*\{[^}]*width:\s*min\(366px, calc\(100vw - 24px\)\)\s*!important;[^}]*max-width:\s*calc\(100vw - 24px\)\s*!important;[^}]*margin:\s*12px\s*!important;[^}]*padding:\s*24px;/
		);
		expect(wideStyles(scss)).toMatch(
			/&__paper\s*\{[^}]*width:\s*min\(650px, calc\(100vw - 64px\)\)\s*!important;[^}]*padding:\s*44px;/
		);
	});

	// A short window must scroll the paper rather than push the action row and
	// the logout link out of reach.
	it('never grows past the window and scrolls instead', () => {
		const scss = dialogStyles();

		expect(baseStyles(scss)).toMatch(
			/&__paper\s*\{[^}]*max-height:\s*calc\(100vh - 24px\);/
		);
		expect(baseStyles(scss)).toMatch(
			/&__paper\s*\{[\s\S]*?overflow-y:\s*auto;/
		);
		expect(wideStyles(scss)).toMatch(
			/&__paper\s*\{[^}]*max-height:\s*calc\(100vh - 64px\);/
		);
	});

	it('grows the container, not the type, from tablet width up', () => {
		const wide = wideStyles(dialogStyles());

		expect(wide).toMatch(/&__paper\s*\{[^}]*width:\s*min\(650px,/);
		expect(wide).not.toMatch(/font-size/);
	});
});

describe('two-factor setup dialog chrome', () => {
	it('draws the two-step progress row from the artboards', () => {
		const scss = dialogStyles();

		expect(scss).toMatch(
			/&__progressMarker\s*\{[\s\S]*?width:\s*24px;[\s\S]*?border:\s*1\.5px solid var\(--m3-outline-variant, #c9c5c7\);/
		);
		expect(scss).toMatch(
			/&__progressStep--active\s*\{[\s\S]*?background:\s*var\(--m3-primary, #a5000a\);/
		);
	});

	it('gives the header a 56px tile with a 16px radius', () => {
		const scss = dialogStyles();

		expect(scss).toMatch(
			/&__headerTile\s*\{[\s\S]*?width:\s*56px;[\s\S]*?height:\s*56px;[\s\S]*?border-radius:\s*16px;/
		);
		expect(scss).toMatch(/&__title\s*\{[\s\S]*?font-size:\s*24px/);
	});

	it('tints grouped content with the card surface', () => {
		expect(dialogStyles()).toMatch(
			/&__card\s*\{[\s\S]*?border-radius:\s*12px;[\s\S]*?background:\s*var\(--m3-surface-container, #f1edee\);/
		);
	});

	it('sizes the five-step stepper circles at 32px', () => {
		expect(dialogStyles()).toMatch(
			/&__stepCircle\s*\{[\s\S]*?width:\s*32px;[\s\S]*?height:\s*32px;/
		);
	});
});

describe('two-factor setup dialog actions', () => {
	it('pairs a 64px back button with a 56px primary action', () => {
		const scss = dialogStyles();

		expect(scss).toMatch(
			/&__iconAction,\s*\n\s*&__primaryAction\s*\{[\s\S]*?height:\s*56px\s*!important;/
		);
		expect(scss).toMatch(
			/&__iconAction\s*\{[^}]*flex:\s*0 0 64px\s*!important;/
		);
	});

	// The forced setup hides the close button. With fixed 72px 72px 1fr tracks
	// the primary action landed in a 72px track and was cut off.
	it('gives the primary action the remaining width however many icon buttons precede it', () => {
		const scss = dialogStyles();

		expect(scss).not.toMatch(/grid-template-columns:\s*72px 72px 1fr/);
		expect(scss).toMatch(/&__actions\s*\{[^}]*display:\s*flex;/);
		expect(scss).toMatch(/&__primaryAction\s*\{[^}]*flex:\s*1 1 auto;/);
		expect(scss).toMatch(
			/&__actions--single\s*\{[^}]*justify-content:\s*flex-end;/
		);
	});

	it('keeps the logout a centred text link, not a third button', () => {
		expect(dialogStyles()).toMatch(
			/&__logout\s*\{[\s\S]*?align-self:\s*center;[\s\S]*?line-height:\s*44px\s*!important;/
		);
	});

	// White on the artboards' #b9bdc3 is 1.9:1, which nothing can read.
	it('keeps the disabled primary action legible', () => {
		const scss = dialogStyles();

		expect(scss).toMatch(/\$setup-disabled:\s*#e3e1e2;/);
		expect(scss).toMatch(/\$setup-disabled-text:\s*#5f6368;/);
		expect(scss).toMatch(
			/&\.Mui-disabled\s*\{[^}]*color:\s*\$setup-disabled-text\s*!important;/
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
});

// The five steps share about 60px each on a phone. At a fixed 11px nowrap the
// Russian labels — and every German one at 320px — left the paper.
describe('two-factor setup dialog stepper on a phone', () => {
	it('scopes the compact, wrapping labels to the mobile stepper', () => {
		const scss = dialogStyles();

		expect(baseStyles(scss)).toMatch(
			/&__stepLabel\s*\{[\s\S]*?font-size:\s*12px\s*!important;/
		);
		expect(baseStyles(scss)).not.toMatch(
			/&__stepLabel\s*\{[^}]*white-space:\s*nowrap;/
		);
		expect(phoneStyles(scss)).toMatch(
			/&__stepLabel\s*\{[^}]*font-size:\s*9px\s*!important;[^}]*line-height:\s*12px\s*!important;[^}]*white-space:\s*normal;[^}]*overflow-wrap:\s*anywhere;/
		);
	});

	it('gives every step the same share of the row', () => {
		expect(baseStyles(dialogStyles())).toMatch(
			/&__stepUnit\s*\{[\s\S]*?flex:\s*1 1 0;/
		);
	});
});

describe('account-setup field', () => {
	// The control's own outline is off, so without this the field would take
	// focus with nothing on screen to show for it.
	it('rings the box on focus, outside its state border', () => {
		expect(fieldStyles()).toMatch(
			/&:focus-within\s*\{[^}]*outline:\s*2px solid var\(--m3-primary, #a5000a\);[^}]*outline-offset:\s*2px;/
		);
	});

	it('keeps the error and ok borders on their own', () => {
		const scss = fieldStyles();

		expect(scss).toMatch(/&--error\s*\{[^}]*border:\s*2px solid #a3195b;/);
		expect(scss).toMatch(/&--ok\s*\{[^}]*border:\s*2px solid #1d6b3a;/);
	});
});
