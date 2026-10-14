import * as React from 'react';
import { useId } from 'react';
import {
	ListItemButton,
	ListItemText,
	Radio,
	RadioGroup,
	Typography
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { CaseHandoverReason } from '../../api/apiCaseHandover';
import { caseHandoverReasonOptionLabel } from './caseHandoverReasons';
import './caseHandoverReasonList.styles';

export interface CaseHandoverReasonListProps {
	reasons: CaseHandoverReason[];
	reasonCode: string;
	interactive: boolean;
	onReasonSelect: (code: string) => void;
}

/** Shared M3 reason rows for selection and the read-only explanation step. */
export const CaseHandoverReasonList = ({
	reasons,
	reasonCode,
	interactive,
	onReasonSelect
}: CaseHandoverReasonListProps) => {
	const { t: translate } = useTranslation();
	const id = useId();
	const isMac =
		typeof navigator !== 'undefined' &&
		/mac/i.test(navigator.platform || '');
	const shortcutPrefix = isMac ? '⌘R' : 'Ctrl+R';
	return (
		<RadioGroup
			className="caseHandoverReasonList"
			aria-label={translate('caseHandover.curtain.reason.title')}
			value={reasonCode}
			onChange={
				interactive ? (_, code) => onReasonSelect(code) : undefined
			}
			onKeyDown={
				interactive
					? (event) => {
							const digit = Number.parseInt(event.key, 10);
							if (
								!Number.isNaN(digit) &&
								digit >= 1 &&
								digit <= reasons.length
							) {
								event.preventDefault();
								onReasonSelect(reasons[digit - 1].code);
							}
						}
					: undefined
			}
		>
			{reasons.map((reason, index) => {
				const selected = reasonCode === reason.code;
				const hintId = `${id}-${index}-consent`;
				return (
					<ListItemButton
						key={reason.code}
						component="label"
						role="presentation"
						tabIndex={-1}
						selected={selected}
						className="caseHandoverReasonList__option"
					>
						<Radio
							value={reason.code}
							disabled={!interactive}
							inputProps={{
								'aria-label': caseHandoverReasonOptionLabel(
									translate,
									reason
								),
								'aria-checked': selected,
								'aria-describedby': reason.clientConsentRequired
									? hintId
									: undefined
							}}
						/>
						<ListItemText
							primary={caseHandoverReasonOptionLabel(
								translate,
								reason
							)}
							primaryTypographyProps={{ color: 'inherit' }}
						/>
						{reason.clientConsentRequired && (
							<Typography
								id={hintId}
								variant="caption"
								className="caseHandoverReasonList__consentHint"
							>
								{translate(
									'caseHandover.policy.clientConsentRequired'
								)}
							</Typography>
						)}
						<kbd className="caseHandoverReasonList__shortcut">
							{shortcutPrefix}+{index + 1}
						</kbd>
					</ListItemButton>
				);
			})}
		</RadioGroup>
	);
};
