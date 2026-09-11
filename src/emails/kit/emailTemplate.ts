/**
 * The content model every transactional e-mail is written against, plus the two
 * renderers (HTML and text/plain) that turn it into a send-ready file.
 *
 * One model, two outputs: the plain-text twin is generated from the *same*
 * fields as the HTML, so the two can no longer drift apart the way hand-kept
 * pairs always do.
 */

import { EmailDataRow } from './emailAtoms';
import { emailDocument } from './emailDocument';
import {
	EmailFooterContent,
	emailAssurance,
	emailCallToAction,
	emailCodePanel,
	emailDataPanel,
	emailFooter,
	emailFootnote,
	emailHeaderBar,
	emailProse,
	emailSecondaryAction,
	emailTitleGroup
} from './emailMolecules';
import { emailCard, emailShell } from './emailOrganisms';
import { EmailBrand } from './emailTokens';

export interface EmailAction {
	label: string;
	/** Usually a `{{placeholder}}`; a literal URL only in previews. */
	href: string;
}

export interface EmailContent {
	/** Inbox subject line. */
	subject: string;
	/** Hidden preview text shown next to the subject. */
	preheader: string;
	headline: string;
	/** One or more body paragraphs, in reading order. */
	paragraphs: string[];
	/** Optional tinted label/value panel between the copy and the button. */
	panel?: EmailDataRow[];
	/**
	 * A one-time code, shown large on its own panel. Mutually exclusive with
	 * `panel` in practice — a mail that carries a code carries nothing else.
	 */
	code?: EmailDataRow;
	/**
	 * The primary action. At most one — an ORISO mail never offers a choice.
	 *
	 * Optional because a one-time code has nothing to click: the recipient is
	 * already in the window that asked for it, and a button back to the login
	 * screen would compete with the flow they are halfway through.
	 */
	cta?: EmailAction;
	/** Optional lower-weight action directly under the button. */
	secondaryAction?: EmailAction;
	/** The reassuring line under the actions. */
	footnote?: string;
	/** Closing fine print inside the card. */
	assurance: string;
	footer: EmailFooterContent;
}

export interface EmailRenderOptions {
	brand: EmailBrand;
	/** BCP-47 tag for `<html lang>`. */
	lang: string;
}

/** Renders the send-ready `text/html` part. */
export const renderEmailHtml = (
	content: EmailContent,
	{ brand, lang }: EmailRenderOptions
): string => {
	const cardRows =
		emailTitleGroup(content.headline, brand) +
		emailProse(content.paragraphs) +
		(content.panel ? emailDataPanel(content.panel) : '') +
		(content.code ? emailCodePanel(content.code) : '') +
		(content.cta ? emailCallToAction(content.cta, brand) : '') +
		(content.secondaryAction
			? emailSecondaryAction(content.secondaryAction, brand)
			: '') +
		(content.footnote ? emailFootnote(content.footnote) : '') +
		emailAssurance(content.assurance);

	const body = emailShell(
		emailHeaderBar(brand) +
			emailCard(cardRows) +
			emailFooter(content.footer, brand)
	);

	return emailDocument({
		lang,
		subject: content.subject,
		preheader: content.preheader,
		body
	});
};

/** Strips the `<br>` a panel value may carry, for the plain-text twin. */
const flatten = (value: string): string =>
	value.replace(/<br\s*\/?>/gi, ', ').replace(/<[^>]+>/g, '');

/**
 * Renders the send-ready `text/plain` part — the same statement without images
 * or colour. Sent as the alternative part of every mail, and the only thing
 * screen-reader users of text-only clients ever see.
 */
export const renderEmailText = (
	content: EmailContent,
	{ brand }: EmailRenderOptions
): string => {
	const lines: string[] = [
		content.headline,
		'='.repeat(content.headline.length),
		'',
		...content.paragraphs.flatMap((p) => [p, ''])
	];

	if (content.panel) {
		content.panel.forEach((row) =>
			lines.push(`${row.label}: ${flatten(row.value)}`)
		);
		lines.push('');
	}

	if (content.code) {
		lines.push(`${content.code.label}: ${flatten(content.code.value)}`, '');
	}

	if (content.cta) {
		lines.push(`${content.cta.label}:`, content.cta.href, '');
	}

	if (content.secondaryAction) {
		lines.push(
			`${content.secondaryAction.label}:`,
			content.secondaryAction.href,
			''
		);
	}
	if (content.footnote) {
		lines.push(content.footnote, '');
	}

	lines.push(
		'-'.repeat(64),
		content.assurance,
		'',
		brand.orgName,
		brand.orgAddress,
		brand.contactLine,
		'',
		content.footer.offeredBy,
		'',
		...content.footer.links.map((link) => `${link.label}: ${link.href}`),
		'',
		content.footer.automatedNote,
		''
	);

	return lines.join('\n');
};
