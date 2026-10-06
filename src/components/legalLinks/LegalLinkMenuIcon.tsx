import * as React from 'react';
import { GdprIcon } from '../../resources/img/icons';
import { getLegalLinkKind } from './useLegalLinkContent';

/**
 * Menu glyph for imprint / privacy rows. Issue #1197: the previous assets were
 * fingerprint artwork, and SessionMenu classified privacy with a German
 * `includes('daten')` check on the translated label. Both kinds use the GDPR
 * legal icon; `getLegalLinkKind` still runs so the kind is language-safe.
 */
export const LegalLinkMenuIcon = ({
	title,
	url,
	rawLabel,
	className
}: {
	title: string;
	url: string;
	rawLabel?: string;
	className?: string;
}) => {
	const kind = getLegalLinkKind(title, url, rawLabel);
	return (
		<GdprIcon
			className={className}
			data-icon="gdpr"
			data-legal-kind={kind}
			aria-hidden="true"
		/>
	);
};
