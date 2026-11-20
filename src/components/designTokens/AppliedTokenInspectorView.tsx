import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Button, BUTTON_TYPES } from '../button/Button';
import type { AppliedTokenInspection } from './appliedTokenInspector';
import './appliedTokenInspectorView.styles.scss';

/** Controlled measured-data view: collection belongs to the reference host. */
export function AppliedTokenInspector({
	rows,
	onRefresh
}: {
	rows: readonly AppliedTokenInspection[];
	onRefresh: () => void;
}) {
	const { t } = useTranslation();
	const id = React.useId();
	const text = (key: string) => t(`designTokens.applied.${key}`);
	const value = (measured: string | null) => measured || text('unavailable');
	return (
		<section
			className="appliedTokenInspector"
			aria-labelledby={`${id}-title`}
		>
			<h2 id={`${id}-title`}>{text('title')}</h2>
			<p>{text('declaredExplanation')}</p>
			<Button
				item={{
					type: BUTTON_TYPES.SECONDARY,
					label: text('refresh'),
					id: `${id}-refresh`
				}}
				buttonHandle={onRefresh}
			/>
			{rows.length === 0 ? (
				<p>{text('empty')}</p>
			) : (
				<div
					className="appliedTokenInspector__scroll"
					role="region"
					aria-label={text('scroll')}
					tabIndex={0}
				>
					<table>
						<caption>{text('caption')}</caption>
						<thead>
							<tr>
								{[
									'target',
									'token',
									'expected',
									'calculated',
									'applied',
									'result',
									'source'
								].map((column) => (
									<th key={column} scope="col">
										{text(column)}
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{rows.map((row) => (
								<tr
									key={`${row.id}:${row.selector}:${row.targetIndex}`}
								>
									<th
										scope="row"
										aria-label={`${row.id} [${row.targetIndex ?? '—'}]`}
									>
										{row.id} [{row.targetIndex ?? '—'}]
										<code>{row.selector}</code>
									</th>
									<td>
										<code>{row.token}</code>
										<code>{row.property}</code>
									</td>
									<td>
										<code>{value(row.expected)}</code>
									</td>
									<td>
										<code>{value(row.calculated)}</code>
									</td>
									<td>
										<code>{value(row.applied)}</code>
									</td>
									<td>
										<strong>
											{text(`status.${row.status}`)}
										</strong>
										{row.issues.map((issue) => (
											<p key={issue}>
												{t(
													`designTokens.applied.issues.${issue}`,
													{ defaultValue: issue }
												)}
											</p>
										))}
									</td>
									<td>
										<code>{row.source.path}</code>
										<code>{row.source.rule}</code>
										<code>{row.source.declaration}</code>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</section>
	);
}
