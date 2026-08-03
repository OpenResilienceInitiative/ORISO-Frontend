/**
 * Atoms of the transactional e-mail kit.
 *
 * An atom returns a *fragment* of e-mail-safe HTML — no `<tr>`, no outer
 * padding. Placement is a layout concern and belongs to `emailBlock` (below)
 * and to the molecules. Keeping the two apart is what makes the atoms
 * previewable on their own in Storybook.
 *
 * House rules for everything in this file:
 *   - tables for layout, inline styles only, no JavaScript, no webfont loads;
 *   - the single exception is the `class` hook, because the `<style>` media
 *     query in `emailDocument` is the only way to react to viewport width;
 *   - every colour and size comes from `emailTokens`, never a literal.
 */

import {
	EmailBrand,
	emailColor,
	emailFontStack,
	emailLayout,
	emailRadius,
	emailType
} from './emailTokens';

/**
 * Escapes text destined for an HTML text node or attribute.
 *
 * Template copy legitimately contains `{{placeholders}}` and typographic
 * characters, so this must not touch braces — only the five XML specials.
 */
export const emailEscape = (value: string): string =>
	value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');

const font = (
	size: number,
	line: number,
	extra: { weight?: number; tracking?: number; color?: string } = {}
): string =>
	[
		`font-family:${emailFontStack}`,
		`font-size:${size}px`,
		`line-height:${line}px`,
		extra.weight ? `font-weight:${extra.weight}` : '',
		extra.tracking ? `letter-spacing:${extra.tracking}px` : '',
		extra.color ? `color:${extra.color}` : ''
	]
		.filter(Boolean)
		.join(';');

/* -------------------------------------------------------------------------- */
/* Layout atom                                                                */
/* -------------------------------------------------------------------------- */

export interface EmailBlockOptions {
	/** `top right bottom left`, in px. */
	padding: [number, number, number, number];
	/** Extra class hooks picked up by the responsive `<style>` block. */
	className?: string;
	align?: 'left' | 'center';
	/** Typography for text blocks, appended to the cell's inline style. */
	style?: string;
}

/**
 * Wraps a fragment in the `<tr><td>` that carries its padding.
 *
 * Every block gets `.sp`, the hook the media query uses to shrink the
 * horizontal gutter — the gutter is the same on every row by design.
 */
export const emailBlock = (
	content: string,
	{ padding, className, align, style }: EmailBlockOptions
): string => {
	const [top, right, bottom, left] = padding;
	const classes = ['sp', className].filter(Boolean).join(' ');
	return (
		`<tr><td class="${classes}"${align ? ` align="${align}"` : ''} ` +
		`style="padding:${top}px ${right}px ${bottom}px ${left}px;` +
		`${style ? `${style};` : ''}">${content}</td></tr>`
	);
};

/* -------------------------------------------------------------------------- */
/* Content atoms                                                              */
/* -------------------------------------------------------------------------- */

/**
 * The short accent stroke above the headline. Purely decorative, so it is a
 * spacer table rather than an image — images are blocked by default in Outlook.
 */
export const emailAccentRule = (brand: EmailBrand): string =>
	'<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="44" style="width:44px;">' +
	`<tr><td height="4" bgcolor="${brand.accentColor}" ` +
	`style="height:4px;line-height:4px;font-size:0;border-radius:${emailRadius.pill}px;` +
	`background-color:${brand.accentColor};">&nbsp;</td></tr></table>`;

export const emailHeadline = (text: string): string =>
	`<h1 class="h1" style="margin:0;${font(
		emailType.headline.size,
		emailType.headline.line,
		{ weight: emailType.headline.weight, color: emailColor.onSurface }
	)};mso-line-height-rule:exactly;">${emailEscape(text)}</h1>`;

/** Body copy. Returns the text styling only — the `<td>` carries it. */
export const emailBodyTextStyle = (): string =>
	`${font(emailType.body.size, emailType.body.line, {
		color: emailColor.onSurface
	})};mso-line-height-rule:exactly;`;

/** The muted, reassuring line under the call to action. */
export const emailFootnoteStyle = (): string =>
	font(emailType.footnote.size, emailType.footnote.line, {
		tracking: emailType.footnote.tracking,
		color: emailColor.onSurfaceVariant
	});

/** Fine print: the encryption assurance and the footer. */
export const emailCaptionStyle = (): string =>
	font(emailType.caption.size, emailType.caption.line, {
		color: emailColor.onSurfaceVariant
	});

/**
 * The primary call to action.
 *
 * Bulletproof pattern: a one-cell table carries the background and radius so
 * Outlook (which drops `border-radius` on `<a>`) still shows a filled block.
 * `.btn` lets the media query stretch it to the full width on phones.
 */
export const emailButton = (
	{ href, label }: { href: string; label: string },
	brand: EmailBrand
): string =>
	'<table role="presentation" cellpadding="0" cellspacing="0" border="0">' +
	`<tr><td align="center" bgcolor="${brand.primaryColor}" ` +
	`style="background-color:${brand.primaryColor};border-radius:${emailRadius.pill}px;">` +
	`<a href="${emailEscape(href)}" style="display:inline-block;padding:14px 32px;${font(
		emailType.button.size,
		emailType.button.line,
		{ weight: emailType.button.weight, color: emailColor.onPrimary }
	)};text-decoration:none;border-radius:${emailRadius.pill}px;">${emailEscape(
		label
	)}</a>` +
	'</td></tr></table>';

