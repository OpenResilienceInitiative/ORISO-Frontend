import { Box, MenuItem, Typography } from '@mui/material';
import * as React from 'react';
import {
	Dispatch,
	FC,
	SetStateAction,
	useContext,
	useEffect,
	useState
} from 'react';
import { SvgIconComponent } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { RegistrationContext, RegistrationData } from '../../../globalState';
import { OrisoTextField } from '../../form/OrisoTextField';
import {
	registrationMd3,
	registrationScreenTitleSx
} from '../registrationDesign/registrationDesign';

export const DemographicSelectInput: FC<{
	field: 'age' | 'state';
	headlineKey: string;
	placeholderKey: string;
	Icon: SvgIconComponent;
	options: Array<{ value: string; label: string }>;
	onChange: Dispatch<SetStateAction<Partial<RegistrationData>>>;
}> = ({ field, headlineKey, placeholderKey, Icon, options, onChange }) => {
	const { t } = useTranslation();
	const { setDisabledNextButton, registrationData } =
		useContext(RegistrationContext);
	const [value, setValue] = useState<string>(registrationData?.[field] || '');

	useEffect(() => {
		const isValid = options.some((option) => option.value === value);
		setDisabledNextButton?.(!isValid);
		onChange(isValid ? { [field]: value } : { [field]: undefined });
	}, [field, onChange, options, setDisabledNextButton, value]);

	return (
		<Box
			sx={{
				maxWidth: '520px',
				mx: 'auto',
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'center',
				textAlign: 'center'
			}}
		>
			<Box
				sx={{
					width: 64,
					height: 64,
					borderRadius: '50%',
					bgcolor: registrationMd3.surfaceContainer,
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					mb: 2.5
				}}
			>
				<Icon sx={{ fontSize: 32, color: registrationMd3.primary }} />
			</Box>
			<Typography
				component="h1"
				variant="h3"
				sx={registrationScreenTitleSx}
			>
				{t(headlineKey)}
			</Typography>
			<Box sx={{ width: '100%', maxWidth: 340, mt: 3 }}>
				<OrisoTextField
					select
					value={value}
					onChange={(event) => setValue(event.target.value)}
					placeholder={t(placeholderKey)}
					fullWidth
					SelectProps={{
						displayEmpty: true,
						renderValue: (selected) => {
							if (!selected) {
								return (
									<Typography
										component="span"
										sx={{
											color: registrationMd3.onSurfaceVariant
										}}
									>
										{t(placeholderKey)}
									</Typography>
								);
							}

							return (
								options.find(
									(option) => option.value === selected
								)?.label || String(selected)
							);
						}
					}}
					inputProps={{
						'data-cy': `registration-${field}-select`,
						'aria-label': t(placeholderKey)
					}}
				>
					{options.map((option) => (
						<MenuItem key={option.value} value={option.value}>
							{option.label}
						</MenuItem>
					))}
				</OrisoTextField>
			</Box>
		</Box>
	);
};
