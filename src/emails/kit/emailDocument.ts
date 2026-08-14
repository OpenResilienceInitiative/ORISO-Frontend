/**
 * The document shell: `<head>`, the responsive stylesheet, and the preheader.
 *
 * The `<style>` block is the only non-inline CSS in the kit. Clients that strip
 * it (notably the Gmail Android app when the account is not a Gmail account)
 * fall back to the desktop table layout, which still renders — the media query
 * only ever *improves* narrow viewports, it is never load-bearing.
 */

import { emailEscape, emailPreheader } from './emailAtoms';
import { emailColor, emailLayout, emailSpace, emailType } from './emailTokens';

/**
 * Mobile stylesheet.
 *
 * Beyond shrinking the gutter and the headline, this does four things the first
 * draft did not, all of which only show up on a real phone:
 *
 *  1. releases the fixed 600px column (`.wrap`) and trims the canvas padding,
 *     so a 320px screen spends its width on content rather than on margins;
 *  2. actually stretches the CTA — `display:block` on the `<a>` alone does
 *     nothing while its wrapper table is still shrink-to-fit;
 *  3. stacks the data panel's label/value pairs, which otherwise squeeze an
 *     address into a 38%-wide column;
 *  4. lets the four footer links wrap instead of forcing a horizontal scroll.
 */
const responsiveStyles = (): string =>
	`@media only screen and (max-width:${emailLayout.mobileBreakpoint}px){` +
	'.wrap{width:100% !important;max-width:100% !important}' +
	`.edge{padding:${emailSpace.edgeMobile.top}px ${emailSpace.edgeMobile.side}px ` +
	`${emailSpace.edgeMobile.bottom}px ${emailSpace.edgeMobile.side}px !important}` +
	`.sp{padding-left:${emailSpace.gutterMobile}px !important;padding-right:${emailSpace.gutterMobile}px !important}` +
	`.h1{font-size:${emailType.headline.mobile.size}px !important;` +
	`line-height:${emailType.headline.mobile.line}px !important}` +
	'.btn table{width:100% !important}' +
	'.btn td{width:100% !important}' +
	'.btn a{display:block !important;padding-left:20px !important;padding-right:20px !important;text-align:center !important}' +
	`.panel-pad{padding:${emailSpace.panelMobile.block}px ${emailSpace.panelMobile.inline}px !important}` +
	`.code{font-size:${emailType.code.mobile.size}px !important;` +
	`line-height:${emailType.code.mobile.line}px !important;` +
	`letter-spacing:${emailType.code.mobile.tracking}px !important}` +
	'.row-label{display:block !important;width:100% !important;padding:14px 0 2px 0 !important}' +
	'.row-value{display:block !important;width:100% !important;padding:0 !important}' +
	'.row-first{padding-top:0 !important}' +
	'.flinks a{display:inline-block !important;white-space:normal !important;padding:3px 0 !important}' +
	'}';

/**
 * Client resets that apply at every width.
 *
 * `x-apple-data-detectors` matters here specifically: the appointment mail
 * prints a date and a postal address, and iOS otherwise recolours both into
 * system-blue links that clash with the brand.
 */
const resetStyles = (): string =>
	'img{border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;max-width:100%}' +
	'table{border-collapse:collapse}' +
	`a[x-apple-data-detectors]{color:inherit !important;text-decoration:none !important;` +
	'font-size:inherit !important;font-family:inherit !important;font-weight:inherit !important;' +
	'line-height:inherit !important}';

export interface EmailDocumentOptions {
	/** BCP-47 language tag for `<html lang>`. */
	lang: string;
	/** Goes into `<title>`, which is what most clients use as the subject. */
	subject: string;
	/** The hidden preview line shown next to the subject in the inbox list. */
	preheader: string;
	/** Rows already wrapped by `emailShell`. */
	body: string;
}

export const emailDocument = ({
	lang,
	subject,
	preheader,
	body
}: EmailDocumentOptions): string =>
	`<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${emailEscape(subject)}</title>
<!--[if mso]><style>body,table,td,a{font-family:Arial,Helvetica,sans-serif !important}</style><![endif]-->
<style>
  ${resetStyles()}
  ${responsiveStyles()}
</style>
</head>
<body style="margin:0;padding:0;width:100%;background-color:${
		emailColor.canvas
	};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
${emailPreheader(preheader)}
${body}
</body>
</html>
`;
