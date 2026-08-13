import * as React from 'react';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import './buttonGroup.styles';

/**
 * M3 **button group** — the design-system primitive behind every
 * "question box" that offers the reader two or more equally weighted answers
 * (case-handover consent, Carimat quick guides, future prompt cards).
 *
 * Figma sources this was matched against:
 *
 * | Concern                    | File                    | Node          |
 * | -------------------------- | ----------------------- | ------------- |
 * | In-chat consent message    | App.Oriso               | `9564-86125`  |
 * | Alignment modes            | App.Oriso               | `9564-86390`  |
 * | Stacked / outline          | Design System M3_ORISO  | `61592-12039` |
 * | Vertical / outline         | Design System M3_ORISO  | `58424-8446`  |
 * | Stacked / tonal            | Design System M3_ORISO  | `61592-11878` |
 * | Vertical / tonal           | Design System M3_ORISO  | `58424-8462`  |
 * | Stacked / primary          | Design System M3_ORISO  | `61592-12083` |
 *
 * It is deliberately *not* built on `components/button/Button`: that component
 * carries the legacy PRIMARY/SECONDARY/TERTIARY app-chrome styling (200px
 * minimum width, uppercase-ish label rhythm, `AUTO_CLOSE` timers) which is a
 * different design contract from the M3 group buttons here.
 */

export const BUTTON_GROUP_VARIANTS = ['primary', 'tonal', 'outline'] as const;
export type ButtonGroupVariant = (typeof BUTTON_GROUP_VARIANTS)[number];

export const BUTTON_GROUP_ALIGNMENTS = [
	'stacked',
	'horizontal-flex',
	'horizontal-scroll'
] as const;
export type ButtonGroupAlignment = (typeof BUTTON_GROUP_ALIGNMENTS)[number];

export interface ButtonGroupItem {
	/** Stable DOM id — also used as the React key when present. */
	id?: string;
	label: string;
	onClick?: () => void;
	/**
	 * Renders the *native* `disabled` attribute, not just a greyed class, so
	 * the control leaves the tab order and announces itself as unavailable.
	 */
	disabled?: boolean;
	/**
	 * Boxed digit in front of the label (Figma `looks_one` / `looks_two`).
	 * Pass a number to force it; `numbered` on the group derives 1…n.
	 */
	badge?: number;
	/** Leading icon, used when the item carries no badge. */
	icon?: React.ReactElement;
	/** Per-item override of the group variant (e.g. one primary + one tonal). */
	variant?: ButtonGroupVariant;
	/** Value for `data-cy`. */
	testingAttribute?: string;
	/** Accessible name when the visible label is not enough on its own. */
	ariaLabel?: string;
	type?: 'button' | 'submit' | 'reset';
}

export interface ButtonGroupProps {
	items: ButtonGroupItem[];
	/** Default fill for every item. */
	variant?: ButtonGroupVariant;
	/** Layout mode; `horizontal-flex` falls back to stacked when it must. */
	alignment?: ButtonGroupAlignment;
	/** Numbers the items 1…n with the boxed-digit badge. */
	numbered?: boolean;
	/**
	 * Turns off the measured fallback so `horizontal-flex` stays on one line
	 * and clips. Only for stories that need to show the un-stacked state.
	 */
	disableAutoStack?: boolean;
	/** Accessible name of the group itself. */
	ariaLabel?: string;
	className?: string;
	testingAttribute?: string;
}

const BoxedDigit = ({ value }: { value: number }) => (
	<span className="buttonGroup__badge" aria-hidden="true">
		{value}
	</span>
);

/**
 * Inner content, shared by the real control and its hidden measuring twin.
 * The twin has to be the *same element type*: a `<span>` copy measured 8%
 * narrow, because the surrounding chat stylesheet blockifies spans and the
 * badge collapsed. It stays out of the accessibility tree and the tab order
 * through `aria-hidden` on its wrapper plus `disabled` on the twin itself,
 * and it carries no `id` or `data-cy` so nothing can target it twice.
 */
const ButtonGroupItemContent = ({
	item,
	badge
}: {
	item: ButtonGroupItem;
	badge?: number;
}) => (
	<>
		{badge !== undefined ? (
			<BoxedDigit value={badge} />
		) : (
			item.icon && (
				<span className="buttonGroup__icon" aria-hidden="true">
					{item.icon}
				</span>
			)
		)}
		<span className="buttonGroup__label">{item.label}</span>
	</>
);

