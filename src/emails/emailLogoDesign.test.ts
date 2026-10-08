import { describe, expect, it } from 'vitest';
import { emailLogoCell, emailLogoLockup } from './kit/emailAtoms';
import { emailHeaderBar } from './kit/emailMolecules';
import { emailDocument } from './kit/emailDocument';
import { toEmailDialectHtml } from './kit/emailDialect';
import { emailDefaultBrand, emailSampleBrand } from './kit/emailTokens';

describe('proportional e-mail logo design', () => {
	it.each([
		[1, 2, 24],
		[1, 1, 48],
		[3, 1, 144],
		[6, 1, 288]
	])(
		'scales %i:%i to 48px high and %ipx wide without rounding or cropping',
		(logoWidth, logoHeight, width) => {
			const html = emailLogoCell({
				...emailSampleBrand,
				logoWidth,
				logoHeight
			});
			expect(html).toContain(`width="${width}" height="48"`);
			expect(html).toContain(`width:${width}px;height:48px;`);
			expect(html).not.toMatch(
				/border-radius|object-fit|overflow:hidden/
			);
		}
	);

	it('keeps the wordmark at 3:1 and hides it only above 3:1 on phones', () => {
		const normal = { ...emailSampleBrand, logoWidth: 3, logoHeight: 1 };
		const wide = { ...normal, logoWidth: 3.01 };
		expect(emailLogoLockup(normal)).not.toContain('logo-wordmark-wide');
		expect(emailLogoLockup(wide)).toContain('logo-wordmark-wide');
		expect(emailHeaderBar(wide)).toContain('logo-header-wide');
		expect(emailLogoCell(wide)).toContain('alt="Online-Beratung"');
		const doc = emailDocument({
			lang: 'de',
			subject: '',
			preheader: '',
			body: emailHeaderBar(wide)
		});
		expect(doc).toContain('@media only screen and (max-width:620px)');
		expect(doc).toContain('.logo-wordmark-wide{display:none !important}');
		expect(doc).toContain(
			'.logo-header-wide{padding-left:8px !important;padding-right:8px !important}'
		);
	});

	it.each([
		{},
		{ logoWidth: 0, logoHeight: 1 },
		{ logoWidth: NaN, logoHeight: 1 },
		{ logoWidth: 4, logoHeight: Infinity }
	])(
		'keeps unknown or invalid dimensions proportional and keeps the wordmark',
		(dimensions) => {
			const html = emailLogoLockup({
				...emailSampleBrand,
				...dimensions
			});
			expect(html).toContain('width:auto;height:48px;');
			expect(html).not.toContain('logo-wordmark-wide');
			expect(html).not.toMatch(/width="(NaN|Infinity|0)"/);
		}
	);

	it('keeps the name visible when there is no logo, regardless of dimensions', () => {
		const html = emailHeaderBar({
			...emailSampleBrand,
			logoUrl: '',
			logoWidth: 6,
			logoHeight: 1
		});
		expect(html).not.toContain('<img');
		expect(html).not.toContain('logo-wordmark-wide');
		expect(html).toContain('Online-Beratung');
	});

	it('hands plain senders the optional mobile classification beside the logo cell', () => {
		const html = toEmailDialectHtml(
			emailHeaderBar(emailDefaultBrand),
			'plain'
		);
		expect(html).toContain('{{logoCell}}');
		expect(html).toContain('class="sp logo-header {{logoHeaderClass}}"');
		expect(html).toContain('class="logo-wordmark {{logoWordmarkClass}}"');
		expect(
			toEmailDialectHtml(emailHeaderBar(emailSampleBrand), 'plain')
		).not.toContain('{{logo');
	});
});
