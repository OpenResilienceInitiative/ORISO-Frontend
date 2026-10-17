import * as React from 'react';
import clsx from 'clsx';
import { M3Checkbox } from '../M3Checkbox';
import {
	DisplayFilterKindOption,
	DisplayFilterValue,
	OTHER_KIND_ID,
	isKindMuted,
	kindPillMode,
	kindSoundOverride,
	resolveKindSetting,
	setKindSetting
} from './displayFilterTypes';
import { KindOption, KindOptionPicker } from './KindOptionPicker';
import { NOTIFICATION_TONE_IDS } from '../../utils/notificationSettings/model';
import type { SoundId } from '../../utils/notificationSettings/model';
import { previewNotificationSound } from '../../utils/notificationSettings/soundPlayback';
import { ReactComponent as PlayIcon } from '../../resources/img/icons/play-circle.svg';
import { ReactComponent as MutedIcon } from '../../resources/img/icons/bell-off.svg';
import './displayFilter.styles.scss';

/** Tones offered per kind (Frank 2026-09-16: 15 entries were too many). */
const KIND_TONE_MENU_SIZE = 6;

const AREA_DEFAULT = '__default';

/** The strings of the kind table, already translated. */
export interface DisplayFilterKindTableLabels {
	/** Screen-reader caption of the first column. */
	title: string;
	showColumn: string;
	pillColumn: string;
	soundColumn: string;
	showKind: (kindLabel: string) => string;
	pillKind: (kindLabel: string) => string;
	soundKind: (kindLabel: string) => string;
	soundMenu: (kindLabel: string) => string;
	soundDefault: string;
	soundRing: string;
	soundTone: (number: number) => string;
	soundMuted: string;
	/** Anzeigen picker menu, e.g. "Anzeige wählen: Mail". */
	pillMenu: (kindLabel: string) => string;
	pillOn: string;
	pillOff: string;
	liveChatDynamic: string;
	liveChatSession: string;
	liveChatFixed: string;
	/** Tooltip of the Sonstiges row (it can never be hidden). */
	otherFixed: string;
	pillNotApplicable: string;
	deactivatedHint: string;
	/** Row hint of an announced, not yet wired kind. */
	placeholderHint: string;
	/** Visible title of the first column ("Art"). */
	kindColumn: string;
	/** Browser menu: caption over the tones, the silent pop-up and its line. */
	soundWithTone: string;
	soundSilent: string;
	soundSilentDescription: string;
	/** "E-Mail" column, its picker names and the unavailable cell. */
	emailColumn: string;
	emailKind: (kindLabel: string) => string;
	emailMenu: (kindLabel: string) => string;
	emailUnavailable: string;
	emailUnavailableReason: string;
}

/**
 * The E-Mail column (FE#1377 redesign): each kind reads and writes a stored
 * e-mail preference of the profile, or has none (`null` → "nicht verfügbar").
 */
export interface DisplayFilterEmailColumn {
	cell: (kindId: string) => { checked: boolean } | null;
	onChange: (kindId: string, next: boolean) => void;
}

/**
 * The E-Mail menu's options, in one place: today the stored settings are
 * on/off only. Delivery modes (e.g. "only when unread after 5 minutes") get
 * their entries here once a stored setting can express them.
 */
export const emailOptions = (labels: {
	pillOn: string;
	pillOff: string;
}): KindOption[] => [
	{ id: 'on', label: labels.pillOn },
	{ id: 'off', label: labels.pillOff }
];

/**
 * The Browser menu's options: the area default and the tones (pop-up with a
 * sound), then — after a divider — the pop-up without sound (`'none'`). A
 * per-kind "no pop-up at all" is not offered: the banner is not gated per
 * kind, so no stored setting could hold it.
 */
