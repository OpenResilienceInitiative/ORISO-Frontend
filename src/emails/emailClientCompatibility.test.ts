import { describe, expect, it } from 'vitest';
import { EMAIL_IDS, EMAIL_LOCALES, buildEmail } from './index';

/**
 * Static compatibility check against what e-mail clients actually support.
 *
 * This is not a substitute for looking at a mail in Outlook — nothing is. It
 * catches the class of mistake that a browser preview cannot: markup that
 * renders perfectly in Chromium and falls apart in a client with a twenty-year
 * old layout engine. Every rule below is a real client behaviour, named.
 *
 * The remaining half of ORISO-Frontend#877 is a rendering pass on real clients,
 * which needs a Litmus-style account.
 */

const cases = EMAIL_LOCALES.flatMap((locale) =>
	EMAIL_IDS.map((id) => ({ locale, id, html: buildEmail(id, locale).html }))
);

/**
 * The real `<style>` block — the only place non-inline CSS is allowed.
 *
 * Skips the MSO conditional comment, which also contains a `<style>` and is a
 * font override for Word's engine rather than the stylesheet.
 */
const styleBlock = (html: string): string =>
	html
		.replace(/<!--\[if mso\]>[\s\S]*?<!\[endif\]-->/g, '')
		.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? '';

/** Everything outside `<head>` — the part a client may strip styles from. */
const body = (html: string): string => html.split('</head>')[1] ?? '';

describe('e-mail client compatibility', () => {
	describe.each(cases)('$locale/$id', ({ html }) => {
		it('lays out with tables, not with CSS layout', () => {
			// Outlook's Word rendering engine supports neither, and Gmail
			// strips `position` outright.
			expect(body(html)).not.toMatch(/display\s*:\s*(flex|grid)/);
			expect(body(html)).not.toMatch(/position\s*:\s*(absolute|fixed)/);
			expect(body(html)).not.toMatch(/float\s*:\s*(left|right)/);
		});

		it('carries no external or scripted resources', () => {
			// A remote stylesheet is stripped, a script is stripped and marks
			// the message as suspicious, and a webfont request delays render.
			expect(html).not.toMatch(/<script/i);
			expect(html).not.toMatch(/<link[^>]+stylesheet/i);
			expect(html).not.toMatch(/@import/);
			expect(html).not.toMatch(/@font-face/);
		});

		it('inlines every style that carries the layout', () => {
			// The <style> block exists solely for the media query and the
			// resets. Gmail's Android app strips it on non-Gmail accounts, and
			// the mail still has to arrive readable.
			const block = styleBlock(html);
			const outsideMediaQuery = block
				.replace(/@media[^{]*\{[\s\S]*\}/, '')
				.trim();
			expect(outsideMediaQuery).toMatch(/^(img|table|a\[x-apple)/);
			expect(block).not.toMatch(/\.wrap\s*\{[^}]*width:600/);
		});

		it('uses no CSS custom properties', () => {
			// No client resolves them. Every token has to be a literal by the
			// time it reaches the file — this is the whole reason the e-mail
			// kit is separate from the app's theme.
			expect(html).not.toMatch(/var\(--/);
			expect(html).not.toMatch(/--[a-z-]+\s*:/);
		});

		it('gives every image an alt text and a size', () => {
			for (const img of html.match(/<img[^>]*>/g) ?? []) {
				expect(img, `alt missing: ${img}`).toMatch(/\salt="/);
				expect(img, `width missing: ${img}`).toMatch(/\swidth="/);
				expect(img, `height missing: ${img}`).toMatch(/\sheight="/);
			}
		});

		it('sets a background colour on the element, not only in CSS', () => {
			// Outlook ignores `background-color` on a <td> often enough that
			// the `bgcolor` attribute is still the reliable form.
			for (const cell of body(html).match(
				/<t[dr][^>]*background-color:[^>]*>/g
			) ?? []) {
				expect(cell, `bgcolor missing: ${cell}`).toMatch(/bgcolor="/);
			}
		});

		it('keeps the column width as an attribute as well as CSS', () => {
			// Word's engine ignores max-width, so the legacy width attribute is
			// what actually constrains the column there.
			expect(body(html)).toMatch(/width="600"/);
		});

		it('states a language and a character set', () => {
			expect(html).toMatch(/<html lang="(de|en)">/);
			expect(html).toMatch(/<meta charset="utf-8">/i);
		});

		it('declares how it wants to be treated in dark mode', () => {
			// Without this, several clients invert the palette by themselves
			// and the tenant colour becomes something else entirely.
			expect(html).toMatch(/name="color-scheme"/);
			expect(html).toMatch(/name="supported-color-schemes"/);
		});

		it('protects dates and addresses from iOS data detectors', () => {
			expect(styleBlock(html)).toMatch(/a\[x-apple-data-detectors\]/);
		});

		it('stays under the Gmail clipping threshold', () => {
			// Gmail clips a message past ~102KB and hides the rest behind a
			// "View entire message" link — which, on these mails, would hide
			// the privacy promise and the unsubscribe link.
			expect(Buffer.byteLength(html, 'utf8')).toBeLessThan(102_000);
		});
	});
});
