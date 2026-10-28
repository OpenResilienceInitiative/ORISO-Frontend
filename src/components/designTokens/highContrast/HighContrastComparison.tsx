/**
 * The side-by-side page for Frontend#1134: the standard palette next to the
 * three high-contrast candidates, for one or more tenant brand colours, with
 * a ratio for every foreground/background pair that meets on screen.
 *
 * Ratios come from `evaluateContrastPairs`, the module the unit tests hold
 * to the WCAG thresholds, so the numbers shown here and the numbers
 * asserted in CI cannot drift apart.
 */
import * as React from 'react';
import { computeOrisoPalette } from '../../../utils/theme/orisoScheme';
import {
	HIGH_CONTRAST_CANDIDATES,
	computeHighContrastTokens,
	evaluateContrastPairs,
	type ContrastPairGroup,
	type EvaluatedPair
} from '../../../utils/theme/highContrastCandidates';
import { formatRatio } from '../../../utils/theme/contrastRating';
import { HighContrastSpecimen } from './HighContrastSpecimen';
import './highContrast.styles.scss';

export interface TenantSeed {
	label: string;
	seed: string;
}

export const RED_TENANT: TenantSeed = {
	label: 'Red tenant (ORISO default)',
	seed: '#A5000A'
};
export const BLUE_TENANT: TenantSeed = {
	label: 'Blue tenant',
	seed: '#0B66C3'
};
export const LIGHT_TENANT: TenantSeed = {
	label: 'Light yellow tenant (stress test)',
	seed: '#F2C200'
};

interface Column {
	id: string;
	name: string;
	summary: string;
	textTarget: number;
	tokens: Record<string, string>;
	pairs: EvaluatedPair[];
}

const buildColumns = (seed: string): Column[] => {
	const standardTokens = computeOrisoPalette(
		{ primary: seed },
		'light'
	).tokens;
	const standard: Column = {
		id: 'standard',
		name: 'Standard (default today)',
		summary:
			'The shipping light palette. Product decision 18.08.: stays the default.',
		textTarget: 4.5,
		tokens: standardTokens,
		pairs: evaluateContrastPairs(standardTokens)
	};
	return [
		standard,
		...HIGH_CONTRAST_CANDIDATES.map((candidate) => {
			const tokens = computeHighContrastTokens(candidate.id, {
				primary: seed
			});
			return {
				id: candidate.id,
				name: candidate.name,
				summary: candidate.summary,
				textTarget: candidate.textTarget,
				tokens,
				pairs: evaluateContrastPairs(tokens)
			};
		})
	];
};

const lowest = (
	pairs: EvaluatedPair[],
	kind: 'text' | 'ui'
): EvaluatedPair | undefined =>
	pairs
		.filter(({ pair }) => pair.enforced && pair.kind === kind)
		.sort((a, b) => a.rating.ratio - b.rating.ratio)[0];

const Worst: React.FC<{ column: Column }> = ({ column }) => {
	const text = lowest(column.pairs, 'text');
	const ui = lowest(column.pairs, 'ui');
	return (
		<p className="hcCompare__worst">
			Lowest text (token-driven):{' '}
			{text ? formatRatio(text.rating.ratio) : '–'}
			<br />
			Lowest UI/icon: {ui ? formatRatio(ui.rating.ratio) : '–'}
		</p>
	);
};

const Cell: React.FC<{ entry: EvaluatedPair }> = ({ entry }) => {
	const { pair, rating } = entry;
	const exempt = !pair.enforced;
	return (
		<span
			className={`hcCompare__ratio${exempt ? ' hcCompare__exempt' : ''}`}
		>
			<span
				aria-hidden="true"
				className="hcCompare__pairSwatch"
				style={{ background: pair.background }}
			>
				<span style={{ background: pair.foreground }} />
			</span>
			{formatRatio(rating.ratio)}
			<span
				className={`hcCompare__chip hcCompare__chip--${rating.grade}`}
			>
				{rating.grade}
			</span>
		</span>
	);
};

const GROUPS: ContrastPairGroup[] = [
	'Chat',
	'Buttons',
	'Focus',
	'Session list',
	'Input'
];

export const ContrastTable: React.FC<{ columns: Column[] }> = ({ columns }) => (
	<div className="hcCompare__tableWrap">
		<table className="hcCompare__table">
			<thead>
				<tr>
					<th scope="col">Pair</th>
					{columns.map((column) => (
						<th key={column.id} scope="col">
							{column.name}
						</th>
					))}
				</tr>
			</thead>
			<tbody>
				{GROUPS.map((group) => (
					<React.Fragment key={group}>
						<tr className="hcCompare__group">
							<td colSpan={columns.length + 1}>{group}</td>
						</tr>
						{columns[0].pairs
							.map((entry, index) => ({ entry, index }))
							.filter(({ entry }) => entry.pair.group === group)
							.map(({ entry, index }) => (
								<tr key={entry.pair.id}>
									<th
										scope="row"
										className="hcCompare__pairLabel"
									>
										{entry.pair.label}
										<small>
											{' '}
											(
											{entry.pair.kind === 'text'
												? 'text'
												: 'UI / icon'}
											)
										</small>
										{entry.pair.note && (
											<span className="hcCompare__pairNote">
												{entry.pair.note}
											</span>
										)}
									</th>
									{columns.map((column) => (
										<td key={column.id}>
											<Cell entry={column.pairs[index]} />
										</td>
									))}
								</tr>
							))}
					</React.Fragment>
				))}
			</tbody>
		</table>
	</div>
);

export const TenantSection: React.FC<{ tenant: TenantSeed }> = ({ tenant }) => {
	const columns = React.useMemo(
		() => buildColumns(tenant.seed),
		[tenant.seed]
	);
	return (
		<section className="hcCompare__tenant" aria-label={tenant.label}>
			<h2 className="hcCompare__tenantHeading">
				<span
					className="hcCompare__swatch"
					style={{ background: tenant.seed }}
					aria-hidden="true"
				/>
				{tenant.label} <small>{tenant.seed}</small>
			</h2>
			<div className="hcCompare__columns">
				{columns.map((column) => (
					<div
						key={column.id}
						className="hcCompare__column"
						data-candidate={column.id}
					>
						<div className="hcCompare__columnHeader">
							<h3 className="hcCompare__columnName">
								{column.name}
							</h3>
							<p className="hcCompare__columnSummary">
								{column.summary}
							</p>
							<Worst column={column} />
						</div>
						<HighContrastSpecimen tokens={column.tokens} />
					</div>
				))}
			</div>
			<ContrastTable columns={columns} />
		</section>
	);
};

export const HighContrastComparison: React.FC<{ tenants: TenantSeed[] }> = ({
	tenants
}) => (
	<div className="hcCompare">
		<p className="hcCompare__intro">
			Proposal for Frontend#1134. Four columns per tenant colour: the
			standard palette and three optional high-contrast candidates. The
			components are the real ones; each column only changes the colour
			tokens around them. Targets: text 7:1 (WCAG AAA) or better, UI parts
			and icons 3:1 (WCAG 1.4.11). Nothing here is a user setting and the
			default theme is untouched.
		</p>
		{tenants.map((tenant) => (
			<TenantSection key={tenant.seed} tenant={tenant} />
		))}
		<p className="hcCompare__legend">
			Ratios are computed from the token pairs the component stylesheets
			read, with the same function the unit tests assert. Italic rows are
			not held to a target: WCAG exempts disabled controls, and the button
			focus ring, the session-row inks and the sender name under an own
			message are hard-coded in CSS, so no palette reaches them.
		</p>
	</div>
);
