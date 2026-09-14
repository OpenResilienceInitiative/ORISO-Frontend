import * as React from 'react';
import clsx from 'clsx';
import TuneIcon from '@mui/icons-material/Tune';
import './displayFilter.styles.scss';

export interface DisplayFilterButtonProps {
	/** Already translated; tooltip and accessible name. */
	'label': string;
	/** True when the effective filter differs from "show everything" → dot. */
	'customised': boolean;
	/** Whether the dialog it controls is open (`aria-expanded`). */
	'open': boolean;
	'onClick': () => void;
	/** id of the dialog for `aria-controls`. */
	'controlsId'?: string;
	'data-cy'?: string;
}

/**
 * The minimalist entry point to the display filter (#1377, spec §3): an
 * icon-only pill at the right end of the chip row, `tune` glyph, with a small
 * dot while the section's filter is customised. Same pill primitive as
 * `MarkAllReadButton` so the row reads as one family.
 */
export const DisplayFilterButton = ({
	label,
	customised,
	open,
	onClick,
	controlsId,
	'data-cy': dataCy = 'display-filter-button'
}: DisplayFilterButtonProps) => (
	<button
		type="button"
		className={clsx(
			'sessionsListToolbar__chip sessionsListToolbar__chip--iconOnly displayFilterButton',
			customised && 'displayFilterButton--customised'
		)}
		onClick={onClick}
		title={label}
		aria-label={label}
		aria-haspopup="dialog"
		aria-expanded={open}
		aria-controls={controlsId}
		data-cy={dataCy}
	>
		<TuneIcon className="sessionsListToolbar__chipIconSvg" />
		{customised && (
			<span className="displayFilterButton__dot" aria-hidden="true" />
		)}
	</button>
);
