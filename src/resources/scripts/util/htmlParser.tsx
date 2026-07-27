import parse, { DOMNode, Element } from 'html-react-parser';
import React from 'react';
import { tenantServiceOrigin } from '../endpoints';
import { resolveTenantMediaUrl } from '../../../utils/resolveTenantMediaUrl';

// Structural tag check — more robust than `instanceof Element`, which can fail
// when html-react-parser is loaded as more than one module instance.
const isTag = (node: DOMNode): node is Element =>
	(node as Element).type === 'tag' &&
	typeof (node as Element).attribs === 'object';

// Legal/tenant rich-text (imprint/privacy/DPP) is authored in the Admin editor
// and may embed <img src="/media/{id}"> (WP-3a/3b). Rendered on the frontend
// origin, that root-relative path would not reach the TenantService in a split
// api/app host topology — so rewrite it to the tenant origin here, the single
// choke point every legal HTML string passes through.
const htmlParser = (input: string) =>
	parse(input, {
		replace: (domNode) => {
			if (!isTag(domNode)) {
				return undefined;
			}
			if (domNode.attribs.class === 'remove') {
				return <></>;
			}
			if (domNode.name === 'img' && domNode.attribs.src) {
				domNode.attribs.src = resolveTenantMediaUrl(
					domNode.attribs.src,
					tenantServiceOrigin
				) as string;
			}
			return undefined;
		}
	});

export default htmlParser;
