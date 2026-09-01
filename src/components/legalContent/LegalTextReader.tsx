import * as React from 'react';
import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState
} from 'react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { LegalContentRenderer } from './LegalContentRenderer';
import { LegalAnchorChips } from './LegalAnchorChips';
import {
	stampHeadingAnchors,
	type LegalHeadingAnchor
} from './legalHeadingAnchors';
import {
	CrossMarkIcon,
	MaximizeContentIcon,
	MinimizeContentIcon
} from '../../resources/img/icons';
import './legalTextReader.styles.scss';

export interface LegalTextReaderProps {
	/**
	 * Raw legal content: plain HTML, or the language→HTML map the tenant
	 * fields deliver. Resolution, the machine-translation notices and the
	 * sanitising all stay in {@link LegalContentRenderer} — this component adds
	 * navigation on top of it, it never renders HTML itself.
	 */
	content: string | null | undefined;
	/** Accessible name of the reading region and the fullscreen dialog. */
	label: string;
	/** Explicit language for flows that carry their own selector. */
	language?: string;
	/** Hide the fullscreen affordance where a host has no room for it. */
	allowFullscreen?: boolean;
	/**
	 * Closes the surrounding dialog. Given one, fullscreen also offers a close
	 * control — otherwise the only way out of a full-screen legal text is to
	 * leave fullscreen first and find the host's own close, which is two steps
	 * for the one thing a reader most wants to do.
	 */
	onClose?: () => void;
	className?: string;
}

/**
 * The reading surface for a published legal text: chapter chips, in-place
 * scrolling, and a fullscreen mode.
 *
 * It is the frontend counterpart of the Admin panel's read-only
 * `M3RichTextEditor` (`DpaLegalForm/DpaLegalReader`) — same chapter row, same
 * fullscreen affordance, same reason: a Datenschutzerklärung is fifteen
 * screens long, nobody reads it front to back, and a scrollbar is not a way to
 * find "Ihre Rechte". The Admin derives its chapters inside TipTap because it
 * is editing a document; a reader has no document model, so the anchors are
 * stamped on the rendered nodes instead (see `legalHeadingAnchors.ts` — the
 * sanitizer strips ids on the way in, deliberately).
 *
 * The reader does NOT own a scrollport of its own. Its host scrolls — the
 * dialog body on a phone and on the desktop, the page on the legal route — so
 * the screen never stacks two scrollbars. Fullscreen is the one exception: it
 * IS its own scrollport, because there is no host left to scroll.
 */
