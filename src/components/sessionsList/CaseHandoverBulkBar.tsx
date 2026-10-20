import * as React from 'react';
import {
	forwardRef,
	useImperativeHandle,
	useLayoutEffect,
	useRef
} from 'react';
import { ButtonGroup } from '../buttonGroup/ButtonGroup';
import {
	removeComposerClearance,
	updateComposerClearance
} from '../m3Snackbar/composerClearance';
import './caseHandoverBulkBar.styles.scss';

export interface CaseHandoverBulkBarLabels {
	/** Landmark name of the bar. */
	region: string;
	/** "N selected", already interpolated. */
	selected: string;
	continueLabel: string;
	cancel: string;
	/** Shown next to a disabled Continue while nothing is selected. */
	emptyHint: string;
}

/** Gap between the bar and a floating notice above it (M3 16 dp). */
const NOTICE_GAP = 16;

interface CaseHandoverBulkBarProps {
	count: number;
	labels: CaseHandoverBulkBarLabels;
	onContinue: () => void;
	onCancel: () => void;
}

/**
 * FE#1725 US23/24: sticky bar while batch mode is on. Always shows the way
 * forward ("N selected – Continue") and a way out ("Cancel"). Buttons are
 * the shared M3 ButtonGroup (outline + primary). The ref is the focus
 * target: Continue, or Cancel while Continue is disabled.
 */
export const CaseHandoverBulkBar = forwardRef<
	HTMLButtonElement | null,
	CaseHandoverBulkBarProps
>(({ count, labels, onContinue, onCancel }, continueRef) => {
	const continueId = React.useId();
	const rootRef = useRef<HTMLElement>(null);
	// The ref is where focus returns: Continue, or Cancel while Continue is
	// disabled (nothing selected, e.g. after every request succeeded), since
	// a disabled button cannot take focus.
	useImperativeHandle(continueRef, () => {
		const root = rootRef.current;
		const next = root?.querySelector<HTMLButtonElement>(
			`[id="${continueId}"]`
		);
		if (next && !next.disabled) return next;
		return (
			root?.querySelector<HTMLButtonElement>(
				'[data-cy="case-handover-bulk-cancel"]'
			) ??
			next ??
			null
		);
	});
	// Floating snackbars (e.g. the recovery-key notice) rest above the bar,
	// as they do above a chat composer, so Continue stays tappable.
	useLayoutEffect(() => {
		const bar = rootRef.current;
		if (!bar) return undefined;
		const measure = () => updateComposerClearance(bar, NOTICE_GAP);
		measure();
		const observer =
			typeof ResizeObserver === 'undefined'
				? null
				: new ResizeObserver(measure);
		observer?.observe(bar);
		window.addEventListener('resize', measure);
		return () => {
			observer?.disconnect();
			window.removeEventListener('resize', measure);
			removeComposerClearance(bar);
		};
	}, []);
	const empty = count === 0;
	return (
		<section
			ref={rootRef}
			className="caseHandoverBulkBar"
			aria-label={labels.region}
			data-search-keep-open
			data-cy="case-handover-bulk-bar"
		>
			<p className="caseHandoverBulkBar__count" role="status">
				{labels.selected}
			</p>
			{empty && (
				<p className="caseHandoverBulkBar__hint">{labels.emptyHint}</p>
			)}
			<ButtonGroup
				className="caseHandoverBulkBar__actions"
				items={[
					{
						label: labels.cancel,
						variant: 'outline',
						onClick: onCancel,
						testingAttribute: 'case-handover-bulk-cancel'
					},
					{
						id: continueId,
						label: labels.continueLabel,
						variant: 'primary',
						disabled: empty,
						onClick: onContinue,
						testingAttribute: 'case-handover-bulk-continue'
					}
				]}
			/>
		</section>
	);
});

CaseHandoverBulkBar.displayName = 'CaseHandoverBulkBar';
