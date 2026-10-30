import * as React from 'react';
import VideocamOutlinedIcon from '@mui/icons-material/VideocamOutlined';
import CallOutlinedIcon from '@mui/icons-material/CallOutlined';
import LinkIcon from '@mui/icons-material/Link';
import type { DirectLinkMedium } from './directLinkOrigin';

/**
 * FE#1952: the glyph of a direct-link conversation, drawn where a mail
 * conversation shows its envelope — in the list card and in the rail pill.
 * Decorative: the word next to it (card) or the mark's label (rail) is the
 * name.
 */
export const DirectLinkGlyph = ({
	medium,
	className
}: {
	medium: DirectLinkMedium;
	className?: string;
}) => {
	const Glyph =
		medium === 'VIDEO'
			? VideocamOutlinedIcon
			: medium === 'AUDIO'
				? CallOutlinedIcon
				: LinkIcon;
	return <Glyph aria-hidden="true" focusable="false" className={className} />;
};
