import * as React from 'react';
import clsx from 'clsx';
import { M3Checkbox } from '../M3Checkbox';
import {
	DisplayFilterKindOption,
	DisplayFilterValue,
	OTHER_KIND_ID,
	resolveKindSetting,
	setKindSetting
} from './displayFilterTypes';
import './displayFilter.styles.scss';

/** The strings of the kind table, already translated. */
export interface DisplayFilterKindTableLabels {
	/** Screen-reader caption of the first column. */
	title: string;
	showColumn: string;
	pillColumn: string;
	showKind: (kindLabel: string) => string;
	pillKind: (kindLabel: string) => string;
	otherFixed: string;
	pillNotApplicable: string;
	/** Row hint of a kind the Träger switched off while rows still exist. */
	deactivatedHint: string;
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
}

/**
 * One row per kind with the two independent switches — **show** and
 * **pill** (#1377 spec §3). Shared by the list dialog (edits the section
 * override) and the profile page (edits the per-section defaults, slice 6).
 */
export const DisplayFilterKindTable = ({
	kinds,
	value,
	onChange,
	readOnly = false,
	labels,
	idPrefix,
	dataCyPrefix = 'display-filter'
}: DisplayFilterKindTableProps) => (
	<table className="displayFilterDialog__table">
		<thead>
			<tr>
				<th scope="col" className="displayFilterDialog__kindHead">
					<span className="sr-only">{labels.title}</span>
				</th>
				<th scope="col" className="displayFilterDialog__colHead">
					{labels.showColumn}
				</th>
				<th scope="col" className="displayFilterDialog__colHead">
					{labels.pillColumn}
				</th>
			</tr>
		</thead>
		<tbody>
			{kinds.map((kind) => {
				const setting = resolveKindSetting(value, kind.id);
				const isOther = kind.id === OTHER_KIND_ID;
				// Träger switched the format off, rows still exist: keep the
				// kind visible and its controls locked so nothing vanishes
				// silently; the hint explains and the chip's click does too.
				const deactivated = kind.availability === 'deactivated';
				const hintId = isOther
					? `${idPrefix}-other-fixed`
					: deactivated
						? `${idPrefix}-${kind.id}-deactivated`
						: undefined;
				const Icon = kind.icon;
				return (
					<tr
						key={kind.id}
						className={clsx(
							'displayFilterDialog__row',
							!setting.show && 'displayFilterDialog__row--hidden',
							deactivated &&
								'displayFilterDialog__row--deactivated'
						)}
						data-cy={`${dataCyPrefix}-row-${kind.id}`}
					>
						<th scope="row" className="displayFilterDialog__kind">
							{Icon && (
								<Icon
									className="displayFilterDialog__kindIcon"
									aria-hidden="true"
								/>
							)}
							<span className="displayFilterDialog__kindText">
								<span>{kind.label}</span>
								{isOther && (
									<span
										className="displayFilterDialog__kindHint"
										id={`${idPrefix}-other-fixed`}
									>
										{labels.otherFixed}
									</span>
								)}
								{deactivated && !isOther && (
									<span
										className="displayFilterDialog__kindHint"
										id={`${idPrefix}-${kind.id}-deactivated`}
									>
										{labels.deactivatedHint}
									</span>
								)}
							</span>
						</th>
						<td className="displayFilterDialog__cell">
							<M3Checkbox
								checked={setting.show}
								indeterminate={Boolean(
									setting.show && kind.partial
								)}
								disabled={readOnly || isOther || deactivated}
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
						<td className="displayFilterDialog__cell">
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
								<M3Checkbox
									checked={setting.pill}
									disabled={
										readOnly || !setting.show || deactivated
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
