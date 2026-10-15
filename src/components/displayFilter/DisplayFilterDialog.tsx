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
import {
	DisplayFilterEmailColumn,
	DisplayFilterKindTable
} from './DisplayFilterKindTable';
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
	/** Accessible name of the tone preview, e.g. "Ton anhören: Mail". */
	soundKind: (kindLabel: string) => string;
	/** Accessible name of the tone menu, e.g. "Ton wählen: Mail". */
	soundMenu: (kindLabel: string) => string;
	/** Tone options: area default, ring tone, numbered tones, muted. */
	soundDefault: string;
	soundRing: string;
	soundTone: (number: number) => string;
	soundMuted: string;
	/** Anzeigen picker (Frank 2026-09-16): every kind picks An/Aus, live chat Dynamisch/Fest/Aus. */
	pillMenu: (kindLabel: string) => string;
	pillOn: string;
	pillOff: string;
	liveChatDynamic: string;
	liveChatSession: string;
	liveChatFixed: string;
	/** Row hint of an announced, not yet wired kind (Termine). */
	placeholderHint: string;
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
	/** Redesign 2026-10-15: visible first column title ("Art"). */
	kindColumn: string;
	/** One-line meaning of each column, shown in the legend row. */
	legendShow: string;
	legendPill: string;
	legendSound: string;
	legendEmail: string;
	/** Section headings: the area's kinds, the filter-only buttons, their look. */
	kindsHeading: string;
	quickHeading: string;
	quickNote: string;
	presentationHeading: string;
	soundWithTone: string;
	soundSilent: string;
	soundSilentDescription: string;
	emailColumn: string;
	emailKind: (kindLabel: string) => string;
	emailMenu: (kindLabel: string) => string;
	emailUnavailable: string;
	emailUnavailableReason: string;
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
	/** The E-Mail column; omitted where the area offers none. */
	email?: DisplayFilterEmailColumn;
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
 * The display-filter dialog (#1377; redesign 2026-10-15, approved by Frank):
 * a legend that names the columns, then the area's kinds ("Gesprächsarten"),
 * the filter-only buttons ("Weitere Filter-Knöpfe", only where the area has
 * them), and how the filter buttons look. Each area shows only the columns
 * and sections it really has. Presentational: the caller owns the value
 * (slice 2 store), the e-mail column and the list integration.
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
	icon,
	email
}: DisplayFilterDialogProps) => {
	// Show-only kinds (the future timeline panel) have no row in the sound
	// mode table; they keep a plain switch so the panel stays toggleable.
	const panelKinds = columns.show
		? []
		: kinds.filter((kind) => kind.showOnly);
	// Filter-only buttons (Ungelesen, Entwürfe, Chat erstellen, Archiv) sort
	// the list and notify nobody: their own section, only "Im Filter".
	const mainKinds = kinds.filter((kind) => !kind.pillOnly);
	const quickKinds = kinds.filter((kind) => kind.pillOnly);
	const generatedId = useId();
	const dialogId = id ?? generatedId;
	const presentation = resolveChipPresentation(value);
	const setView = (view: ChipView) => onChange({ ...value, view });
	const legend = [
		columns.show && {
			key: 'show',
			title: labels.showColumn,
			text: labels.legendShow
		},
		{ key: 'pill', title: labels.pillColumn, text: labels.legendPill },
		columns.sound && {
			key: 'sound',
			title: labels.soundColumn,
			text: labels.legendSound
		},
		email && {
			key: 'email',
			title: labels.emailColumn,
			text: labels.legendEmail
		}
	].filter(Boolean) as { key: string; title: string; text: string }[];

	return (
		<M3Dialog
			open={open}
			onClose={onClose}
			title={labels.title}
			description={labels.description}
			icon={icon ?? <TuneIcon />}
			closeLabel={labels.close}
			// Four columns with one-line kind names ("Interner Gruppenchat").
			width={760}
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
			<dl
				className="displayFilterDialog__legend"
				data-cy="display-filter-legend"
			>
				{legend.map((entry) => (
					<div
						className="displayFilterDialog__legendItem"
						key={entry.key}
					>
						<dt className="displayFilterDialog__legendTitle">
							{entry.title}
						</dt>
						<dd className="displayFilterDialog__legendText">
							{entry.text}
						</dd>
					</div>
				))}
			</dl>

			<section
				className="displayFilterDialog__section"
				aria-labelledby={`${dialogId}-kinds`}
			>
				<h3
					className="displayFilterDialog__sectionTitle"
					id={`${dialogId}-kinds`}
				>
					{labels.kindsHeading}
				</h3>
				<DisplayFilterKindTable
					kinds={mainKinds}
					value={value}
					onChange={onChange}
					readOnly={readOnly}
					labels={labels}
					idPrefix={dialogId}
					columns={columns}
					email={email}
				/>
			</section>

			{quickKinds.length > 0 && (
				<section
					className="displayFilterDialog__section"
					aria-labelledby={`${dialogId}-quick`}
					aria-describedby={`${dialogId}-quick-note`}
				>
					<h3
						className="displayFilterDialog__sectionTitle"
						id={`${dialogId}-quick`}
					>
						{labels.quickHeading}
					</h3>
					<p
						className="displayFilterDialog__sectionNote"
						id={`${dialogId}-quick-note`}
					>
						{labels.quickNote}
					</p>
					<DisplayFilterKindTable
						kinds={quickKinds}
						value={value}
						onChange={onChange}
						readOnly={readOnly}
						labels={labels}
						idPrefix={`${dialogId}-quick`}
						columns={columns}
						variant="quick"
					/>
				</section>
			)}

			<section
				className="displayFilterDialog__section"
				aria-labelledby={`${dialogId}-presentation`}
			>
				<h3
					className="displayFilterDialog__sectionTitle"
					id={`${dialogId}-presentation`}
				>
					{labels.presentationHeading}
				</h3>
				<fieldset
					className="displayFilterDialog__view"
					data-cy="display-filter-view"
				>
					<legend className="sr-only">{labels.viewTitle}</legend>
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
					<div
						className="displayFilterDialog__autoRead"
						key={kind.id}
					>
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
				    its reset while this list overrides the standards, and the
				    link to the standards. No second dialog action. */}
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
			</section>
		</M3Dialog>
	);
};
