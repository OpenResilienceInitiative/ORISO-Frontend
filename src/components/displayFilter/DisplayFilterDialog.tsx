import * as React from 'react';
import { useId } from 'react';
import TuneIcon from '@mui/icons-material/Tune';
import { M3Dialog } from '../m3Dialog/M3Dialog';
import { Switch } from '../Switch';
import {
	DisplayFilterKindOption,
	DisplayFilterValue
} from './displayFilterTypes';
import { DisplayFilterKindTable } from './DisplayFilterKindTable';
import './displayFilter.styles.scss';

/** Every string the dialog renders, already translated (the dialog never calls `t`). */
export interface DisplayFilterDialogLabels {
	/** "Anzeige-Filter · Zeitstrahl" */
	title: string;
	description: string;
	showColumn: string;
	pillColumn: string;
	/** Accessible name of one show checkbox, e.g. "Anzeigen: Anfragen". */
	showKind: (kindLabel: string) => string;
	pillKind: (kindLabel: string) => string;
	/** Visible hint under the "other" row, linked to its fixed show checkbox. */
	otherFixed: string;
	/** Screen-reader text of the empty Pill cell of a show-only kind. */
	pillNotApplicable: string;
	autoRead: string;
	autoReadDescription: string;
	reset: string;
	done: string;
	close: string;
	profileLink: string;
	/** Shown instead of the rows' controls when the store is read-only (newer version). */
	readOnlyHint: string;
}

export interface DisplayFilterDialogProps {
	open: boolean;
	onClose: () => void;
	kinds: ReadonlyArray<DisplayFilterKindOption>;
	value: DisplayFilterValue;
	onChange: (next: DisplayFilterValue) => void;
	/** Clears the section override (spec §4). */
	onReset: () => void;
	/** Sections without auto-read (Anfragen, spec §5.3) hide the switch. */
	showAutoRead?: boolean;
	/** Store in read-only mode (spec §7 version rule): controls disabled, hint shown. */
	readOnly?: boolean;
	onOpenProfile?: () => void;
	labels: DisplayFilterDialogLabels;
	/**
	 * A section override exists that reset would delete (spec §4). NOT the
	 * button dot's "effective filter is customised": profile-only filtering
	 * has nothing to reset, and an override equal to the defaults still does.
	 */
	canReset?: boolean;
	/** M3 full-screen presentation on phones (Q7); the caller passes `useResponsive().untilL`. */
	fullScreen?: boolean;
	/** DOM id of the dialog surface, referenced by the button's `aria-controls`. */
	id?: string;
}

/**
 * The display-filter dialog (#1377, spec §3): one row per kind with two
 * independent switches — **show** (rows of this kind appear at all) and
 * **pill** (a chip while the kind has unread items) — the auto-read rule and
 * a reset to the profile defaults. Presentational: the caller owns the value
 * (slice 2 store) and the list integration (slices 3–5).
 */
export const DisplayFilterDialog = ({
	open,
	onClose,
	kinds,
	value,
	onChange,
	onReset,
	showAutoRead = true,
	readOnly = false,
	onOpenProfile,
	labels,
	canReset = false,
	fullScreen = false,
	id
}: DisplayFilterDialogProps) => {
	const generatedId = useId();
	const dialogId = id ?? generatedId;

	return (
		<M3Dialog
			open={open}
			onClose={onClose}
			title={labels.title}
			description={labels.description}
			icon={<TuneIcon />}
			closeLabel={labels.close}
			width={480}
			fullScreen={fullScreen}
			className="displayFilterDialog"
			id={dialogId}
			data-testid={dialogId}
			actions={[
				{
					label: labels.reset,
					onClick: onReset,
					disabled: readOnly || !canReset,
					testId: 'display-filter-reset'
				},
				{
					label: labels.done,
					onClick: onClose,
					primary: true,
					testId: 'display-filter-done'
				}
			]}
		>
			{readOnly && (
				<p className="displayFilterDialog__readOnly" role="status">
					{labels.readOnlyHint}
				</p>
			)}
			<DisplayFilterKindTable
				kinds={kinds}
				value={value}
				onChange={onChange}
				readOnly={readOnly}
				labels={labels}
				idPrefix={dialogId}
			/>

			{showAutoRead && (
				<div className="displayFilterDialog__autoRead">
					<div className="displayFilterDialog__autoReadText">
						<span
							className="displayFilterDialog__autoReadTitle"
							id={`${dialogId}-autoread`}
						>
							{labels.autoRead}
						</span>
						<span
							className="displayFilterDialog__autoReadDescription"
							id={`${dialogId}-autoread-desc`}
						>
							{labels.autoReadDescription}
						</span>
					</div>
					<Switch
						checked={value.autoReadHidden}
						disabled={readOnly}
						aria-labelledby={`${dialogId}-autoread`}
						aria-describedby={`${dialogId}-autoread-desc`}
						data-cy="display-filter-autoread"
						onChange={(checked) =>
							onChange({ ...value, autoReadHidden: checked })
						}
					/>
				</div>
			)}

			{onOpenProfile && (
				<button
					type="button"
					className="displayFilterDialog__profileLink"
					onClick={onOpenProfile}
					data-cy="display-filter-profile-link"
				>
					{labels.profileLink}
				</button>
			)}
		</M3Dialog>
	);
};
