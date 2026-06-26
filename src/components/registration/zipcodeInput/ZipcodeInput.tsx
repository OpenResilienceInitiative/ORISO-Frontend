import { Box, InputAdornment, TextField, Typography } from '@mui/material';
import * as React from 'react';
import PlaceRoundedIcon from '@mui/icons-material/PlaceRounded';
import {
	useState,
	FC,
	useContext,
	useEffect,
	Dispatch,
	SetStateAction
} from 'react';
import { useTranslation } from 'react-i18next';
import { RegistrationContext, RegistrationData } from '../../../globalState';
import { REGISTRATION_DATA_VALIDATION } from '../registrationDataValidation';
import {
	registrationMd3,
	registrationMd3TextFieldSx,
	registrationScreenTitleSx
} from '../registrationDesign/registrationDesign';

export const ZipcodeInput: FC<{
	onChange: Dispatch<SetStateAction<Partial<RegistrationData>>>;
}> = ({ onChange }) => {
	const { t } = useTranslation();
	const { setDisabledNextButton, registrationData } =
		useContext(RegistrationContext);
	const [value, setValue] = useState<string>(registrationData.zipcode || '');

	useEffect(() => {
		if (REGISTRATION_DATA_VALIDATION.zipcode.validation(value)) {
			setDisabledNextButton(false);
			onChange({
				zipcode: value,
				agencyId: undefined,
				agency: undefined
			});
		} else {
			setDisabledNextButton(true);
			onChange({
				zipcode: undefined,
				agencyId: undefined,
				agency: undefined
			});
		}
	}, [setDisabledNextButton, onChange, value]);

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
				<PlaceRoundedIcon
					sx={{ fontSize: 32, color: registrationMd3.primary }}
				/>
			</Box>
			<Typography
				component="h1"
				variant="h3"
				sx={registrationScreenTitleSx}
			>
				{t('registration.zipcode.headline')}
			</Typography>
			<Box
				sx={{
					width: '100%',
					textAlign: 'left',
					bgcolor: registrationMd3.surfaceContainer,
					borderRadius: '16px',
					px: 3,
					py: 2.5,
					mt: 3,
					mb: 4
				}}
			>
				<Typography sx={{ fontWeight: 700, mb: 1 }}>
					{t('registration.zipcode.subline')}
				</Typography>
				<Typography sx={{ color: registrationMd3.onSurfaceVariant }}>
					{t('registration.zipcode.bullet1')}
				</Typography>
				<Typography sx={{ color: registrationMd3.onSurfaceVariant }}>
					{t('registration.zipcode.bullet2')}
				</Typography>
			</Box>
			<Box sx={{ width: '100%', maxWidth: 340 }}>
				<TextField
					value={value}
					onChange={(event) => {
						const nextValue = event.target.value
							.replace(/\D/g, '')
							.slice(0, 5);
						setValue(nextValue);
					}}
					placeholder={t('registration.zipcode.label')}
					fullWidth
					autoComplete="postal-code"
					inputProps={{
						'data-cy': 'input-postal-code',
						'inputMode': 'numeric',
						'maxLength': 5,
						'aria-label': t('registration.zipcode.label')
					}}
					InputProps={{
						startAdornment: (
							<InputAdornment position="start">
								<PlaceRoundedIcon
									sx={{
										color: registrationMd3.onSurfaceVariant
									}}
								/>
							</InputAdornment>
						)
					}}
					sx={registrationMd3TextFieldSx}
				/>
			</Box>
		</Box>
	);
};
