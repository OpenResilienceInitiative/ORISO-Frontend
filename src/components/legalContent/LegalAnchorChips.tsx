import * as React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
	ANCHOR_CHIP_LABEL_MAX,
	truncateAnchorChipLabel,
	type LegalHeadingAnchor
} from './legalHeadingAnchors';
import { ArrowRightIcon, BackIcon } from '../../resources/img/icons';

export interface LegalAnchorChipsProps {
	anchors: LegalHeadingAnchor[];
	/** The chapter last picked or scrolled into view — the filled chip. */
	activeId?: string | null;
	onSelect: (anchorId: string) => void;
	ariaLabel?: string;
}

/** How far one arrow click scrolls the chip row — roughly one chip. */
const SCROLL_STEP = 240;

/**
 * "Chapter Navbar" (Figma 1299-81676), the same component the Admin panel's
 * legal reader carries: M3 input chips in one horizontally scrollable row, the
 * selected chip filled with the secondary container, arrows appearing per side
 * only while that side can still scroll.
 *
 * This is the piece that makes a long legal text usable on a phone. A privacy
 * policy is not read front to back — a reader wants "Ihre Rechte" or "Wer ist
 * verantwortlich", and without the row the only way there is a thumb and
 * patience.
 */
export const LegalAnchorChips = ({
	anchors,
	activeId = null,
	onSelect,
	ariaLabel
}: LegalAnchorChipsProps) => {
	const { t: translate } = useTranslation();
	const rowRef = useRef<HTMLDivElement>(null);
	const [nav, setNav] = useState({
		overflow: false,
		atStart: true,
		atEnd: true
	});

	// Renaming a chapter changes the row width without changing the chapter
	// count, so the overflow calculation has to re-run on any label change too.
	const anchorsKey = anchors
		.map((anchor) => `${anchor.id}:${anchor.text}`)
		.join('|');

	const updateNav = useCallback(() => {
		const row = rowRef.current;
		if (!row) {
			return;
		}
		setNav({
			overflow: row.scrollWidth > row.clientWidth + 1,
			atStart: row.scrollLeft <= 1,
			atEnd: row.scrollLeft + row.clientWidth >= row.scrollWidth - 1
		});
	}, []);

	useEffect(() => {
		const row = rowRef.current;
		if (!row) {
			return undefined;
		}
		updateNav();
		row.addEventListener('scroll', updateNav, { passive: true });
		// ResizeObserver is absent in some test environments — the arrows then
		// stop tracking live resizes instead of the row crashing.
		const observer =
			typeof ResizeObserver === 'undefined'
				? null
				: new ResizeObserver(updateNav);
		observer?.observe(row);
		return () => {
			row.removeEventListener('scroll', updateNav);
			observer?.disconnect();
		};
	}, [anchorsKey, updateNav]);

	// A single chapter is not a navigation, it is a label. Hide the row.
	if (anchors.length < 2) {
		return null;
	}

	// Direct assignment, for the same reason `scrollAnchorIntoView` uses one: a
	// scripted smooth scroll is silently DROPPED — not merely instant — wherever
	// scroll animation is unavailable (embedded browsers, `prefers-reduced-
	// motion`), and both arrows would then look dead. Clamped so a click at
	// either end cannot leave the row in an out-of-range position.
	const scrollByStep = (direction: -1 | 1) => {
		const row = rowRef.current;
		if (!row) {
			return;
		}
		const max = Math.max(0, row.scrollWidth - row.clientWidth);
		row.scrollLeft = Math.min(
			Math.max(0, row.scrollLeft + direction * SCROLL_STEP),
			max
		);
	};

	return (
		<div
			className="legalAnchorChips"
			role="navigation"
			aria-label={ariaLabel}
			data-testid="legal-anchor-chips"
		>
			{nav.overflow && !nav.atStart && (
				<button
					type="button"
					className="legalAnchorChips__navBtn"
					aria-label={translate(
						'editor.anchor.previous',
						'Vorherige Kapitel'
					)}
					onClick={() => scrollByStep(-1)}
				>
					<BackIcon />
				</button>
			)}

			<div className="legalAnchorChips__row" ref={rowRef}>
				{anchors.map((anchor) => {
					const active = anchor.id === activeId;
					return (
						<button
							key={anchor.id}
							type="button"
							data-anchor-chip={anchor.id}
							className={`legalAnchorChips__chip${
								active ? ' legalAnchorChips__chip--active' : ''
							}`}
							aria-pressed={active}
							onClick={() => onSelect(anchor.id)}
						>
							{/* A chip is a signpost, not the heading itself: past
							    33 characters it stops being scannable and starts
							    pushing the other chapters out of the row. The
							    full heading stays available on hover. */}
							<span
								title={
									anchor.text.length > ANCHOR_CHIP_LABEL_MAX
										? anchor.text
										: undefined
								}
							>
								{truncateAnchorChipLabel(anchor.text)}
							</span>
						</button>
					);
				})}
			</div>

			{nav.overflow && !nav.atEnd && (
				<button
					type="button"
					className="legalAnchorChips__navBtn"
					aria-label={translate(
						'editor.anchor.next',
						'Nächste Kapitel'
					)}
					onClick={() => scrollByStep(1)}
				>
					<ArrowRightIcon />
				</button>
			)}
		</div>
	);
};

export default LegalAnchorChips;