/** Secondary, text-only action. Always underlined — colour alone is not a cue. */
export const emailTextLink = (
	{ href, label }: { href: string; label: string },
	brand: EmailBrand
): string =>
	`<a href="${emailEscape(href)}" style="color:${
		brand.primaryColor
	};text-decoration:underline;">${emailEscape(label)}</a>`;

export const emailDivider = (): string =>
	'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">' +
	`<tr><td height="1" bgcolor="${emailColor.outline}" ` +
	'style="height:1px;line-height:1px;font-size:0;">&nbsp;</td></tr></table>';

/** Logo plus wordmark. The logo is decorative next to the name, hence `alt`. */
export const emailLogoLockup = (brand: EmailBrand): string =>
	'<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>' +
	`<td width="${emailLayout.logoSize}" valign="middle" style="width:${emailLayout.logoSize}px;padding-right:12px;">` +
	`<img src="${emailEscape(brand.logoUrl)}" width="${emailLayout.logoSize}" height="${
		emailLayout.logoSize
	}" alt="${emailEscape(brand.platformName)}" ` +
	`style="display:block;width:${emailLayout.logoSize}px;height:${emailLayout.logoSize}px;border:0;border-radius:${emailRadius.logo}px;"></td>` +
	`<td valign="middle" style="${font(
		emailType.brand.size,
		emailType.brand.line,
		{
			weight: emailType.brand.weight,
			tracking: emailType.brand.tracking,
			color: emailColor.onSurface
		}
	)};">${emailEscape(brand.platformName)}</td>` +
	'</tr></table>';

/**
 * The hidden preview line most clients show next to the subject.
 * Must be the first node inside `<body>`.
 */
export const emailPreheader = (text: string): string =>
	'<span style="display:none !important;visibility:hidden;opacity:0;height:0;width:0;' +
	`overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${emailColor.canvas};">` +
	`${emailEscape(text)}</span>`;

export interface EmailDataRow {
	label: string;
	/** Rendered as-is so a value may contain a `<br>` (e.g. a postal address). */
	value: string;
}

/**
 * One label/value pair of the data panel.
 *
 * On desktop this is a two-column row. The `.row-label` / `.row-value` hooks
 * let the media query stack them, which is the difference between a readable
 * and an unreadable appointment card at 320px.
 */
export const emailDataRowMarkup = (
	{ label, value }: EmailDataRow,
	{ first }: { first: boolean }
): string => {
	const top = first ? 0 : 12;
	const labelClass = first ? 'row-label row-first' : 'row-label';
	return (
		'<tr>' +
		`<td class="${labelClass}" valign="top" width="38%" style="width:38%;padding:${top}px 16px 0 0;${font(
			emailType.label.size,
			emailType.label.line,
			{
				tracking: emailType.label.tracking,
				color: emailColor.onSurfaceVariant
			}
		)};">${emailEscape(label)}</td>` +
		// `word-break` is load-bearing, not defensive: panel values carry e-mail
		// addresses and street names, which are unbreakable tokens wide enough to
		// push a 320px layout into horizontal scrolling.
		`<td class="row-value" valign="top" style="padding:${top}px 0 0 0;${font(
			emailType.value.size,
			emailType.value.line,
			{ weight: emailType.value.weight, color: emailColor.onSurface }
		)};word-break:break-word;">${value}</td>` +
		'</tr>'
	);
};

/**
 * A one-time code, set to be read aloud or retyped.
 *
 * The label sits above rather than beside it: a code is not a data point in a
 * list, it is the one thing the recipient has to get out of the mail. The
 * `.code` hook lets the media query shrink it before it can wrap, because a
 * six-digit code broken across two lines is worse than a smaller one.
 */
export const emailCodeMarkup = ({ label, value }: EmailDataRow): string =>
	`<div style="${font(emailType.label.size, emailType.label.line, {
		tracking: emailType.label.tracking,
		color: emailColor.onSurfaceVariant
	})};padding-bottom:6px;">${emailEscape(label)}</div>` +
	`<div class="code" style="${font(emailType.code.size, emailType.code.line, {
		weight: emailType.code.weight,
		tracking: emailType.code.tracking,
		color: emailColor.onSurface
	})};word-break:break-word;">${value}</div>`;

/** A footer link. `nowrap` is dropped on mobile so four of them can wrap. */
export const emailFooterLink = ({
	href,
	label
}: {
	href: string;
	label: string;
}): string =>
	`<a href="${emailEscape(href)}" style="color:${
		emailColor.onSurfaceVariant
	};text-decoration:underline;white-space:nowrap;">${emailEscape(label)}</a>`;

export const emailFooterSeparator = (): string =>
	`<span style="color:${emailColor.separator};">&nbsp; · &nbsp;</span>`;
