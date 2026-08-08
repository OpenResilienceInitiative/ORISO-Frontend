import * as React from 'react';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LegalLinkDialog } from './LegalLinkDialog';

/**
 * The platform-level note behind each legal link, keyed by the link's i18n key
 * — the only stable identifier an entry has. The translated label changes with
 * the UI language, and the URL is deployment configuration.
 *
 * Entries not listed here have no note and keep opening their page directly.
 */
const PLATFORM_NOTE_BY_LABEL: Record<string, string> = {
	'login.legal.infoText.impressum': 'login.legal.platform.impressum',
	'login.legal.infoText.dataprotection': 'login.legal.platform.dataprotection'
};

interface OpenLegalLink {
	title: string;
	note: string;
	url: string;
}

/**
 * Legal links that open a short platform note instead of leaving the page.
 *
 * The login screen is the first thing a person in trouble sees, and sending
 * them to a second tab for the privacy policy loses the login. It is also the
 * one screen where no Beratungsstelle has been chosen yet, so no carrier text
 * applies — the note is deliberately platform level, with the full binding text
 * one click further.
 *
 * Returns the click handler and the dialog element; render the element once,
 * next to whatever list of links uses the handler.
 */
export const useLegalLinkDialog = () => {
	const { t: translate } = useTranslation();
	const [open, setOpen] = useState<OpenLegalLink | null>(null);

	const openLegalLink = useCallback(
		(label: string, url: string, rawLabel: string): boolean => {
			const noteKey = PLATFORM_NOTE_BY_LABEL[rawLabel];
			if (!noteKey) {
				window.open(url, '_blank', 'noopener');
				return false;
			}

			setOpen({ title: label, note: translate(noteKey), url });
			return true;
		},
		[translate]
	);

	const dialog = (
		<LegalLinkDialog
			open={open !== null}
			title={open?.title ?? ''}
			note={open?.note ?? ''}
			fullTextUrl={open?.url ?? ''}
			onClose={() => setOpen(null)}
		/>
	);

	return { openLegalLink, dialog };
};
