import * as React from 'react';
import { useId } from 'react';
import TuneIcon from '@mui/icons-material/Tune';
import clsx from 'clsx';
import { M3Dialog } from '../m3Dialog/M3Dialog';
import { Switch } from '../Switch';
import {
	CHIP_VIEWS,
	ChipView,
	DisplayFilterKindOption,
	DisplayFilterValue,
	resolveChipPresentation,
	resolveKindSetting,
	setKindSetting
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
	/** "Ton" — the sound column (Gespräche/Anfragen). */
	soundColumn: string;
	/** Accessible name of one sound checkbox, e.g. "Ton: Mail". */
	soundKind: (kindLabel: string) => string;
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
	/** Footer: "Diese Liste weicht von deinen Standards ab." */
	overrideNotice: string;
	/** Footer reset action, short: "Zurücksetzen". */
	resetShort: string;
	done: string;
	close: string;
	profileLink: string;
	/** Shown instead of the rows' controls when the store is read-only (newer version). */
	readOnlyHint: string;
	/** "Ansicht der Pillen" — legend of the view radio group. */
	viewTitle: string;
	viewIcons: string;
	viewLabels: string;
	viewText: string;
	/** "Ungelesenes nach links sortieren" */
	autoSort: string;
	autoSortDescription: string;
	/** Row hint of a kind the Träger switched off while rows still exist. */
	deactivatedHint: string;
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
	/**
	 * Which per-kind columns the table offers (Frank 2026-09-16): the
	 * Zeitstrahl hides kinds ("In der Liste"), Gespräche and Anfragen mute
	 * them ("Ton") instead. "Als Pille" is always there.
	 */
	columns?: DisplayFilterColumns;
	/** Hero icon of the dialog: the list's own icon (Frank 2026-09-16), default `tune`. */
	icon?: React.ReactNode;
}

export interface DisplayFilterColumns {
	show: boolean;
	sound: boolean;
}

export const TIMELINE_COLUMNS: DisplayFilterColumns = {
	show: true,
	sound: false
};
export const SESSION_COLUMNS: DisplayFilterColumns = {
	show: false,
	sound: true
};

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
	id,
	columns = TIMELINE_COLUMNS,
	icon
}: DisplayFilterDialogProps) => {
	// Show-only kinds (the future timeline panel) have no row in the sound
	// mode table; they keep a plain switch so the panel stays toggleable.
	const panelKinds = columns.show
		? []
		: kinds.filter((kind) => kind.showOnly);
	const generatedId = useId();
	const dialogId = id ?? generatedId;
	const presentation = resolveChipPresentation(value);
	const setView = (view: ChipView) => onChange({ ...value, view });

	return (
		<M3Dialog
			open={open}
			onClose={onClose}
			title={labels.title}
			description={labels.description}
			icon={icon ?? <TuneIcon />}
			closeLabel={labels.close}
			width={480}
			fullScreen={fullScreen}
			className="displayFilterDialog"
			id={dialogId}
			data-testid={dialogId}
			actions={[
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
				columns={columns}
			/>

			<fieldset
				className="displayFilterDialog__view"
				data-cy="display-filter-view"
			>
				<legend className="displayFilterDialog__viewTitle">
					{labels.viewTitle}
				</legend>
				<div
					className="displayFilterDialog__viewOptions"
					role="radiogroup"
					aria-label={labels.viewTitle}
				>
					{CHIP_VIEWS.map((view) => (
						<label
							key={view}
							className={clsx(
								'displayFilterDialog__viewOption',
								presentation.view === view &&
									'displayFilterDialog__viewOption--selected'
							)}
						>
							<input
								type="radio"
								name={`${dialogId}-view`}
								value={view}
								checked={presentation.view === view}
								disabled={readOnly}
								onChange={() => setView(view)}
								data-cy={`display-filter-view-${view}`}
							/>
							<span>
								{view === 'icons'
									? labels.viewIcons
									: view === 'labels'
										? labels.viewLabels
										: labels.viewText}
							</span>
						</label>
					))}
				</div>
			</fieldset>

			<div className="displayFilterDialog__autoRead">
				<div className="displayFilterDialog__autoReadText">
					<span
						className="displayFilterDialog__autoReadTitle"
						id={`${dialogId}-autosort`}
					>
						{labels.autoSort}
					</span>
					<span
						className="displayFilterDialog__autoReadDescription"
						id={`${dialogId}-autosort-desc`}
					>
						{labels.autoSortDescription}
					</span>
				</div>
				<Switch
					checked={presentation.autoSort}
					disabled={readOnly}
					aria-labelledby={`${dialogId}-autosort`}
					aria-describedby={`${dialogId}-autosort-desc`}
					data-cy="display-filter-autosort"
					onChange={(checked) =>
						onChange({ ...value, autoSort: checked })
					}
				/>
			</div>

			{panelKinds.map((kind) => (
				<div className="displayFilterDialog__autoRead" key={kind.id}>
					<div className="displayFilterDialog__autoReadText">
						<span
							className="displayFilterDialog__autoReadTitle"
							id={`${dialogId}-panel-${kind.id}`}
						>
							{labels.showKind(kind.label)}
						</span>
					</div>
					<Switch
						checked={resolveKindSetting(value, kind.id).show}
						disabled={readOnly}
						aria-labelledby={`${dialogId}-panel-${kind.id}`}
						data-cy={`display-filter-panel-${kind.id}`}
						onChange={(checked) =>
							onChange(
								setKindSetting(value, kind.id, {
									show: checked
								})
							)
						}
					/>
				</div>
			))}

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

			{/* One footer line (Frank 2026-09-16): the deviation notice with
			    its reset while this list overrides the standards, and the link
			    to the standards. No second dialog action. */}
			<div className="displayFilterDialog__footerLine">
				{canReset && (
					<span className="displayFilterDialog__override">
						<span>{labels.overrideNotice}</span>
						<button
							type="button"
							className="displayFilterDialog__profileLink"
							onClick={onReset}
							disabled={readOnly}
							data-cy="display-filter-reset"
							data-testid="display-filter-reset"
						>
							{labels.resetShort}
						</button>
					</span>
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
			</div>
		</M3Dialog>
	);
};