export const LegalTextReader = ({
	content,
	label,
	language,
	allowFullscreen = true,
	onClose,
	className
}: LegalTextReaderProps) => {
	const [isFullscreen, setIsFullscreen] = useState(false);
	const layerRef = useRef<HTMLDivElement>(null);
	// A REF to the toggle, not the node that was focused when fullscreen opened.
	// Entering fullscreen re-parents the body into a new subtree, so the button
	// is unmounted and a saved node reference points at a detached element that
	// cannot take focus. The ref always names whichever button is mounted now.
	const toggleRef = useRef<HTMLButtonElement>(null);

	const openFullscreen = useCallback(() => setIsFullscreen(true), []);

	const closeFullscreen = useCallback(() => {
		setIsFullscreen(false);
		// React assigns the ref to the remounted button after this commit, so
		// the focus call waits for the next frame.
		window.requestAnimationFrame(() => toggleRef.current?.focus());
	}, []);

	// Escape leaves fullscreen — the reflex for anything that fills the screen —
	// and the layer takes focus when it opens, or a keyboard reader is left
	// tabbing through a document they cannot see.
	useEffect(() => {
		if (!isFullscreen) {
			return undefined;
		}
		layerRef.current?.focus();
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				// The host dialog closes on Escape too. Leaving fullscreen is
				// the smaller step, so it wins while the layer is open.
				event.stopPropagation();
				closeFullscreen();
				return;
			}
			if (event.key !== 'Tab') {
				return;
			}
			// The layer covers the host dialog but is rendered INSIDE it, so the
			// host's own focus trap happily tabs on to the close, Back and
			// Confirm buttons hidden behind the overlay. Keeping Tab inside the
			// layer is what makes `aria-modal` on it true rather than a claim.
			const layer = layerRef.current;
			if (!layer) {
				return;
			}
			const focusable = Array.from(
				layer.querySelectorAll<HTMLElement>(
					'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
				)
			).filter((element) => element.offsetParent !== null);
			if (!focusable.length) {
				event.preventDefault();
				layer.focus();
				return;
			}
			const first = focusable[0];
			const last = focusable[focusable.length - 1];
			const active = document.activeElement;
			if (event.shiftKey && (active === first || active === layer)) {
				event.preventDefault();
				last.focus();
			} else if (!event.shiftKey && active === last) {
				event.preventDefault();
				first.focus();
			}
		};
		document.addEventListener('keydown', onKeyDown, true);
		return () => document.removeEventListener('keydown', onKeyDown, true);
	}, [isFullscreen, closeFullscreen]);

	const body = (
		<LegalReaderBody
			content={content}
			label={label}
			language={language}
			className={className}
			isFullscreen={isFullscreen}
			onToggleFullscreen={
				allowFullscreen
					? isFullscreen
						? closeFullscreen
						: openFullscreen
					: undefined
			}
			onClose={onClose}
			toggleRef={toggleRef}
		/>
	);

	// ONE tree shape in both states. Returning `body` bare when windowed and a
	// wrapped `body` when fullscreen changes the returned element's type, which
	// makes React unmount and remount the whole subtree on every toggle — and
	// with it `LegalContentRenderer`'s own "show original / show translation"
	// state. A reader who switched a machine-translated document to the binding
	// German original was silently flipped back to the translation by pressing
	// fullscreen. The layer is `display: contents` while windowed, so it costs
	// nothing in layout, and only its class and its dialog semantics change.
	return (
		<>
			{/* Holds the host's layout open while the text is in fullscreen. */}
			{isFullscreen && (
				<div
					aria-hidden="true"
					className="legalTextReader__placeholder"
				/>
			)}
			{/* The layer renders inside the host dialog's own React tree — that
			    is what keeps the host's Escape and close action working — so the
			    host's focus trap would otherwise tab on to the actions hidden
			    behind the overlay. The Tab handler above keeps focus in here,
			    which is what earns `aria-modal`; without that trap the attribute
			    would be a claim we do not honour. */}
			{/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
			<div
				ref={layerRef}
				tabIndex={isFullscreen ? -1 : undefined}
				className={clsx(
					'legalTextReader__layer',
					isFullscreen && 'legalTextReader__fullscreen'
				)}
				role={isFullscreen ? 'dialog' : undefined}
				aria-modal={isFullscreen ? true : undefined}
				aria-label={isFullscreen ? label : undefined}
				data-testid={
					isFullscreen ? 'legal-reader-fullscreen' : undefined
				}
			>
				{body}
			</div>
		</>
	);
};

/** Identity of a chapter list — same ids in the same order means no change. */
const anchorsKeyOf = (anchors: LegalHeadingAnchor[]): string =>
	anchors.map((anchor) => anchor.id).join('|');

/**
 * The heading carrying this anchor id.
 *
 * Deliberately not `querySelector('#' + CSS.escape(id))`: `CSS.escape` is absent
 * in jsdom and in older browsers, and a missing `CSS.escape` there threw on
 * every chapter click — the chips looked dead and the failure was silent in the
 * console. Ids that survived sanitising are author-written and can contain
 * anything, so building a selector out of them is the wrong shape anyway.
 */
const findHeadingById = (
	root: HTMLElement | null,
	anchorId: string
): HTMLElement | null =>
	Array.from(
		root?.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6') ?? []
	).find((heading) => heading.id === anchorId) ?? null;

/**
 * The nearest ancestor that actually scrolls, or `null` when the page itself
 * does.
 */
const findScrollParent = (element: HTMLElement): HTMLElement | null => {
	let node = element.parentElement;
	while (node) {
		const { overflowY } = window.getComputedStyle(node);
		if (
			(overflowY === 'auto' || overflowY === 'scroll') &&
			node.scrollHeight > node.clientHeight
		) {
			return node;
		}
		node = node.parentElement;
	}
	return null;
};

