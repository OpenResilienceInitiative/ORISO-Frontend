/**
 * Validity after the appointment end (#2252, decision 6): − and + step
 * through the options, a click on the field opens all of them as a list.
 * Presentational and controlled.
 */
import * as React from 'react';
import { useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, IconButton, Menu, MenuItem } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
	MAX_VALIDITY_MINUTES,
	VALIDITY_OPTIONS,
	stepValidity,
	validityParts
} from './invitationValidity';

const KEYS = 'directInvitation.dialog.validity';

export interface ValidityStepperProps {
	/** Minutes after the appointment end, 0–2880. */
	value: number;
	onChange: (minutes: number) => void;
	disabled?: boolean;
}

/** "Zum Ende des Termins", "30 Minuten", "24 Stunden". */
export const useValidityLabel = () => {
	const { t } = useTranslation();
	return (minutes: number) => {
		const parts = validityParts(minutes);
		return parts.unit === 'end'
			? t(`${KEYS}.end`)
			: t(`${KEYS}.${parts.unit}`, { count: parts.count });
	};
};

export const ValidityStepper = ({
	value,
	onChange,
	disabled = false
}: ValidityStepperProps) => {
	const { t } = useTranslation();
	const label = useValidityLabel();
	const id = useId();
	const fieldRef = useRef<HTMLButtonElement>(null);
	const [open, setOpen] = useState(false);

	return (
		<div className="validityStepper">
			<span id={`${id}-label`} className="validityStepper__label">
				{t(`${KEYS}.label`)}
			</span>
			<div className="validityStepper__row">
				<IconButton
					className="validityStepper__step"
					aria-label={t(`${KEYS}.less`)}
					disabled={disabled || value <= 0}
					onClick={() => onChange(stepValidity(value, 'down'))}
				>
					<RemoveIcon aria-hidden />
				</IconButton>
				<Button
					ref={fieldRef}
					variant="outlined"
					color="inherit"
					className="validityStepper__field"
					aria-haspopup="listbox"
					aria-expanded={open}
					aria-labelledby={`${id}-label ${id}-value`}
					disabled={disabled}
					onClick={() => setOpen(true)}
					endIcon={<ExpandMoreIcon aria-hidden fontSize="small" />}
				>
					<span id={`${id}-value`}>{label(value)}</span>
				</Button>
				<IconButton
					className="validityStepper__step"
					aria-label={t(`${KEYS}.more`)}
					disabled={disabled || value >= MAX_VALIDITY_MINUTES}
					onClick={() => onChange(stepValidity(value, 'up'))}
				>
					<AddIcon aria-hidden />
				</IconButton>
			</div>
			<span className="validityStepper__hint">{t(`${KEYS}.hint`)}</span>
			<Menu
				open={open}
				anchorEl={fieldRef.current}
				onClose={() => setOpen(false)}
				MenuListProps={{
					'role': 'listbox',
					'aria-labelledby': `${id}-label`
				}}
				slotProps={{ paper: { className: 'validityStepper__menu' } }}
			>
				{VALIDITY_OPTIONS.map((option) => (
					<MenuItem
						key={option}
						role="option"
						aria-selected={option === value}
						selected={option === value}
						onClick={() => {
							onChange(option);
							setOpen(false);
						}}
					>
						{label(option)}
					</MenuItem>
				))}
			</Menu>
		</div>
	);
};
