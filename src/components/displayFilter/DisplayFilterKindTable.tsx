import * as React from 'react';
import clsx from 'clsx';
import { M3Checkbox } from '../M3Checkbox';
import {
	DisplayFilterKindOption,
	DisplayFilterValue,
	OTHER_KIND_ID,
	isKindMuted,
	isKindPinned,
	kindSoundOverride,
	resolveKindSetting,
	setKindSetting
} from './displayFilterTypes';
import { KindOptionPicker } from './KindOptionPicker';
import { NOTIFICATION_TONE_IDS } from '../../utils/notificationSettings/model';
import type { SoundId } from '../../utils/notificationSettings/model';
import { previewNotificationSound } from '../../utils/notificationSettings/soundPlayback';
import { ReactComponent as PlayIcon } from '../../resources/img/icons/play-circle.svg';
import { ReactComponent as MutedIcon } from '../../resources/img/icons/bell-off.svg';
import './displayFilter.styles.scss';

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
	liveChatModeMenu: (kindLabel: string) => string;
	liveChatDynamic: string;
	liveChatFixed: string;
	liveChatOff: string;
	otherFixed: string;
	pillNotApplicable: string;
	deactivatedHint: string;
	/** Row hint of an announced, not yet wired kind. */
	placeholderHint: string;
}

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
}

const AREA_DEFAULT = '__default';

/**
 * One row per kind (#1377 spec §3, reshaped 2026-09-16 with Frank): the
 * Zeitstrahl offers **In der Liste** + **Anzeigen** (pill); Gespräche and
 * Anfragen offer **Ton** (a tone picker per kind) + **Anzeigen**. The
 * live-chat pill has modes (dynamic / pinned / off), Archiv is pill-only,
 * Termine is a greyed placeholder. Shared by the list dialog and the profile
 * page (slice 6).
 */
export const DisplayFilterKindTable = ({
	kinds,
	value,
	onChange,
	readOnly = false,
	labels,
	idPrefix,
	dataCyPrefix = 'display-filter',
	columns = { show: true, sound: false }
}: DisplayFilterKindTableProps) => (
	<table className="displayFilterDialog__table">
		<thead>
			<tr>
				<th scope="col" className="displayFilterDialog__kindHead">
					<span className="sr-only">{labels.title}</span>
				</th>
				{columns.show && (
					<th scope="col" className="displayFilterDialog__colHead">
						{labels.showColumn}
					</th>
				)}
				{columns.sound && (
					<th
						scope="col"
						className="displayFilterDialog__colHead displayFilterDialog__colHead--picker"
					>
						{labels.soundColumn}
					</th>
				)}
				<th
					scope="col"
					className={clsx(
						'displayFilterDialog__colHead',
						columns.sound && 'displayFilterDialog__colHead--picker'
					)}
				>
					{labels.pillColumn}
				</th>
			</tr>
		</thead>
		<tbody>
			{kinds
				// A show-only kind gates a panel: without the show column it has
				// no control left, so the row is omitted (Gespräche/Anfragen).
				.filter((kind) => columns.show || !kind.showOnly)
				.map((kind) => {
					const setting = resolveKindSetting(value, kind.id);
					const isOther = kind.id === OTHER_KIND_ID;
					// Träger switched the format off, rows still exist: keep the
					// kind visible and its controls locked so nothing vanishes
					// silently; the hint explains and the chip's click does too.
					const deactivated = kind.availability === 'deactivated';
					const placeholder = Boolean(kind.placeholder);
					const locked = readOnly || deactivated || placeholder;
					const hint = isOther
						? labels.otherFixed
						: deactivated
							? labels.deactivatedHint
							: placeholder
								? labels.placeholderHint
								: null;
					const hintId = hint
						? `${idPrefix}-${kind.id}-hint`
						: undefined;
					const Icon = kind.icon;
					const tone = kindSoundOverride(value, kind.id);
					const muted = isKindMuted(value, kind.id);
					const pillValue = !setting.pill
						? 'off'
						: isKindPinned(value, kind.id)
							? 'fixed'
							: 'dynamic';
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
									<span>{kind.label}</span>
									{hint && (
										<span
											className="displayFilterDialog__kindHint"
											id={hintId}
										>
											{hint}
										</span>
									)}
								</span>
							</th>
							{columns.sound && (
								<td className="displayFilterDialog__cell displayFilterDialog__cell--picker">
									{kind.pillOnly || kind.showOnly ? (
										<span
											className="displayFilterDialog__noPill"
											aria-hidden="true"
										>
											–
										</span>
									) : (
										<KindOptionPicker
											options={[
												{
													id: AREA_DEFAULT,
													label: labels.soundDefault
												},
												{
													id: 'ring',
													label: labels.soundRing
												},
												...NOTIFICATION_TONE_IDS.map(
													(id, index) => ({
														id,
														label: labels.soundTone(
															index + 1
														)
													})
												),
												{
													id: 'none',
													label: labels.soundMuted
												}
											]}
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
											className="displayFilterDialog__picker"
											dataCy={`${dataCyPrefix}-sound-${kind.id}`}
											onMain={() =>
												previewNotificationSound(
													(tone && tone !== 'none'
														? tone
														: 'default') as SoundId,
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
							{columns.show && (
								<td className="displayFilterDialog__cell">
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
												setKindSetting(value, kind.id, {
													show: checked
												})
											)
										}
									/>
								</td>
							)}
							<td
								className={clsx(
									'displayFilterDialog__cell',
									columns.sound &&
										'displayFilterDialog__cell--picker'
								)}
							>
								{kind.modes ? (
									<KindOptionPicker
										options={[
											{
												id: 'dynamic',
												label: labels.liveChatDynamic
											},
											{
												id: 'fixed',
												label: labels.liveChatFixed
											},
											{
												id: 'off',
												label: labels.liveChatOff
											}
										]}
										selected={pillValue}
										mainLabel={labels.pillKind(kind.label)}
										menuLabel={labels.liveChatModeMenu(
											kind.label
										)}
										disabled={locked || !setting.show}
										className="displayFilterDialog__picker"
										dataCy={`${dataCyPrefix}-mode-${kind.id}`}
										onSelect={(id) =>
											onChange(
												setKindSetting(value, kind.id, {
													pill: id !== 'off',
													fixed: id === 'fixed'
												})
											)
										}
									/>
								) : kind.showOnly ? (
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
									<M3Checkbox
										checked={setting.pill}
										disabled={locked || !setting.show}
										describedBy={
											!isOther ? hintId : undefined
										}
										hideLabel
										label={labels.pillKind(kind.label)}
										dataCy={`${dataCyPrefix}-pill-${kind.id}`}
										onChange={(checked) =>
											onChange(
												setKindSetting(value, kind.id, {
													pill: checked
												})
											)
										}
									/>
								)}
							</td>
						</tr>
					);
				})}
		</tbody>
	</table>
);
