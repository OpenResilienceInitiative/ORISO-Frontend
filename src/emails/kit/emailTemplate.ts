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
	emailAuthoredProse,
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
	/**
	 * Body copy the sender supplies already rendered, instead of `paragraphs`:
	 * a mail whose text an operator wrote (the free-text invite). `html` is
	 * inserted unescaped — the sender sanitises it — and `text` is its
	 * plain-text twin. Both are placeholders in a template file.
	 */
	authoredBody?: { html: string; text: string };
	/**
	 * A placeholder the sender expands into the whole action block (button and
	 * copy-link fallback), or into nothing when the mail has no action. Takes
	 * the place of `cta` for a mail whose action is optional at send time.
	 */
	actionSlot?: string;
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
		(content.authoredBody
			? emailAuthoredProse(content.authoredBody.html)
			: emailProse(content.paragraphs)) +
		(content.panel ? emailDataPanel(content.panel) : '') +
		(content.code ? emailCodePanel(content.code) : '') +
		(content.cta ? emailCallToAction(content.cta, brand) : '') +
		(content.actionSlot ?? '') +
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

/** Width of the plain-text divider under the body. */
const RULE_WIDTH = 64;

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
		// An authored mail's headline is the sender's subject, whose length
		// is unknown here, so its rule takes the divider's width instead.
		'='.repeat(content.authoredBody ? RULE_WIDTH : content.headline.length),
		'',
		...(content.authoredBody
			? [content.authoredBody.text, '']
			: content.paragraphs.flatMap((p) => [p, '']))
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

	if (content.actionSlot) {
		lines.push(content.actionSlot, '');
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
		'-'.repeat(RULE_WIDTH),
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
