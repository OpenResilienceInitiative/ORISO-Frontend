import * as React from 'react';
import { useCallback, useContext, useMemo } from 'react';
import parse, { DOMNode, Element } from 'html-react-parser';
import { LegalLinksContext } from '../../globalState/provider/LegalLinksProvider';
import { LegalLinkButton, LegalLinkButtonProps } from './LegalLinkButton';

export type LegalDialogScope = Pick<
	LegalLinkButtonProps,
	'scope' | 'agencyId' | 'topicId'
>;

/**
 * Renders a consent sentence's HTML with its platform legal links as dialog
 * buttons — the same M3 dialog registration opens, scoped to the document that
 * governs the sentence (ADR-021 levels): the Fachbereich once a counselling
 * centre is known, the platform before.
 *
 * The sentence arrives as HTML because `{{legal_links}}` is substituted into
 * it (ADR-021 decision 5), which turns the links into plain anchors: a click
 * would leave the page for the configured legal URL instead of showing the
 * text in place. An anchor whose href is not one of the configured legal links
 * is a Träger's own link and stays an anchor — not ours to override.
 */
export const useLegalHtmlWithDialogs = ({
	scope,
	agencyId,
	topicId
}: LegalDialogScope) => {
	const legalLinks = useContext(LegalLinksContext);

	/* The raw i18n key belongs to an href — the dialog needs it to tell imprint
	   from privacy in a language-safe way. Anchors are rendered with
	   `{ aid: null }`, so the lookup uses the same parameters. */
	const rawLabelForHref = useMemo(() => {
		const byUrl = new Map<string, string>();
		legalLinks.forEach((link) => {
			byUrl.set(link.getUrl({ aid: null }), link.label);
		});
		return (href: string | undefined) =>
			href ? byUrl.get(href) : undefined;
	}, [legalLinks]);

	return useCallback(
		(html: string) =>
			parse(html, {
				replace: (domNode: DOMNode) => {
					const tag = domNode as Element;
					if (
						tag.type !== 'tag' ||
						tag.name !== 'a' ||
						typeof tag.attribs !== 'object'
					) {
						return undefined;
					}
					const href = tag.attribs.href;
					const rawLabel = rawLabelForHref(href);
					if (!rawLabel) return undefined;
					const label =
						(tag.children?.[0] as { data?: string })?.data ?? href;
					return (
						<LegalLinkButton
							variant="inline"
							label={label}
							rawLabel={rawLabel}
							url={href}
							scope={scope}
							agencyId={agencyId}
							topicId={topicId}
						/>
					);
				}
			}),
		[agencyId, rawLabelForHref, scope, topicId]
	);
};
