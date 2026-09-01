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
	className
}: LegalTextReaderProps) => {
	const [isFullscreen, setIsFullscreen] = useState(false);

	const body = (
		<LegalReaderBody
			content={content}
			label={label}
			language={language}
			className={className}
			isFullscreen={isFullscreen}
			onToggleFullscreen={
				allowFullscreen
					? () => setIsFullscreen((open) => !open)
					: undefined
			}
		/>
	);

	if (!isFullscreen) {
		return body;
	}

	return (
		<>
			{/* The in-place copy stays mounted so closing fullscreen returns the
			    host to the layout it had, rather than to an empty box. */}
			<div aria-hidden="true" className="legalTextReader__placeholder" />
			<div
				className="legalTextReader__fullscreen"
				role="dialog"
				aria-modal="true"
				aria-label={label}
				data-testid="legal-reader-fullscreen"
			>
				{body}
			</div>
		</>
	);
};

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
}

const LegalReaderBody = ({
	content,
	label,
	language,
	className,
	isFullscreen,
	onToggleFullscreen
}: LegalReaderBodyProps) => {
	const { t: translate } = useTranslation();
	const textRef = useRef<HTMLDivElement>(null);
	const navRef = useRef<HTMLDivElement>(null);
	const [anchors, setAnchors] = useState<LegalHeadingAnchor[]>([]);
	const [activeId, setActiveId] = useState<string | null>(null);

	// Stamp and collect AFTER the sanitized HTML is in the DOM. `useLayoutEffect`
	// rather than `useEffect` so the chip row and the text appear in the same
	// paint — otherwise the row pops in one frame late on every open.
	useLayoutEffect(() => {
		const collected = stampHeadingAnchors(textRef.current);
		setAnchors(collected);
		setActiveId(collected[0]?.id ?? null);
	}, [content, language, isFullscreen]);

	const anchorIds = useMemo(
		() => anchors.map((anchor) => anchor.id).join('|'),
		[anchors]
	);

	// Which chapter is the reader in? The topmost heading that has passed the
	// top of the scrollport. IntersectionObserver rather than a scroll handler
	// so this costs nothing while the reader is idle.
	useEffect(() => {
		const root = textRef.current;
		if (
			!root ||
			!anchorIds ||
			typeof IntersectionObserver === 'undefined'
		) {
			return undefined;
		}

		const headings = anchorIds
			.split('|')
			.map((id) => findHeadingById(root, id))
			.filter((heading): heading is HTMLElement => heading !== null);

		const observer = new IntersectionObserver(
			(entries) => {
				const entered = entries
					.filter((entry) => entry.isIntersecting)
					.sort(
						(a, b) =>
							a.boundingClientRect.top - b.boundingClientRect.top
					)[0];
				if (entered?.target.id) {
					setActiveId(entered.target.id);
				}
			},
			// The band is the top fifth of the scrollport: a heading counts as
			// "the chapter you are in" once it reaches the top, not when it is
			// merely somewhere on screen.
			{ rootMargin: '0px 0px -80% 0px', threshold: 0 }
		);
		headings.forEach((heading) => observer.observe(heading));
		return () => observer.disconnect();
	}, [anchorIds]);

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
						type="button"
						className="legalTextReader__fullscreenBtn"
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
			</div>

			<div className="legalTextReader__text" ref={textRef}>
				<LegalContentRenderer content={content} language={language} />
			</div>
		</div>
	);
};

export default LegalTextReader;
