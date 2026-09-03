/**
 * Organisms of the transactional e-mail kit: the white card, and the canvas
 * shell that centres a 600px column inside it.
 */

import {
	emailColor,
	emailLayout,
	emailRadius,
	emailSpace
} from './emailTokens';

/**
 * The white card that holds the message.
 *
 * `bgcolor` is repeated alongside `background-color` because Outlook ignores
 * the CSS property on a table, and the card must never come out transparent on
 * the tinted canvas.
 *
 * `border-collapse:separate` opts the card out of the stylesheet's
 * `table{border-collapse:collapse}` reset: `border-radius` has no effect on a
 * collapsed-border table, so without it clients round the background but draw
 * the 1px outline square (observed in Roundcube).
 */
export const emailCard = (rows: string): string =>
	'<tr><td style="padding:0;">' +
	'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" ' +
	`bgcolor="${emailColor.surface}" style="border-collapse:separate;background-color:${emailColor.surface};` +
	`border-radius:${emailRadius.card}px;border:1px solid ${emailColor.outline};">` +
	rows +
	'</table></td></tr>';

/**
 * Canvas plus centred column.
 *
 * The column carries both the legacy `width` attribute (for Outlook's word
 * renderer) and `max-width` (for everything else); `.wrap` lets the media query
 * release the fixed width on phones.
 */
export const emailShell = (rows: string): string =>
	'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" ' +
	`style="background-color:${emailColor.canvas};">` +
	`<tr><td class="edge" align="center" style="padding:${emailSpace.edge.top}px ${emailSpace.edge.side}px ` +
	`${emailSpace.edge.bottom}px ${emailSpace.edge.side}px;">` +
	`<table role="presentation" class="wrap" width="${emailLayout.width}" cellpadding="0" cellspacing="0" border="0" ` +
	`style="width:${emailLayout.width}px;max-width:${emailLayout.width}px;">` +
	rows +
	'</table></td></tr></table>';