export const browserOptions = (
	labels: Pick<
		DisplayFilterKindTableLabels,
		| 'soundDefault'
		| 'soundRing'
		| 'soundTone'
		| 'soundMuted'
		| 'soundSilent'
		| 'soundSilentDescription'
	>,
	storedTone: string | undefined
): KindOption[] => [
	{ id: AREA_DEFAULT, label: labels.soundDefault },
	{ id: 'ring', label: labels.soundRing },
	// Frank 2026-09-16: a shorter menu — the first six tones, plus
	// whatever is already stored.
	...NOTIFICATION_TONE_IDS.map((id, index) => ({
		id,
		label: labels.soundTone(index + 1)
	})).filter(
		(option, index) =>
			index < KIND_TONE_MENU_SIZE || option.id === storedTone
	),
	{
		id: 'none',
		label: labels.soundSilent,
		description: labels.soundSilentDescription,
		selectedLabel: labels.soundMuted,
		dividerBefore: true
	}
];

export interface DisplayFilterKindTableProps {
	kinds: ReadonlyArray<DisplayFilterKindOption>;
	value: DisplayFilterValue;
	onChange: (next: DisplayFilterValue) => void;
	readOnly?: boolean;
	labels: DisplayFilterKindTableLabels;
	/** Prefix for the ids the rows reference (`aria-describedby`). */
	idPrefix: string;
	/** Namespaces the `data-cy` hooks when several tables share a page. */
	dataCyPrefix?: string;
	/** Which per-kind columns to render; default: show + pill (Zeitstrahl). */
	columns?: { show: boolean; sound: boolean };
	/** Adds the E-Mail column; omitted, the table has none. */
	email?: DisplayFilterEmailColumn;
	/**
	 * `quick`: the filter-only buttons (Ungelesen, Entwürfe, …) — a name and
	 * the "Im Filter" picker, nothing else.
	 */
	variant?: 'kinds' | 'quick';
}

/**
 * The column title repeated inside each cell. Hidden on desktop, where the
 * header row labels the columns; shown in the phone layout, where every kind
 * is a block and the header row no longer lines up. `aria-hidden`: the
 * controls already carry their full names ("Ton anhören: Mail").
 */
const CellLabel = ({ children }: { children: string }) => (
	<span className="displayFilterDialog__cellLabel" aria-hidden="true">
		{children}
	</span>
);

/**
 * One row per kind (#1377 spec §3; redesign 2026-10-15 with Frank). Columns
 * in this order, each only where the area has it: **In der Liste** (rows of
 * the kind appear, Zeitstrahl), **Im Filter** (a filter button above the
 * list), **Browser** (pop-up on this device, with a tone or silent;
 * Gespräche/Anfragen) and **E-Mail** (the profile's stored e-mail notice).
 * Every choice is the same small split-button picker. Archiv-like kinds
 * with only a filter button use the `quick` variant. Sonstiges explains
 * itself in a tooltip, Termine is a greyed placeholder.
 */
