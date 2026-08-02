/**
 * Molecules of the transactional e-mail kit: atoms plus the padding that
 * positions them. Each molecule returns one or more `<tr>` rows, so they can be
 * concatenated straight into the card or the shell.
 */

import {
	EmailDataRow,
	emailAccentRule,
	emailBlock,
	emailBodyTextStyle,
	emailButton,
	emailCaptionStyle,
	emailDataRowMarkup,
	emailDivider,
	emailEscape,
	emailFooterLink,
	emailFooterSeparator,
	emailFootnoteStyle,
	emailHeadline,
	emailLogoLockup,
	emailTextLink
} from './emailAtoms';
import {
	EmailBrand,
	emailColor,
	emailFontStack,
	emailRadius,
	emailSpace,
	emailType
} from './emailTokens';

const G = emailSpace.gutter;

/** Logo and platform name, sitting above the card on the bare canvas. */
export const emailHeaderBar = (brand: EmailBrand): string =>
	emailBlock(emailLogoLockup(brand), { padding: [0, G, 20, G] });

/** The accent stroke plus the headline it belongs to. */
export const emailTitleGroup = (headline: string, brand: EmailBrand): string =>
	emailBlock(emailAccentRule(brand), { padding: [36, G, 0, G] }) +
	emailBlock(emailHeadline(headline), { padding: [18, G, 14, G] });

/**
 * Body copy. The final paragraph gets the larger bottom gap because whatever
 * follows it (panel or button) starts a new visual group.
 */
export const emailProse = (paragraphs: string[]): string =>
	paragraphs
		.map((text, index) =>
			emailBlock(emailEscape(text), {
				padding: [0, G, index === paragraphs.length - 1 ? 28 : 16, G],
				style: emailBodyTextStyle()
			})
		)
		.join('');

/**
 * The tinted label/value panel: appointment details, the assigned request, the
 * user name to keep. Stacks to one column below the mobile breakpoint.
 */
export const emailDataPanel = (rows: EmailDataRow[]): string => {
	const body = rows
		.map((row, index) => emailDataRowMarkup(row, { first: index === 0 }))
		.join('');
	return emailBlock(
		'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" ' +
			`bgcolor="${emailColor.surfaceMuted}" style="background-color:${emailColor.surfaceMuted};` +
			`border:1px solid ${emailColor.outline};border-radius:${emailRadius.panel}px;">` +
			`<tr><td class="panel-pad" style="padding:${emailSpace.panel.block}px ${emailSpace.panel.inline}px;">` +
			'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">' +
			body +
			'</table></td></tr></table>',
		{ padding: [0, G, 8, G], className: 'panel' }
	);
};

/** The primary action. Left-aligned on desktop, full width on phones. */
export const emailCallToAction = (
	cta: { href: string; label: string },
	brand: EmailBrand
): string =>
	emailBlock(emailButton(cta, brand), {
		padding: [20, G, 0, G],
		className: 'btn',
		align: 'left'
	});

/** An optional second, lower-weight action directly under the button. */
export const emailSecondaryAction = (
	link: { href: string; label: string },
	brand: EmailBrand
): string =>
	emailBlock(emailTextLink(link, brand), {
		padding: [16, G, 0, G],
		className: 'link',
		style:
			`font-family:${emailFontStack};font-size:${emailType.label.size}px;` +
			`line-height:${emailType.label.line}px;letter-spacing:${emailType.label.tracking}px`
	});

/** The "you don't have to hurry" line. Tone-setting, never load-bearing. */
export const emailFootnote = (text: string): string =>
	emailBlock(emailEscape(text), {
		padding: [24, G, 0, G],
		style: emailFootnoteStyle()
	});

/**
 * Closing fine print inside the card — in ORISO always the end-to-end
 * encryption promise, because that is the one thing a recipient must be able to
 * trust without logging in.
 */
export const emailAssurance = (text: string): string =>
	emailBlock(emailDivider(), { padding: [28, G, 0, G] }) +
	emailBlock(emailEscape(text), {
		padding: [16, G, 32, G],
		style: emailCaptionStyle()
	});

export interface EmailFooterContent {
	/** e.g. "{{platformName}} ist ein Angebot von {{orgName}}." */
	offeredBy: string;
	links: { href: string; label: string }[];
	/** e.g. "Diese E-Mail wurde automatisch versendet…" */
	automatedNote: string;
}

/** Sender identity, legal links and the do-not-reply note, below the card. */
export const emailFooter = (
	footer: EmailFooterContent,
	brand: EmailBrand
): string => {
	const links = footer.links
		.map(emailFooterLink)
		.join(emailFooterSeparator());
	return emailBlock(
		`<div style="color:${emailColor.onSurface};font-weight:${emailType.orgName.weight};` +
			`font-size:${emailType.orgName.size}px;line-height:${emailType.orgName.line}px;">${emailEscape(
				brand.orgName
			)}</div>` +
			`<div style="padding-top:2px;">${emailEscape(brand.orgAddress)}</div>` +
			`<div>${emailEscape(brand.contactLine)}</div>` +
			`<div style="padding-top:14px;">${emailEscape(footer.offeredBy)}</div>` +
			`<div class="flinks" style="padding-top:14px;">${links}</div>` +
			`<div style="padding-top:14px;color:${emailColor.onSurfaceFaint};">${emailEscape(
				footer.automatedNote
			)}</div>`,
		// Same reason as the panel values: `contactLine` is an address plus a
		// phone number, and a long tenant e-mail would otherwise widen the page.
		{
			padding: [28, G, 0, G],
			style: `${emailCaptionStyle()};word-break:break-word`
		}
	);
};

/** Shared by the body-copy rows; exported for the Storybook atom previews. */
export const emailProseStyle = emailBodyTextStyle;

/** Font stack re-export so previews can match the rendered mail exactly. */
export const emailPreviewFontStack = emailFontStack;
