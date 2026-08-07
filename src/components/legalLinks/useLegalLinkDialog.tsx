import * as React from 'react';
import { useCallback, useState } from 'react';
import { LegalLinkDialog } from './LegalLinkDialog';
import { useLegalLinkContent } from './useLegalLinkContent';

interface OpenLegalLink {
	title: string;
	content: string;
}

/**
 * Legal links that open a modal instead of a tab — with the external page as
 * the fallback.
 *
 * Returns the click handler and the dialog element; render the element once,
 * next to whatever list of links uses the handler. `openLegalLink` returns
 * `true` when it took the click, so a caller can keep its own behaviour for
 * links the tenant has no text for.
 */
export const useLegalLinkDialog = () => {
	const resolveContent = useLegalLinkContent();
	const [open, setOpen] = useState<OpenLegalLink | null>(null);

	const openLegalLink = useCallback(
		(label: string, url: string, rawLabel: string): boolean => {
			const resolved = resolveContent(rawLabel);
			if (!resolved) {
				// Nothing maintained in the Admin panel for this entry — the
				// external page is still the honest destination.
				window.open(url, '_blank', 'noopener');
				return false;
			}

			setOpen({ title: label, content: resolved.content });
			return true;
		},
		[resolveContent]
	);

	const dialog = (
		<LegalLinkDialog
			open={open !== null}
			title={open?.title ?? ''}
			content={open?.content}
			onClose={() => setOpen(null)}
		/>
	);

	return { openLegalLink, dialog };
};
