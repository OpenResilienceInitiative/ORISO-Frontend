import * as React from 'react';
import { M3Dialog } from '../m3Dialog/M3Dialog';
import { OrisoSelect } from '../form/OrisoSelect';
import { OrisoTextField } from '../form/OrisoTextField';
import { ReactComponent as SupervisionIcon } from '../../resources/img/icons/supervision_nocirc_400_24px.svg';
import { ReactComponent as HandoverIcon } from '../../resources/img/icons/teams_outline.svg';
import './supervisorDialog.styles.scss';

export type SupervisorDialogMode = 'add' | 'change' | 'handover';

export interface SupervisorDialogReason {
	code: string;
	label: string;
	disabled?: boolean;
	hint?: string;
}

export interface SupervisorDialogPerson {
	id: string;
	name: string;
	detail?: string;
}

export interface SupervisorDialogCopy {
	title: Record<SupervisorDialogMode, string>;
	description: Record<SupervisorDialogMode, string>;
	currentHeading: string;
	noneYet: string;
	personLabel: Record<SupervisorDialogMode, string>;
	reasonLabel: Record<SupervisorDialogMode, string>;
	reasonPlaceholder: string;
	reasonError: string;
	reasonEmptyOption: string;
	explanation: Record<SupervisorDialogMode, string>;
	handoverPending: string;
	confirm: Record<SupervisorDialogMode, string>;
	cancel: string;
	close: string;
	emptyOption: string;
}

export interface SupervisorDialogProps {
	'mode': SupervisorDialogMode;
	'copy': SupervisorDialogCopy;
	'current'?: SupervisorDialogPerson[];
	'candidates': SupervisorDialogPerson[];
	'reasons'?: SupervisorDialogReason[];
	'selectedId'?: string;
	'reason'?: string;
	'reasonRequired'?: boolean;
	'busy'?: boolean;
	'onSelect': (id: string) => void;
	'onReasonChange': (reason: string) => void;
	'onConfirm': () => void;
	'onClose': () => void;
	'data-testid'?: string;
}

export const SupervisorDialog = ({
	mode,
	copy,
	current = [],
	candidates,
	reasons = [],
	selectedId = '',
	reason = '',
	reasonRequired = true,
	busy = false,
	onSelect,
	onReasonChange,
	onConfirm,
	onClose,
	'data-testid': testId = 'supervisor-dialog'
}: SupervisorDialogProps) => {
	const missingReason = reasonRequired && !reason.trim();
	const canConfirm = Boolean(selectedId) && !missingReason && !busy;
	const [showReasonError, setShowReasonError] = React.useState(false);

	return (
		<M3Dialog
			title={copy.title[mode]}
			description={copy.description[mode]}
			icon={
				mode === 'handover' ? (
					<HandoverIcon aria-hidden="true" focusable="false" />
				) : (
					<SupervisionIcon aria-hidden="true" focusable="false" />
				)
			}
			onClose={onClose}
			closeLabel={copy.close}
			data-testid={testId}
			className="supervisorDialog"
			actions={[
				{
					label: copy.cancel,
					onClick: onClose,
					testId: `${testId}-cancel`
				},
				{
					label: copy.confirm[mode],
					onClick: () => {
						if (missingReason) {
							setShowReasonError(true);
							return;
						}
						onConfirm();
					},
					primary: true,
					disabled: !canConfirm,
					testId: `${testId}-confirm`
				}
			]}
		>
			<p
				className="supervisorDialog__explanation"
				data-testid={`${testId}-explanation`}
			>
				{copy.explanation[mode]}
			</p>

			{mode !== 'handover' && (
				<section className="supervisorDialog__section">
					<h3 className="supervisorDialog__heading">
						{copy.currentHeading}
					</h3>
					{current.length === 0 ? (
						<p className="supervisorDialog__empty">
							{copy.noneYet}
						</p>
					) : (
						<ul className="supervisorDialog__people">
							{current.map((person) => (
								<li
									key={person.id}
									className="supervisorDialog__person"
								>
									<span className="supervisorDialog__personName">
										{person.name}
									</span>
									{person.detail && (
										<span className="supervisorDialog__personDetail">
											{person.detail}
										</span>
									)}
								</li>
							))}
						</ul>
					)}
				</section>
			)}

			<section className="supervisorDialog__section">
				<OrisoSelect
					label={copy.personLabel[mode]}
					value={selectedId}
					options={[
						{ value: '', label: copy.emptyOption },
						...candidates.map((person) => ({
							value: person.id,
							label: person.detail
								? `${person.name} — ${person.detail}`
								: person.name
						}))
					]}
					onChange={(event) => onSelect(String(event.target.value))}
					data-testid={`${testId}-person`}
				/>
			</section>

			<section className="supervisorDialog__section">
				{mode === 'handover' ? (
					<OrisoSelect
						label={copy.reasonLabel[mode]}
						value={reason}
						options={[
							{ value: '', label: copy.reasonEmptyOption },
							...reasons.map((entry) => ({
								value: entry.code,
								label: entry.hint
									? `${entry.label} — ${entry.hint}`
									: entry.label,
								disabled: entry.disabled
							}))
						]}
						error={showReasonError && missingReason}
						helperText={
							showReasonError && missingReason
								? copy.reasonError
								: undefined
						}
						onChange={(event) => {
							setShowReasonError(false);
							onReasonChange(String(event.target.value));
						}}
						data-testid={`${testId}-reason`}
					/>
				) : (
					<OrisoTextField
						label={copy.reasonLabel[mode]}
						placeholder={copy.reasonPlaceholder}
						value={reason}
						multiline
						minRows={3}
						error={showReasonError && missingReason}
						helperText={
							showReasonError && missingReason
								? copy.reasonError
								: undefined
						}
						onChange={(event) => {
							setShowReasonError(false);
							onReasonChange(event.target.value);
						}}
						inputProps={{ 'data-testid': `${testId}-reason` }}
					/>
				)}
			</section>

			{mode === 'handover' && (
				<p className="supervisorDialog__pending">
					{copy.handoverPending}
				</p>
			)}
		</M3Dialog>
	);
};
