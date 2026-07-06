import * as React from 'react';
import {
	Checkbox,
	Chip,
	FormControl,
	FormHelperText,
	InputLabel,
	ListItemText,
	MenuItem,
	OutlinedInput,
	Select,
	SelectChangeEvent,
	SelectProps
} from '@mui/material';
import {
	orisoInputColors,
	orisoSelectMenuProps,
	orisoSelectSx
} from './orisoInputDesign';

export interface OrisoSelectOption {
	value: string;
	label: React.ReactNode;
	disabled?: boolean;
}

export interface OrisoSelectProps
	extends Omit<
		SelectProps<string>,
		'multiple' | 'onChange' | 'value' | 'variant'
	> {
	label: string;
	options: OrisoSelectOption[];
	value: string;
	helperText?: React.ReactNode;
	error?: boolean;
	onChange?: (
		event: SelectChangeEvent<string>,
		child: React.ReactNode
	) => void;
}

export interface OrisoMultiSelectProps
	extends Omit<
		SelectProps<string[]>,
		'multiple' | 'onChange' | 'value' | 'variant'
	> {
	label: string;
	options: OrisoSelectOption[];
	value: string[];
	helperText?: React.ReactNode;
	error?: boolean;
	onChange?: (
		event: SelectChangeEvent<string[]>,
		child: React.ReactNode
	) => void;
}

const useSelectId = (id?: string) => {
	const fallbackId = React.useId();

	return id || fallbackId;
};

export const OrisoSelect = ({
	label,
	options,
	value,
	helperText,
	error,
	id,
	fullWidth = true,
	onChange,
	...props
}: OrisoSelectProps) => {
	const selectId = useSelectId(id);
	const labelId = `${selectId}-label`;

	return (
		<FormControl
			fullWidth={fullWidth}
			error={error}
			disabled={props.disabled}
			sx={orisoSelectSx}
		>
			<InputLabel id={labelId}>{label}</InputLabel>
			<Select
				{...props}
				id={selectId}
				labelId={labelId}
				value={value}
				label={label}
				variant="outlined"
				input={<OutlinedInput label={label} />}
				MenuProps={props.MenuProps ?? orisoSelectMenuProps}
				onChange={onChange}
			>
				{options.map((option) => (
					<MenuItem
						key={option.value}
						value={option.value}
						disabled={option.disabled}
					>
						{option.label}
					</MenuItem>
				))}
			</Select>
			{helperText && <FormHelperText>{helperText}</FormHelperText>}
		</FormControl>
	);
};

export const OrisoMultiSelect = ({
	label,
	options,
	value,
	helperText,
	error,
	id,
	fullWidth = true,
	onChange,
	...props
}: OrisoMultiSelectProps) => {
	const selectId = useSelectId(id);
	const labelId = `${selectId}-label`;
	const labelByValue = new Map(
		options.map((option) => [option.value, option.label])
	);

	return (
		<FormControl
			fullWidth={fullWidth}
			error={error}
			disabled={props.disabled}
			sx={orisoSelectSx}
		>
			<InputLabel id={labelId}>{label}</InputLabel>
			<Select
				{...props}
				multiple
				id={selectId}
				labelId={labelId}
				value={value}
				label={label}
				variant="outlined"
				input={<OutlinedInput label={label} />}
				MenuProps={props.MenuProps ?? orisoSelectMenuProps}
				onChange={onChange}
				renderValue={(selected) => (
					<span className="orisoMultiSelectValue">
						{selected.map((selectedValue) => (
							<Chip
								key={selectedValue}
								label={labelByValue.get(selectedValue)}
								size="small"
								sx={{
									height: 28,
									borderRadius: '999px',
									backgroundColor:
										orisoInputColors.selectedLayer,
									color: orisoInputColors.primary,
									fontSize: 13,
									fontWeight: 500
								}}
							/>
						))}
					</span>
				)}
			>
				{options.map((option) => (
					<MenuItem
						key={option.value}
						value={option.value}
						disabled={option.disabled}
					>
						<Checkbox checked={value.includes(option.value)} />
						<ListItemText primary={option.label} />
					</MenuItem>
				))}
			</Select>
			{helperText && <FormHelperText>{helperText}</FormHelperText>}
		</FormControl>
	);
};
