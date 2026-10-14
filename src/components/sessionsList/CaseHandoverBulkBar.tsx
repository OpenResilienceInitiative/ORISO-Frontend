import * as React from 'react';
import { forwardRef } from 'react';
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

interface CaseHandoverBulkBarProps {
	count: number;
	labels: CaseHandoverBulkBarLabels;
	onContinue: () => void;
	onCancel: () => void;
}

/**
 * FE#1725 US23/24: sticky bar while batch mode is on. Always shows the way
 * forward ("N selected – Continue") and a way out ("Cancel").
 */
export const CaseHandoverBulkBar = forwardRef<
	HTMLButtonElement,
	CaseHandoverBulkBarProps
>(({ count, labels, onContinue, onCancel }, continueRef) => {
	const hintId = React.useId();
	const empty = count === 0;
	return (
		<section
			className="caseHandoverBulkBar"
			aria-label={labels.region}
			data-search-keep-open
			data-cy="case-handover-bulk-bar"
		>
			<p className="caseHandoverBulkBar__count" role="status">
				{labels.selected}
			</p>
			{empty && (
				<p id={hintId} className="caseHandoverBulkBar__hint">
					{labels.emptyHint}
				</p>
			)}
			<div className="caseHandoverBulkBar__actions">
				<button
					type="button"
					className="caseHandoverBulkBar__button caseHandoverBulkBar__button--text"
					onClick={onCancel}
					data-cy="case-handover-bulk-cancel"
				>
					{labels.cancel}
				</button>
				<button
					ref={continueRef}
					type="button"
					className="caseHandoverBulkBar__button caseHandoverBulkBar__button--filled"
					// aria-disabled keeps it focusable and explained by the hint.
					aria-disabled={empty || undefined}
					aria-describedby={empty ? hintId : undefined}
					onClick={() => {
						if (!empty) onContinue();
					}}
					data-cy="case-handover-bulk-continue"
				>
					{labels.continueLabel}
				</button>
			</div>
		</section>
	);
});

CaseHandoverBulkBar.displayName = 'CaseHandoverBulkBar';
