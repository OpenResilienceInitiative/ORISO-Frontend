/**
 * WP-B1 — desktop layout container: main chat left, side panel right,
 * draggable divider (pointer + keyboard) with minimum widths.
 *
 * Below `breakpoint` px the stage is single-pane: it shows `main` or
 * `secondary` full-width according to `activePane`, and the owner places a
 * `SupervisionPanelMini` (fab) in the `switcher` slot to flip between them.
 * `mode` can be forced by the owner (stories do) or derived from the viewport.
 */
import * as React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DragDelta, useDragHandle } from './useDragHandle';
import './supervisionPanel.styles.scss';

export type SplitStageMode = 'split' | 'single';
export type SplitStagePane = 'main' | 'secondary';

export interface SplitStageProps {
	'main': React.ReactNode;
	'secondary'?: React.ReactNode;
	/** Whether the secondary pane is shown at all (split) / reachable (single). */
	'secondaryOpen': boolean;
	/** Force a layout; omitted → `single` below `breakpoint`, else `split`. */
	'mode'?: SplitStageMode;
	/** Single mode only: which pane fills the stage. */
	'activePane'?: SplitStagePane;
	/** Controlled secondary width in px; omit for uncontrolled. */
	'secondaryWidth'?: number;
	'defaultSecondaryWidth'?: number;
	'onSecondaryWidthChange'?: (width: number) => void;
	'minMainWidth'?: number;
	'minSecondaryWidth'?: number;
	/** Viewport width below which the stage becomes single-pane. */
	'breakpoint'?: number;
	/** Floating switcher (mini card / fab) rendered above the stage. */
	'switcher'?: React.ReactNode;
	'className'?: string;
	'data-cy'?: string;
}

const useViewportMode = (
	breakpoint: number,
	forced?: SplitStageMode
): SplitStageMode => {
	const query = `(width < ${breakpoint}px)`;
	const [narrow, setNarrow] = useState<boolean>(() =>
		typeof window !== 'undefined' && window.matchMedia
			? window.matchMedia(query).matches
			: false
	);
	useEffect(() => {
		if (typeof window === 'undefined' || !window.matchMedia) {
			return undefined;
		}
		const media = window.matchMedia(query);
		const update = () => setNarrow(media.matches);
		update();
		media.addEventListener('change', update);
		return () => media.removeEventListener('change', update);
	}, [query]);
	return forced ?? (narrow ? 'single' : 'split');
};

export const SplitStage = ({
	main,
	secondary,
	secondaryOpen,
	'mode': forcedMode,
	activePane = 'main',
	secondaryWidth,
	defaultSecondaryWidth = 420,
	onSecondaryWidthChange,
	minMainWidth = 360,
	minSecondaryWidth = 320,
	breakpoint = 768,
	switcher,
	className,
	'data-cy': dataCy = 'split-stage'
}: SplitStageProps) => {
	const { t: translate } = useTranslation();
	const mode = useViewportMode(breakpoint, forcedMode);
	const stageRef = useRef<HTMLDivElement | null>(null);
	const dividerRef = useRef<HTMLDivElement | null>(null);
	const [internalWidth, setInternalWidth] = useState(defaultSecondaryWidth);
	const width = secondaryWidth ?? internalWidth;
	// Last emitted width, so pointer moves between renders accumulate.
	const widthRef = useRef(width);
	widthRef.current = width;

	// The secondary pane is border-box, so `width` is what it occupies; the
	// divider's own width is the only other thing taken from the main pane.
	const maxSecondaryWidth = useCallback(() => {
		const stageWidth = stageRef.current?.getBoundingClientRect().width;
		const dividerWidth = dividerRef.current?.offsetWidth ?? 0;
		return stageWidth
			? Math.max(
					minSecondaryWidth,
					stageWidth - dividerWidth - minMainWidth
				)
			: Number.POSITIVE_INFINITY;
	}, [minMainWidth, minSecondaryWidth]);

	const applyWidth = useCallback(
		(next: number) => {
			const clamped = Math.round(
				Math.min(maxSecondaryWidth(), Math.max(minSecondaryWidth, next))
			);
			widthRef.current = clamped;
			if (secondaryWidth === undefined) {
				setInternalWidth(clamped);
			}
			onSecondaryWidthChange?.(clamped);
		},
		[
			maxSecondaryWidth,
			minSecondaryWidth,
			secondaryWidth,
			onSecondaryWidthChange
		]
	);

	// Dragging the divider left widens the secondary pane.
	const move = useCallback(
		(delta: DragDelta) => applyWidth(widthRef.current - delta.dx),
		[applyWidth]
	);

	const { handleProps, isDragging } = useDragHandle({
		onMove: move,
		onKeyDown: (event) => {
			if (event.key === 'Home') {
				event.preventDefault();
				applyWidth(minSecondaryWidth);
			} else if (event.key === 'End') {
				event.preventDefault();
				applyWidth(maxSecondaryWidth());
			}
		}
	});

	const showSecondary = secondaryOpen && !!secondary;
	const classes = [
		'splitStage',
		`splitStage--${mode}`,
		showSecondary ? 'splitStage--withSecondary' : 'splitStage--mainOnly',
		isDragging && 'splitStage--dragging',
		className
	]
		.filter(Boolean)
		.join(' ');

	const singleShowsSecondary =
		mode === 'single' && showSecondary && activePane === 'secondary';

	return (
		<div
			ref={stageRef}
			className={classes}
			data-cy={dataCy}
			data-mode={mode}
			data-active-pane={mode === 'single' ? activePane : undefined}
		>
			{!singleShowsSecondary && (
				<div
					className="splitStage__main"
					data-cy="split-stage-main"
					aria-label={translate('supervision.panel.stage.mainPane')}
				>
					{main}
				</div>
			)}

			{mode === 'split' && showSecondary && (
				<div
					ref={dividerRef}
					className="splitStage__divider"
					role="separator"
					aria-orientation="vertical"
					aria-label={translate('supervision.panel.stage.divider')}
					aria-valuenow={Math.round(width)}
					aria-valuemin={minSecondaryWidth}
					aria-valuemax={
						Number.isFinite(maxSecondaryWidth())
							? Math.round(maxSecondaryWidth())
							: undefined
					}
					tabIndex={0}
					data-cy="split-stage-divider"
					{...handleProps}
				>
					<span
						className="splitStage__dividerGrip"
						aria-hidden="true"
					/>
				</div>
			)}

			{showSecondary && (mode === 'split' || singleShowsSecondary) && (
				<div
					className="splitStage__secondary"
					data-cy="split-stage-secondary"
					aria-label={translate(
						'supervision.panel.stage.secondaryPane'
					)}
					style={mode === 'split' ? { width } : undefined}
				>
					{secondary}
				</div>
			)}

			{switcher}
		</div>
	);
};

export default SplitStage;
