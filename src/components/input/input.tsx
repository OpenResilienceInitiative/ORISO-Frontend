import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { InputBaseComponentProps, TextField, Typography } from '@mui/material';
import CancelIcon from '@mui/icons-material/Cancel';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useTranslation } from 'react-i18next';

export interface InputProps {
	label: string;
	value: string;
	inputMode?:
		| 'tel'
		| 'text'
		| 'email'
		| 'search'
		| 'url'
		| 'none'
		| 'numeric'
		| 'decimal';
	onInputChange?: Function;
	startAdornment?: React.ReactElement;
	endAdornment?: React.ReactElement;
	isValueValid?(value: string): Promise<boolean>;
	inputType?: 'number' | 'tel' | 'text' | 'password';
	inputProps?: InputBaseComponentProps;
	info?: string;
	autoComplete?: string;
	errorMessage?: string;
	successMesssage?: string;
	multipleCriteria?: Array<{
		info: string;
		validation: (val: string) => boolean;
	}>;
}

export const Input = ({
	value,
	label,
	onInputChange,
	startAdornment,
	endAdornment,
	isValueValid,
	inputType,
	inputProps,
	info,
	inputMode,
	errorMessage,
	successMesssage,
	multipleCriteria,
	autoComplete
}: InputProps) => {
	const { t } = useTranslation();
	const [shrink, setShrink] = useState<boolean>(value?.length > 0);
	const [wasBlurred, setWasBlurred] = useState<boolean>(false);
	const [showSuccessMessage, setShowSuccessMessage] =
		useState<boolean>(false);
	const [inputError, setInputError] = useState<boolean>(false);

	const isValid = async (val) => {
		if (isValueValid) {
			return await isValueValid(val);
		} else if (multipleCriteria) {
			return multipleCriteria.every((criteria) =>
				criteria.validation(val)
			);
		} else {
			return true;
		}
	};

	const handleBlur = async () => {
		setWasBlurred(true);
		const valid = await isValid(value);
		if (value?.length === 0) {
			setShrink(false);
		} else if (!valid) {
			setInputError(true);
		}
		if ((successMesssage || multipleCriteria) && valid) {
			setShowSuccessMessage(true);
		} else {
			setShowSuccessMessage(false);
		}
	};

	const handleChange = async (e) => {
		onInputChange(e.target.value);
		const valid = await isValid(e.target.value);
		if (inputError && valid) {
			setInputError(false);
			setShowSuccessMessage(!!successMesssage || !!multipleCriteria);
		} else if (showSuccessMessage && !valid) {
			setInputError(true);
			setShowSuccessMessage(false);
		}
	};

	const getMultipleCriteriaDesign = (criteria) => {
		const isFulfilled = criteria.validation(value);
		const iconWrapper = (icon) => (
			<span
				aria-hidden="true"
				style={{
					display: 'inline-flex',
					alignItems: 'center',
					justifyContent: 'center',
					width: '16px',
					height: '16px',
					marginRight: '3px',
					flex: '0 0 16px'
				}}
			>
				{icon}
			</span>
		);
		const icon = isFulfilled ? (
			<CheckCircleIcon
				color="success"
				sx={{
					width: '16px',
					height: '16px'
				}}
			/>
		) : wasBlurred ? (
			<CancelIcon
				color="error"
				sx={{
					width: '16px',
					height: '16px'
				}}
			/>
		) : (
			'•'
		);
		const color = isFulfilled
			? 'success.main'
			: wasBlurred
				? 'error.main'
				: 'info.light';
		return { isFulfilled, icon: iconWrapper(icon), color };
	};
	const inputRef = useRef<any>(null);
	useEffect(() => {
		if (
			value?.length === 0 &&
			document.activeElement !== inputRef.current
		) {
			setShrink(false);
		}
	}, [value]);

	return (
		<>
			<TextField
				inputRef={inputRef}
				type={inputType || 'text'}
				fullWidth
				label={label}
				autoComplete={autoComplete}
				inputProps={{
					inputMode: inputMode,
					...inputProps
				}}
				sx={{
					'&[type=number]': {
						MozAppearance: 'textfield'
					},
					'&::-webkit-outer-spin-button': {
						WebkitAppearance: 'none',
						margin: 0
					},
					'&::-webkit-inner-spin-button': {
						WebkitAppearance: 'none',
						margin: 0
					},
					'mt': '24px',
					'& legend': {
						display: 'none'
					},
					'& label': {
						ml: 4,
						color: 'info.light'
					},
					'& label.MuiInputLabel-shrink': {
						top: '10px'
					},
					'& .MuiInputAdornment-root': {
						mb: '5px'
					},
					'& .MuiOutlinedInput-root': {
						'&.Mui-focused fieldset': {
							borderColor: showSuccessMessage && 'success.main'
						},
						'&:hover fieldset': {
							borderColor: showSuccessMessage && 'success.main'
						}
					},
					'& fieldset': {
						'borderWidth': showSuccessMessage && '2px',
						'borderColor': showSuccessMessage && 'success.main',
						'&:hover': {
							borderColor: showSuccessMessage && 'success.main'
						}
					},
					'& .Mui-error fieldset': {
						borderWidth: '2px'
					}
				}}
				InputLabelProps={{
					shrink: shrink
				}}
				color="info"
				InputProps={{
					startAdornment: startAdornment,
					endAdornment: endAdornment
				}}
				value={value}
				error={inputError}
				onChange={handleChange}
				onFocus={() => {
					setShrink(true);
				}}
				onBlur={handleBlur}
			/>
			{info && !inputError && !showSuccessMessage && (
				<Typography
					variant="body2"
					sx={{
						mt: '8px',
						fontSize: '16px',
						lineHeight: '16px',
						color: 'info.light'
					}}
				>
					{info}
				</Typography>
			)}
			{errorMessage && inputError && (
				<Typography
					variant="body2"
					sx={{
						mt: '8px',
						fontSize: '16px',
						lineHeight: '16px',
						color: 'error.main'
					}}
				>
					{errorMessage}
				</Typography>
			)}
			{showSuccessMessage && successMesssage && (
				<Typography
					variant="body2"
					sx={{
						mt: '8px',
						fontSize: '16px',
						lineHeight: '16px',
						color: 'success.main'
					}}
				>
					{successMesssage}
				</Typography>
			)}
			{multipleCriteria?.map((criteria) => {
				const { icon, color, isFulfilled } =
					getMultipleCriteriaDesign(criteria);
				return (
					<Typography
						key={criteria.info}
						variant="body2"
						sx={{
							mt: '8px',
							fontSize: '16px',
							lineHeight: '16px',
							color,
							display: 'flex',
							alignItems: 'center'
						}}
					>
						{icon}
						{isFulfilled && (
							<span className="sr-only">
								{t(
									'registration.account.password.criteria.fulfilled'
								)}
								:{' '}
							</span>
						)}
						<span>{t(criteria.info)}</span>
					</Typography>
				);
			})}
		</>
	);
};
