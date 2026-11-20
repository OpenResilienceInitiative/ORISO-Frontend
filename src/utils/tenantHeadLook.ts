/**
 * Snapshot of the head elements a tenant look overwrites (title, description,
 * og tags, theme-color, tab icons), so a changed or failed link-selected
 * centre can put the default look back (#1788).
 */
const META_SELECTORS = [
	"meta[name='theme-color']",
	"meta[property='og:title']",
	"meta[name='description']",
	"meta[property='og:description']"
];

const ICON_ATTRIBUTES = ['href', 'sizes', 'type'];

export const captureHeadLook = (): (() => void) => {
	const title = document.querySelector('title');
	const titleText = title?.textContent ?? null;
	const metas = META_SELECTORS.map((selector) => {
		const node = document.querySelector(selector);
		return { selector, node, content: node?.getAttribute('content') };
	});
	const icons = Array.from(
		document.querySelectorAll<HTMLLinkElement>("link[rel~='icon']")
	).map((link) => ({
		link,
		attributes: ICON_ATTRIBUTES.map(
			(name) => [name, link.getAttribute(name)] as const
		)
	}));

	return () => {
		if (title) {
			title.textContent = titleText;
		} else {
			document.querySelector('title')?.remove();
		}
		metas.forEach(({ selector, node, content }) => {
			if (node && content != null) {
				node.setAttribute('content', content);
			} else {
				document.querySelector(selector)?.remove();
			}
		});
		const kept = new Set(icons.map(({ link }) => link));
		document
			.querySelectorAll<HTMLLinkElement>("link[rel~='icon']")
			.forEach((link) => {
				if (!kept.has(link)) {
					link.remove();
				}
			});
		icons.forEach(({ link, attributes }) => {
			attributes.forEach(([name, value]) => {
				if (value == null) {
					link.removeAttribute(name);
				} else {
					link.setAttribute(name, value);
				}
			});
		});
	};
};
