import * as React from 'react';
import { forwardRef, useImperativeHandle, useRef } from 'react';
import { ButtonGroup } from '../buttonGroup/ButtonGroup';
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
 * forward ("N selected – Continue") and a way out ("Cancel"). Buttons are
 * the shared M3 ButtonGroup (outline + primary). The ref is Continue.
 */
export const CaseHandoverBulkBar = forwardRef<
	HTMLButtonElement | null,
	CaseHandoverBulkBarProps
>(({ count, labels, onContinue, onCancel }, continueRef) => {
	const continueId = React.useId();
	const rootRef = useRef<HTMLElement>(null);
	useImperativeHandle(
		continueRef,
		() =>
			rootRef.current?.querySelector<HTMLButtonElement>(
				`[id="${continueId}"]`
			) ?? null
	);
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
