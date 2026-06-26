import { Box, InputAdornment, Typography } from '@mui/material';
import * as React from 'react';
import FmdGoodIcon from '@mui/icons-material/FmdGood';
import {
	useState,
	FC,
	useContext,
	useEffect,
	Dispatch,
	SetStateAction
} from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '../../../components/input/input';
import { RegistrationContext, RegistrationData } from '../../../globalState';
import { REGISTRATION_DATA_VALIDATION } from '../registrationDataValidation';
import { registrationMd3 } from '../registrationDesign/registrationDesign';

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
				<FmdGoodIcon
					sx={{ fontSize: 32, color: registrationMd3.primary }}
				/>
			</Box>
			<Typography
				variant="h3"
				sx={{
					color: registrationMd3.onSurface,
					fontWeight: 800,
					lineHeight: 1.2
				}}
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
				<Input
					inputProps={{
						'data-cy': 'input-postal-code'
					}}
					autoComplete="postal-code"
					inputMode="numeric"
					inputType="text"
					isValueValid={async (val: string) => val.length === 5}
					startAdornment={
						<InputAdornment position="start">
							<FmdGoodIcon
								sx={{ color: registrationMd3.onSurfaceVariant }}
							/>
						</InputAdornment>
					}
					onInputChange={(val: string) => {
						const reg = /^\d*$/;
						if (val.length < 6 && reg.test(val)) {
							setValue(val);
						}
					}}
					value={value}
					label={t('registration.zipcode.label')}
				/>
			</Box>
		</Box>
	);
};