export const DisplayFilterKindTable = ({
	kinds,
	value,
	onChange,
	readOnly = false,
	labels,
	idPrefix,
	dataCyPrefix = 'display-filter',
	columns = { show: true, sound: false },
	email,
	variant = 'kinds'
}: DisplayFilterKindTableProps) => {
	const quick = variant === 'quick';
	const showColumn = columns.show && !quick;
	const soundColumn = columns.sound && !quick;
	const emailColumn = Boolean(email) && !quick;
	return (
		<table
			className={clsx(
				'displayFilterDialog__table',
				quick && 'displayFilterDialog__table--quick'
			)}
		>
			<thead className={clsx(quick && 'sr-only')}>
				<tr>
					<th scope="col" className="displayFilterDialog__kindHead">
						{labels.kindColumn}
					</th>
					{showColumn && (
						<th
							scope="col"
							className="displayFilterDialog__colHead"
						>
							{labels.showColumn}
						</th>
					)}
					<th
						scope="col"
						className="displayFilterDialog__colHead displayFilterDialog__colHead--picker"
					>
						{labels.pillColumn}
					</th>
					{soundColumn && (
						<th
							scope="col"
							className="displayFilterDialog__colHead displayFilterDialog__colHead--picker displayFilterDialog__colHead--sound"
						>
							{labels.soundColumn}
						</th>
					)}
					{emailColumn && (
						<th
							scope="col"
							className="displayFilterDialog__colHead displayFilterDialog__colHead--picker"
						>
							{labels.emailColumn}
						</th>
					)}
				</tr>
			</thead>
			<tbody>
				{kinds
					// A show-only kind gates a panel: without the show column it
					// has no control left, so the row is omitted (Gespräche/Anfragen).
					.filter((kind) => showColumn || !kind.showOnly)
					.map((kind) => {
						const setting = resolveKindSetting(value, kind.id);
						const isOther = kind.id === OTHER_KIND_ID;
						// Träger switched the format off, rows still exist: keep
						// the kind visible and its controls locked so nothing
						// vanishes silently; the hint explains, the chip too.
						const deactivated = kind.availability === 'deactivated';
						const placeholder = Boolean(kind.placeholder);
						const locked = readOnly || deactivated || placeholder;
						const hint = deactivated
							? labels.deactivatedHint
							: placeholder
								? labels.placeholderHint
								: null;
						// Sonstiges keeps its explanation for assistive tech
						// (sr-only, linked from the locked checkbox) and as a
						// tooltip; visually the row stays one line.
						const hintId = hint
							? `${idPrefix}-${kind.id}-hint`
							: isOther
								? `${idPrefix}-other-fixed`
								: undefined;
						const Icon = kind.icon;
						const tone = kindSoundOverride(value, kind.id);
						const muted = isKindMuted(value, kind.id);
						const pillValue = !setting.pill
							? 'off'
							: kind.modes
								? kindPillMode(value, kind.id)
								: 'on';
						const emailCell = emailColumn
							? email!.cell(kind.id)
							: null;
						return (
							<tr
								key={kind.id}
								className={clsx(
									'displayFilterDialog__row',
									!setting.show &&
										'displayFilterDialog__row--hidden',
									deactivated &&
										'displayFilterDialog__row--deactivated',
									placeholder &&
										'displayFilterDialog__row--placeholder'
								)}
								data-cy={`${dataCyPrefix}-row-${kind.id}`}
							>
								<th
									scope="row"
									className="displayFilterDialog__kind"
								>
									{Icon && (
										<Icon
											className="displayFilterDialog__kindIcon"
											aria-hidden="true"
										/>
									)}
									<span className="displayFilterDialog__kindText">
										<span
											className="displayFilterDialog__kindName"
											title={
												isOther
													? labels.otherFixed
													: undefined
											}
										>
											{kind.label}
										</span>
										{hint && (
											<span
												className="displayFilterDialog__kindHint"
												id={hintId}
											>
												{hint}
											</span>
										)}
										{isOther && (
											<span
												className="sr-only"
												id={hintId}
											>
												{labels.otherFixed}
											</span>
										)}
									</span>
								</th>
								{showColumn && (
									<td className="displayFilterDialog__cell">
										<CellLabel>
											{labels.showColumn}
										</CellLabel>
										<M3Checkbox
											checked={setting.show}
											indeterminate={Boolean(
												setting.show && kind.partial
											)}
											disabled={locked || isOther}
											describedBy={hintId}
											hideLabel
											label={labels.showKind(kind.label)}
											dataCy={`${dataCyPrefix}-show-${kind.id}`}
											onChange={(checked) =>
												onChange(
													setKindSetting(
														value,
														kind.id,
														{ show: checked }
													)
												)
											}
										/>
									</td>
								)}
								<td className="displayFilterDialog__cell displayFilterDialog__cell--picker">
									<CellLabel>{labels.pillColumn}</CellLabel>
									{kind.showOnly ? (
										<>
											<span
												className="displayFilterDialog__noPill"
												aria-hidden="true"
											>
												–
											</span>
											<span className="sr-only">
												{labels.pillNotApplicable}
											</span>
										</>
									) : (
										<KindOptionPicker
											options={
												kind.modes
													? [
															{
																id: 'dynamic',
																label: labels.liveChatDynamic
															},
															{
																id: 'session',
																label: labels.liveChatSession
															},
															{
																id: 'fixed',
																label: labels.liveChatFixed
															},
															{
																id: 'off',
																label: labels.pillOff
															}
														]
													: [
															{
																id: 'on',
																label: labels.pillOn
															},
															{
																id: 'off',
																label: labels.pillOff
															}
														]
											}
											selected={pillValue}
											mainLabel={labels.pillKind(
												kind.label
											)}
											menuLabel={labels.pillMenu(
												kind.label
											)}
											disabled={locked || !setting.show}
											className="displayFilterDialog__picker"
											dataCy={`${dataCyPrefix}-pill-${kind.id}`}
											onSelect={(id) =>
												onChange(
													setKindSetting(
														value,
														kind.id,
														{
															pill: id !== 'off',
															pillMode:
																id ===
																	'session' ||
																id === 'fixed'
																	? id
																	: 'dynamic'
														}
													)
												)
											}
										/>
									)}
								</td>
								{soundColumn && (
									<td className="displayFilterDialog__cell displayFilterDialog__cell--picker displayFilterDialog__cell--sound">
										<CellLabel>
											{labels.soundColumn}
										</CellLabel>
										{kind.pillOnly || kind.showOnly ? (
											<span
												className="displayFilterDialog__noPill"
												aria-hidden="true"
											>
												–
											</span>
										) : (
											<KindOptionPicker
												options={browserOptions(
													labels,
													tone
												)}
												groupLabel={
													labels.soundWithTone
												}
												selected={tone ?? AREA_DEFAULT}
												icon={
													muted ? (
														<MutedIcon />
													) : (
														<PlayIcon />
													)
												}
												mainLabel={labels.soundKind(
													kind.label
												)}
												menuLabel={labels.soundMenu(
													kind.label
												)}
												disabled={locked}
												className="displayFilterDialog__picker displayFilterDialog__picker--sound"
												dataCy={`${dataCyPrefix}-sound-${kind.id}`}
												mainDisabled={muted}
												onMain={() =>
													previewNotificationSound(
														// "Standard" inherits the area
														// sound, which this table
														// cannot resolve: preview the
														// built-in sound instead.
														(tone ??
															'chime') as SoundId,
														0.8
													)
												}
												onSelect={(id) =>
													onChange(
														setKindSetting(
															value,
															kind.id,
															{
																sound:
																	id ===
																	AREA_DEFAULT
																		? undefined
																		: (id as SoundId)
															}
														)
													)
												}
											/>
										)}
									</td>
								)}
								{emailColumn && (
									<td className="displayFilterDialog__cell displayFilterDialog__cell--picker">
										<CellLabel>
											{labels.emailColumn}
										</CellLabel>
										{emailCell ? (
											<KindOptionPicker
												options={emailOptions(labels)}
												selected={
													emailCell.checked
														? 'on'
														: 'off'
												}
												mainLabel={labels.emailKind(
													kind.label
												)}
												menuLabel={labels.emailMenu(
													kind.label
												)}
												// Only read-only locks it: the cell is a
												// profile setting, live on placeholder kinds.
												disabled={readOnly}
												className="displayFilterDialog__picker"
												dataCy={`${dataCyPrefix}-email-${kind.id}`}
												onSelect={(id) =>
													email!.onChange(
														kind.id,
														id === 'on'
													)
												}
											/>
										) : (
											// Not a control: no focus stop. The
											// reason is read with the cell and
											// shown as a tooltip.
											<span
												className="displayFilterDialog__unavailable"
												title={
													labels.emailUnavailableReason
												}
												data-cy={`${dataCyPrefix}-email-${kind.id}-unavailable`}
											>
												<span aria-hidden="true">
													{labels.emailUnavailable}
												</span>
												<span className="sr-only">
													{`${labels.emailUnavailable}. ${labels.emailUnavailableReason}`}
												</span>
											</span>
										)}
									</td>
								)}
							</tr>
						);
					})}
			</tbody>
		</table>
	);
};
