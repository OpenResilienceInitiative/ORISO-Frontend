import * as React from 'react';
import { useState } from 'react';
import { IconButton, InputAdornment } from '@mui/material';
import { OrisoTextField } from '../form/OrisoTextField';
import { Text } from '../text/Text';
import { ReactComponent as ShowPasswordIcon } from '../../resources/img/icons/eye.svg';
import { ReactComponent as HidePasswordIcon } from '../../resources/img/icons/eye-closed.svg';
import './inputField.styles';
import { useTranslation } from 'react-i18next';

export type InputFieldLabelState = 'valid' | 'invalid';

// TODO: clean up interface
export interface InputFieldItem {
	id: string;
	type: string;
	name: string;
	label: string;
	content: string;
	class?: string;
	icon?: React.ReactElement;
	infoText?: string;
	maxLength?: number;
	pattern?: string;
	disabled?: boolean;
	postcodeFallbackLink?: string;
	warningLabel?: string;
	warningActive?: boolean;
	labelState?: InputFieldLabelState;
	tabIndex?: number;
}

export interface InputFieldProps {
	item: InputFieldItem;
	inputHandle: Function;
	keyUpHandle?: Function;
	onKeyDown?: Function;
}

export interface GeneratedInputs {
	addictiveDrugs?: string[];
	relation?: string;
	age?: string;
	gender?: string;
	state?: string;
}

// LEGACY COMPONENT, use "Input" instead
export const InputField = (props: InputFieldProps) => {
	const inputItem = props.item;
	const { t: translate } = useTranslation();
	const [showPassword, setShowPassword] = useState(false);

	const handleInputValidation = (e) => {
		const postcode = e.target.value;
		let postcodeValid = true;
		if (inputItem.maxLength) {
			postcodeValid = postcode.length <= inputItem.maxLength;
		}
		if (postcodeValid && postcode.length > 0 && inputItem.pattern) {
			postcodeValid = RegExp(inputItem.pattern).test(postcode);
		}
		if (postcodeValid) {
			props.inputHandle(e);
		}
	};

	const handleKeyUp = (e) => {
		if (props.keyUpHandle) {
			props.keyUpHandle(e);
		}
	};

	return (
		<div
			className={`inputField ${
				inputItem.icon ? `inputField--withIcon` : ``
			} ${inputItem.class ? ' ' + inputItem.class : ''}`}
		>
			<OrisoTextField
				onChange={handleInputValidation}
				id={inputItem.id}
				type={showPassword ? 'text' : inputItem.type}
				className={`inputField__textField
					${inputItem.labelState === 'valid' ? ' inputField__textField--valid' : ''}
					${inputItem.labelState === 'invalid' ? ' inputField__textField--invalid' : ''}
					${inputItem.type === 'password' ? ' inputField__textField--password' : ''}
				`}
				value={inputItem.content ? inputItem.content : ``}
				name={inputItem.name}
				label={inputItem.label}
				disabled={inputItem.disabled}
				autoComplete="off"
				onKeyUp={handleKeyUp}
				onKeyDown={(e) => (props.onKeyDown ? props.onKeyDown(e) : null)}
				tabIndex={inputItem.tabIndex}
				fullWidth
				inputProps={{
					maxLength: inputItem.maxLength,
					pattern: inputItem.pattern
				}}
				error={inputItem.labelState === 'invalid'}
				sx={{
					'mt': 0,
					'& .MuiInputAdornment-root': {
						height: '100%',
						maxHeight: 'none',
						marginTop: 0,
						alignItems: 'center',
						alignSelf: 'center'
					},
					'& .MuiIconButton-root': {
						width: 40,
						height: 40,
						padding: '8px',
						alignSelf: 'center'
					},
					'& .MuiSvgIcon-root, & svg': {
						width: 24,
						height: 24,
						display: 'block'
					},
					'& .MuiOutlinedInput-root': {
						alignItems: 'center'
					}
				}}
				InputProps={{
					startAdornment: inputItem.icon ? (
						<InputAdornment position="start">
							<span
								className="inputField__icon"
								aria-hidden="true"
							>
								{inputItem.icon}
							</span>
						</InputAdornment>
					) : undefined,
					endAdornment:
						inputItem.type === 'password' ? (
							<InputAdornment position="end">
								<IconButton
									onClick={() =>
										setShowPassword(!showPassword)
									}
									className="inputField__passwordToggle"
									edge="end"
									aria-label={
										showPassword
											? translate('login.password.hide')
											: translate('login.password.show')
									}
								>
									{showPassword ? (
										<HidePasswordIcon
											title={translate(
												'login.password.hide'
											)}
											color={'rgba(0, 0, 0, 0.65)'}
										/>
									) : (
										<ShowPasswordIcon
											title={translate(
												'login.password.show'
											)}
											color={'rgba(0, 0, 0, 0.65)'}
										/>
									)}
								</IconButton>
							</InputAdornment>
						) : undefined
				}}
			/>
			{inputItem.infoText && (
				<Text
					className="inputField__infoText"
					text={inputItem.infoText}
					type="infoSmall"
				/>
			)}
		</div>
	);
};
