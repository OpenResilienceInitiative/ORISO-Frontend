/**
 * Swaps the page title for the section name ("Kalender", "Mein Profil") and
 * back. The default (the tenant name set by useTenantTheming) is remembered on
 * the `<title>` element; useTenantTheming writes into that remembered default
 * while a section title is showing, so a late tenant load cannot overwrite it.
 */

export const SECTION_TITLE_ATTR = 'data-section-title';
export const DEFAULT_TITLE_ATTR = 'data-default-title';

const titleNode = (): HTMLTitleElement => {
	let node = document.querySelector('title');
	if (!node) {
		node = document.createElement('title');
		document.head.appendChild(node);
	}
	return node;
};

export const showSectionTitle = (title: string): void => {
	const node = titleNode();
	if (!node.hasAttribute(SECTION_TITLE_ATTR)) {
		node.setAttribute(SECTION_TITLE_ATTR, '');
		node.setAttribute(DEFAULT_TITLE_ATTR, node.textContent ?? '');
	}
	node.textContent = title;
};

export const restoreDefaultTitle = (): void => {
	const node = document.querySelector('title');
	if (!node?.hasAttribute(SECTION_TITLE_ATTR)) return;
	node.textContent = node.getAttribute(DEFAULT_TITLE_ATTR) ?? '';
	node.removeAttribute(SECTION_TITLE_ATTR);
	node.removeAttribute(DEFAULT_TITLE_ATTR);
};

/** For useTenantTheming: set the title, or the default a section title returns to. */
export const applyTenantTitle = (title: string): void => {
	const node = titleNode();
	if (node.hasAttribute(SECTION_TITLE_ATTR)) {
		node.setAttribute(DEFAULT_TITLE_ATTR, title);
	} else {
		node.textContent = title;
	}
};
