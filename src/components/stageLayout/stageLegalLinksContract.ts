/**
 * Layout contract: the legal links (privacy policy, imprint) a visitor sees
 * must also take the click.
 *
 * Twice now an invisible box of the content column lay over the red stage and
 * swallowed every click on its links: first the content wrapper (fixed by
 * `pointer-events: none` on `.stageLayout__contentWrapper`), then the build
 * identity footer, which spans the full width and only pads its text to the
 * right of the stage (ORISO-Frontend#2138). Nothing about either is visible,
 * so only a hit test in a real browser catches it — jsdom has no layout.
 *
 * Call it from a story's `play` at the state to guard. It checks every legal
 * link that is on screen, wherever it is rendered (stage or footer).
 */

const LEGAL_LINK_SELECTOR = [
	'.stage__legalLinks button',
	'.stage__legalLinks a',
	'.stageLayout__legalLinks button',
	'.stageLayout__legalLinks a'
].join(', ');

/** Describes the topmost element at a point, for a readable failure. */
const describe = (el: Element | null) =>
	el
		? `${el.tagName.toLowerCase()}.${String(el.className || '')
				.trim()
				.split(/\s+/)
				.join('.')}`
		: 'nothing';

const onScreen = (rect: DOMRect, win: Window) =>
	rect.width > 0 &&
	rect.height > 0 &&
	rect.bottom > 0 &&
	rect.top < win.innerHeight &&
	rect.right > 0 &&
	rect.left < win.innerWidth;

/**
 * Returns one line per visible legal link that something else covers; empty
 * when every visible link is reachable. Throws when no link is visible at all,
 * because then the check would pass without having checked anything.
 */
export const coveredLegalLinks = (doc: Document): string[] => {
	const win = doc.defaultView!;
	const links = [
		...doc.querySelectorAll<HTMLElement>(LEGAL_LINK_SELECTOR)
	].filter((link) => onScreen(link.getBoundingClientRect(), win));
	if (!links.length) {
		throw new Error('no legal link is visible on screen');
	}
	const covered: string[] = [];
	for (const link of links) {
		const rect = link.getBoundingClientRect();
		// Centre and both ends: a box can cover half a link.
		for (const fx of [0.1, 0.5, 0.9]) {
			const hit = doc.elementFromPoint(
				rect.left + rect.width * fx,
				rect.top + rect.height / 2
			);
			if (!hit || !link.contains(hit)) {
				covered.push(
					`"${link.textContent?.trim()}" is covered by ${describe(hit)}`
				);
				break;
			}
		}
	}
	return covered;
};