/**
 * Scrolls a chapter heading to the top of whatever is scrolling, clear of the
 * sticky chip row.
 *
 * Deliberately NOT `scrollIntoView({behavior: 'smooth'})` and not
 * `scrollTo({behavior: 'smooth'})`. Both are silently dropped where scroll
 * animation is unavailable — measured in an embedded Chromium against this very
 * dialog: `scrollTo({top: 900, behavior: 'auto'})` lands at 900 and the same
 * call with `'smooth'` leaves the container at 0. That is also what a reader
 * with "reduce motion" on gets. Depending on it would make every chapter chip
 * look dead for those readers.
 *
 * So the position is assigned directly, which always moves the scrollport. A
 * CSS `scroll-behavior: smooth` on the container is not the way out either — it
 * routes the assignment through the same animation path and swallows it again.
 * The jump is instant, and instant beats not moving. Computing the offset
 * (rather than letting `scroll-margin-top` approximate it) also lets the sticky
 * row's measured height be subtracted.
 */
export const scrollAnchorIntoView = (
	heading: HTMLElement,
	stickyOffset = 0
): void => {
	const scroller = findScrollParent(heading);
	if (!scroller) {
		heading.scrollIntoView({ block: 'start' });
		return;
	}
	const top =
		scroller.scrollTop +
		heading.getBoundingClientRect().top -
		scroller.getBoundingClientRect().top -
		stickyOffset;
	scroller.scrollTop = Math.max(0, top);
};

interface LegalReaderBodyProps
	extends Pick<
		LegalTextReaderProps,
		'content' | 'label' | 'language' | 'className'
	> {
	isFullscreen: boolean;
	onToggleFullscreen?: () => void;
	onClose?: () => void;
	toggleRef?: React.Ref<HTMLButtonElement>;
}

