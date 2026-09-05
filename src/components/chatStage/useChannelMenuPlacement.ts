/**
 * Measures anchor, bounds and the card's natural height and asks
 * `placeChannelMenu` where the card goes (review v6). Re-measures on
 * window resize; the hosts pass what "bounds" means for them.
 */
import { useLayoutEffect, useState } from 'react';
import type { RefObject } from 'react';
import {
	placeChannelMenu,
	type ChannelMenuPlacement,
	type ChannelMenuSide
} from './channelMenuPlacement';

export interface ChannelMenuBounds {
	top: number;
	bottom: number;
	/** T33: horizontal bounds — only hosts with an `alignRef` need them. */
	left?: number;
	right?: number;
	/** Elements whose size moves the bounds (the docked composer) — watched. */
	watch?: Element[];
}

export interface UseChannelMenuPlacementOptions {
	open: boolean;
	anchorRef: RefObject<HTMLElement | null>;
	/** Wrapper around the rendered `ChannelMenu`. */
	menuRef: RefObject<HTMLElement | null>;
	/**
	 * T33: the trigger the card's left edge aligns with. The returned
	 * `left` is relative to `anchorRef` (the card's positioned ancestor).
	 */
	alignRef?: RefObject<HTMLElement | null>;
	/** Viewport coordinates of the space the card may use. */
	resolveBounds: () => ChannelMenuBounds | null;
	prefer: ChannelMenuSide;
	flip?: boolean;
}

/** The card's height if nothing clamped it — its list may already scroll. */
export const naturalMenuHeight = (wrapper: HTMLElement): number => {
	const card = wrapper.querySelector<HTMLElement>('.channelMenu') ?? wrapper;
	const list = card.querySelector<HTMLElement>('.channelMenu__list');
	const hiddenRows = list ? list.scrollHeight - list.clientHeight : 0;
	return card.offsetHeight + Math.max(0, hiddenRows);
};

export const useChannelMenuPlacement = ({
	open,
	anchorRef,
	menuRef,
	alignRef,
	resolveBounds,
	prefer,
	flip = true
}: UseChannelMenuPlacementOptions): ChannelMenuPlacement | null => {
	const [placement, setPlacement] = useState<ChannelMenuPlacement | null>(
		null
	);

	useLayoutEffect(() => {
		if (!open) {
			setPlacement(null);
			return undefined;
		}
		const measure = () => {
			const anchor = anchorRef.current;
			const menu = menuRef.current;
			const bounds = resolveBounds();
			if (!anchor || !menu || !bounds) {
				return;
			}
			const rect = anchor.getBoundingClientRect();
			const align = alignRef?.current?.getBoundingClientRect();
			const card =
				menu.querySelector<HTMLElement>('.channelMenu') ?? menu;
			const placed = placeChannelMenu({
				anchorTop: rect.top,
				anchorBottom: rect.bottom,
				boundsTop: bounds.top,
				boundsBottom: bounds.bottom,
				needed: naturalMenuHeight(menu),
				prefer,
				flip,
				...(align &&
				bounds.left !== undefined &&
				bounds.right !== undefined
					? {
							anchorLeft: align.left,
							boundsLeft: bounds.left,
							boundsRight: bounds.right,
							neededWidth: card.offsetWidth
						}
					: {})
			});
			setPlacement(
				placed.left === undefined
					? placed
					: { ...placed, left: placed.left - rect.left }
			);
		};
		measure();
		window.addEventListener('resize', measure);
		// The composer finishes mounting (TipTap) after the card opened and
		// the card itself grows with its rows — follow both.
		const observer =
			typeof ResizeObserver === 'undefined'
				? null
				: new ResizeObserver(measure);
		[
			anchorRef.current,
			menuRef.current,
			...(resolveBounds()?.watch ?? [])
		].forEach((element) => element && observer?.observe(element));
		return () => {
			window.removeEventListener('resize', measure);
			observer?.disconnect();
		};
	}, [open, anchorRef, menuRef, alignRef, resolveBounds, prefer, flip]);

	return placement;
};

/** The composer docked inside `container` (or its bottom edge without one). */
export const boundsAboveComposer = (
	container: HTMLElement | null
): ChannelMenuBounds | null => {
	if (!container) {
		return null;
	}
	const rect = container.getBoundingClientRect();
	const composer = container.querySelector<HTMLElement>(
		'.textarea__wrapper-send-message'
	);
	return {
		top: rect.top,
		bottom: composer ? composer.getBoundingClientRect().top : rect.bottom,
		left: rect.left,
		right: rect.right,
		watch: composer ? [container, composer] : [container]
	};
};
