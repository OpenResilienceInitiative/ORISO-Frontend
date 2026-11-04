import type { TProvidedLegalLink } from '../../globalState/provider/LegalLinksProvider';

/**
 * Storybook only: the legal links every waiting-room story provides, so the
 * stage shows its "Datenschutzerklärung | Impressum" row as in the app. The
 * layout contract fails a room whose row stays empty.
 */
export const storyLegalLinks: TProvidedLegalLink[] = [
	{
		label: 'login.legal.infoText.dataprotection',
		registration: true,
		getUrl: () => 'https://oriso.example/datenschutz'
	} as TProvidedLegalLink,
	{
		label: 'login.legal.infoText.impressum',
		registration: true,
		getUrl: () => 'https://oriso.example/impressum'
	} as TProvidedLegalLink
];
