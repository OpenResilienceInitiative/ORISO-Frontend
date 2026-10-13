import { emailSampleBrand, EmailBrand } from '../kit/emailTokens';

/** Synthetic preview fixtures with real intrinsic dimensions; never sent to recipients. */
export const emailLogoFixtures = [
	{ name: 'Portrait (1:2)', file: 'portrait', width: 32, height: 64 },
	{ name: 'Square (1:1)', file: 'square', width: 64, height: 64 },
	{ name: 'Wide boundary (3:1)', file: 'wide', width: 192, height: 64 },
	{ name: 'Very wide (6:1)', file: 'very-wide', width: 384, height: 64 }
] as const;

export const emailLogoFixtureBrand = (
	fixture: (typeof emailLogoFixtures)[number]
): EmailBrand => ({
	...emailSampleBrand,
	logoUrl: `/email-logo-fixtures/${fixture.file}.svg`,
	logoWidth: fixture.width,
	logoHeight: fixture.height
});
