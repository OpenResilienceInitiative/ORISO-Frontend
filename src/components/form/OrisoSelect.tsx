import * as React from 'react';
import {
	Checkbox,
	Chip,
	FormControl,
	FormHelperText,
	InputLabel,
	ListItemText,
	ListSubheader,
	MenuItem,
	OutlinedInput,
	Select,
	SelectChangeEvent,
	SelectProps,
	TextField
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
	searchable?: boolean;
	searchPlaceholder?: string;
	onChange?: (
		event: SelectChangeEvent<string[]>,
		child: React.ReactNode
	) => void;
}

const optionLabelText = (label: React.ReactNode): string => {
	if (typeof label === 'string' || typeof label === 'number') {
		return String(label);
	}

	return '';
};

export const optionMatchesSearch = (
	option: OrisoSelectOption,
	query: string
): boolean => {
	const needle = query.trim().toLowerCase();

	if (!needle) {
		return true;
	}

	return optionLabelText(option.label).toLowerCase().includes(needle);
};

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
	searchable = false,
	searchPlaceholder = 'Search',
	...props
}: OrisoMultiSelectProps) => {
	const selectId = useSelectId(id);
	const labelId = `${selectId}-label`;
	const searchId = `${selectId}-search`;
	const [searchQuery, setSearchQuery] = React.useState('');
	const labelByValue = new Map(
		options.map((option) => [option.value, option.label])
	);
	const visibleOptions = searchable
		? options.filter((option) => optionMatchesSearch(option, searchQuery))
		: options;
	const menuProps = searchable
		? {
				...(props.MenuProps ?? orisoSelectMenuProps),
				autoFocus: false,
				disableAutoFocusItem: true
			}
		: (props.MenuProps ?? orisoSelectMenuProps);

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
				MenuProps={menuProps}
				onChange={onChange}
				{...(searchable ? { onClose: () => setSearchQuery('') } : {})}
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
				{searchable && (
					<ListSubheader
						sx={{
							backgroundColor: orisoInputColors.surface,
							lineHeight: 'normal',
							py: 1,
							px: 1.5
						}}
					>
						<TextField
							id={searchId}
							size="small"
							fullWidth
							autoFocus
							autoComplete="off"
							placeholder={searchPlaceholder}
							value={searchQuery}
							inputProps={{ 'aria-label': searchPlaceholder }}
							onChange={(event) =>
								setSearchQuery(event.target.value)
							}
							onClick={(event) => event.stopPropagation()}
							onMouseDown={(event) => event.stopPropagation()}
							onKeyDown={(event) => {
								if (event.key !== 'Escape') {
									event.stopPropagation();
								}
							}}
						/>
					</ListSubheader>
				)}
				{visibleOptions.map((option) => (
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