const LegalReaderBody = ({
	content,
	label,
	language,
	className,
	isFullscreen,
	onToggleFullscreen,
	onClose,
	toggleRef
}: LegalReaderBodyProps) => {
	const { t: translate } = useTranslation();
	const textRef = useRef<HTMLDivElement>(null);
	const navRef = useRef<HTMLDivElement>(null);
	const [anchors, setAnchors] = useState<LegalHeadingAnchor[]>([]);
	const [activeId, setActiveId] = useState<string | null>(null);

	// Stamp and collect AFTER the sanitized HTML is in the DOM. `useLayoutEffect`
	// rather than `useEffect` so the chip row and the text appear in the same
	// paint — otherwise the row pops in one frame late on every open.
	const restamp = useCallback(() => {
		const collected = stampHeadingAnchors(textRef.current);
		setAnchors((current) =>
			// Only replace the list when it actually differs. The mutation
			// observer below re-runs this on every DOM change, and a new array
			// each time would re-arm the observers on every keystroke elsewhere.
			anchorsKeyOf(current) === anchorsKeyOf(collected)
				? current
				: collected
		);
		setActiveId((current) =>
			collected.some((anchor) => anchor.id === current)
				? current
				: (collected[0]?.id ?? null)
		);
	}, []);

	useLayoutEffect(restamp, [restamp, content, language, isFullscreen]);

	// `LegalContentRenderer` owns a "show original / show translation" toggle for
	// machine-translated documents and swaps its whole subtree from its OWN
	// state — no prop of this component changes when a reader uses it. Without
	// watching the DOM, the chips would keep the previous language's labels and
	// point at headings that are no longer there. Only `childList` is observed:
	// stamping sets attributes, so it cannot retrigger this.
	useEffect(() => {
		const root = textRef.current;
		if (!root || typeof MutationObserver === 'undefined') {
			return undefined;
		}
		const observer = new MutationObserver(restamp);
		observer.observe(root, { childList: true, subtree: true });
		return () => observer.disconnect();
	}, [restamp]);

	const anchorIds = useMemo(() => anchorsKeyOf(anchors), [anchors]);

	// Which chapter is the reader in? The LAST heading that has passed the top of
	// the scrollport.
	//
	// An IntersectionObserver over a thin band at the top looks like the elegant
	// answer and is the wrong one: it only ever reports headings that are IN the
	// band, so once a heading has scrolled above it — which is the normal state
	// while reading a chapter — nothing fires, and jumping the scroll position
	// straight past several chapters reports nothing at all. Measured against
	// this dialog, the selected chip stayed on chapter one all the way to the
	// bottom of the document.
	//
	// A throttled scroll listener answers the question that is actually being
	// asked. The cost is one `getBoundingClientRect` per heading per animation
	// frame WHILE SCROLLING, over a few dozen headings.
	useEffect(() => {
		const root = textRef.current;
		if (!root || !anchorIds) {
			return undefined;
		}

		const headings = anchorIds
			.split('|')
			.map((id) => findHeadingById(root, id))
			.filter((heading): heading is HTMLElement => heading !== null);
		if (!headings.length) {
			return undefined;
		}

		const scroller = findScrollParent(headings[0]);
		const target: HTMLElement | Window = scroller ?? window;

		let frame = 0;
		const update = () => {
			frame = 0;
			const top = scroller ? scroller.getBoundingClientRect().top : 0;
			// A heading counts as reached once its top is at or above the line
			// just under the sticky chip row, with a little tolerance so the
			// chapter you just jumped to counts immediately.
			const line = top + (navRef.current?.offsetHeight ?? 0) + 8;
			let current = headings[0];
			for (const heading of headings) {
				if (heading.getBoundingClientRect().top > line) {
					break;
				}
				current = heading;
			}
			setActiveId(current.id);
		};
		// Cancel-and-reschedule rather than "skip if one is pending". A frame
		// scheduled while the tab or the pane is hidden never runs, and a
		// pending-id guard would then treat the throttle as permanently busy —
		// the selected chip froze on whatever it last computed and never moved
		// again. Measured exactly that in a hidden browser pane.
		const onScroll = () => {
			window.cancelAnimationFrame(frame);
			frame = window.requestAnimationFrame(update);
		};

		// The first measurement waits a frame: on mount the dialog has not laid
		// out yet, and measuring then picks a chapter at random and scrolls the
		// chip row to it.
		frame = window.requestAnimationFrame(update);
		target.addEventListener('scroll', onScroll, { passive: true });
		return () => {
			target.removeEventListener('scroll', onScroll);
			window.cancelAnimationFrame(frame);
		};
	}, [anchorIds, isFullscreen]);

	const selectAnchor = useCallback((anchorId: string) => {
		const heading = findHeadingById(textRef.current, anchorId);
		if (!heading) {
			return;
		}
		setActiveId(anchorId);
		// Focus FIRST, scroll second. Moving focus is what makes the chips work
		// for a keyboard or screen-reader user — scrolling alone leaves them
		// reading the old chapter — and `preventScroll` keeps the focus call
		// itself from jumping.
		heading.focus({ preventScroll: true });
		scrollAnchorIntoView(heading, navRef.current?.offsetHeight ?? 0);
	}, []);

	return (
		<div
			className={clsx(
				'legalTextReader',
				isFullscreen && 'legalTextReader--fullscreen',
				className
			)}
			data-testid="legal-reader"
		>
			<div className="legalTextReader__nav" ref={navRef}>
				<LegalAnchorChips
					anchors={anchors}
					activeId={activeId}
					onSelect={selectAnchor}
					ariaLabel={translate(
						'legal.reader.chapters',
						'Kapitel dieses Dokuments'
					)}
				/>
				{onToggleFullscreen && (
					<button
						ref={toggleRef}
						type="button"
						className={clsx(
							'legalTextReader__fullscreenBtn',
							isFullscreen &&
								'legalTextReader__fullscreenBtn--exit'
						)}
						data-testid="legal-reader-fullscreen-toggle"
						aria-pressed={isFullscreen}
						aria-label={
							isFullscreen
								? translate(
										'legal.reader.exitFullscreen',
										'Vollbild verlassen'
									)
								: translate(
										'legal.reader.fullscreen',
										'Im Vollbild lesen'
									)
						}
						onClick={onToggleFullscreen}
					>
						{isFullscreen ? (
							<MinimizeContentIcon />
						) : (
							<MaximizeContentIcon />
						)}
					</button>
				)}
				{/* Fullscreen hides the host dialog's own ✕, so the reader would
				    otherwise have to leave fullscreen first just to close. */}
				{isFullscreen && onClose && (
					<button
						type="button"
						className="legalTextReader__closeBtn"
						data-testid="legal-reader-close"
						aria-label={translate('app.close', 'Schließen')}
						onClick={onClose}
					>
						<CrossMarkIcon />
					</button>
				)}
			</div>

			<div className="legalTextReader__text" ref={textRef}>
				<LegalContentRenderer content={content} language={language} />
			</div>
		</div>
	);
};

export default LegalTextReader;