export const ButtonGroup = ({
	items,
	variant = 'primary',
	alignment = 'horizontal-flex',
	numbered = false,
	disableAutoStack = false,
	ariaLabel,
	className,
	testingAttribute
}: ButtonGroupProps) => {
	const containerRef = useRef<HTMLDivElement>(null);
	const mirrorRef = useRef<HTMLDivElement>(null);
	const [mustStack, setMustStack] = useState(false);

	/**
	 * Auto-stacking is **measured**, not guessed at a breakpoint.
	 *
	 * `flex-wrap` would only break the row into a ragged second line — the
	 * Figma fallback (`9564-86390` "Stacked") is full-width items, which wrap
	 * cannot produce. A container query would need a hard-coded width, but the
	 * width at which two labels stop fitting depends on the translation:
	 * "Zugriff verweigern" is 40% wider than "Decline access", and Weblate can
	 * change either at any time. So the group keeps a hidden, unconstrained
	 * copy of the single-line row and compares its intrinsic width with the
	 * space actually available. The copy never changes shape, which is what
	 * keeps the decision hysteresis-free: measuring the live row instead would
	 * oscillate, because once stacked the row always "fits".
	 */
	const measure = useCallback(() => {
		const container = containerRef.current;
		const mirror = mirrorRef.current;
		if (!container || !mirror) return;

		/*
		 * Fractional widths on purpose. `clientWidth` / `scrollWidth` are
		 * integers — one rounds down, the other up — so a row that fits its
		 * container exactly (the chat bubble hugs this very group) reads as
		 * 1px too wide and stacks for no reason. `.buttonGroup` carries no
		 * padding or border of its own, so its border box is its content box.
		 */
		const available = container.getBoundingClientRect().width;
		const required = mirror.getBoundingClientRect().width;
		setMustStack(available > 0 && required > available + 1);
	}, []);

	const autoStackEnabled =
		alignment === 'horizontal-flex' && !disableAutoStack;

	useLayoutEffect(() => {
		if (!autoStackEnabled) {
			setMustStack(false);
			return undefined;
		}

		measure();

		if (typeof ResizeObserver === 'undefined') return undefined;

		const observer = new ResizeObserver(measure);
		if (containerRef.current) observer.observe(containerRef.current);
		if (mirrorRef.current) observer.observe(mirrorRef.current);
		return () => observer.disconnect();
	}, [autoStackEnabled, measure, items, numbered, variant]);

	/**
	 * Web fonts land after first paint and change the row's intrinsic width,
	 * so a group measured against the fallback font can stay on one line and
	 * then clip. `document.fonts` is absent in jsdom, hence the guard.
	 */
	useLayoutEffect(() => {
		if (!autoStackEnabled) return undefined;
		const fonts = (document as any).fonts;
		if (!fonts?.ready?.then) return undefined;

		let cancelled = false;
		fonts.ready.then(() => {
			if (!cancelled) measure();
		});
		return () => {
			cancelled = true;
		};
	}, [autoStackEnabled, measure]);

	const effectiveAlignment: ButtonGroupAlignment = mustStack
		? 'stacked'
		: alignment;

	const badgeFor = (item: ButtonGroupItem, index: number) => {
		if (item.badge !== undefined) return item.badge;
		return numbered ? index + 1 : undefined;
	};

	const itemClassName = (item: ButtonGroupItem) =>
		clsx(
			'buttonGroup__item',
			`buttonGroup__item--${item.variant ?? variant}`
		);

	return (
		<div
			ref={containerRef}
			role="group"
			aria-label={ariaLabel}
			data-cy={testingAttribute}
			data-alignment={effectiveAlignment}
			data-auto-stacked={
				autoStackEnabled && mustStack ? 'true' : undefined
			}
			className={clsx(
				'buttonGroup',
				`buttonGroup--${effectiveAlignment}`,
				className
			)}
		>
			<div className="buttonGroup__track">
				{items.map((item, index) => (
					<button
						key={item.id ?? `${item.label}-${index}`}
						id={item.id}
						type={item.type ?? 'button'}
						className={itemClassName(item)}
						disabled={item.disabled}
						aria-label={item.ariaLabel}
						data-cy={item.testingAttribute}
						onClick={item.onClick}
					>
						<ButtonGroupItemContent
							item={item}
							badge={badgeFor(item, index)}
						/>
					</button>
				))}
			</div>

			{autoStackEnabled && (
				// 0×0 clipper: the twin must not contribute to any ancestor's
				// scroll size while still being free to take its natural width.
				<div className="buttonGroup__mirrorClip" aria-hidden="true">
					<div
						ref={mirrorRef}
						className="buttonGroup__track buttonGroup__track--mirror"
					>
						{items.map((item, index) => (
							<button
								key={item.id ?? `${item.label}-${index}`}
								type="button"
								className={itemClassName(item)}
								tabIndex={-1}
								disabled
							>
								<ButtonGroupItemContent
									item={item}
									badge={badgeFor(item, index)}
								/>
							</button>
						))}
					</div>
				</div>
			)}
		</div>
	);
};
