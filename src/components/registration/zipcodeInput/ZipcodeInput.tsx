import { Box, Typography } from '@mui/material';
import * as React from 'react';
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
import { registrationMd3 } from '../registrationDesign/registrationDesign';
import { ZipcodeDigits, ZIPCODE_LENGTH } from './ZipcodeDigits';
import { WhyLocalDisclosure } from './WhyLocalDisclosure';
import { AgencyCounsellingIcon } from '../../../resources/img/registration-md3/registrationArtwork';

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
			/* Only invalidate a chosen agency when the zipcode actually
			   changed — merely revisiting this step (free stepper navigation)
			   must not erase the agency selection on commit. */
			onChange(
				value === registrationData.zipcode
					? { zipcode: value }
					: {
							zipcode: value,
							agencyId: undefined,
							agency: undefined
						}
			);
		} else {
			setDisabledNextButton(true);
			onChange({
				zipcode: undefined,
				agencyId: undefined,
				agency: undefined
			});
		}
	}, [setDisabledNextButton, onChange, value, registrationData.zipcode]);

	const remaining = ZIPCODE_LENGTH - value.length;

	return (
		<Box
			data-cy="zipcode-step"
			sx={{
				maxWidth: '520px',
				mx: 'auto',
				// This step is one short block — icon, question, five digit
				// boxes — in a column that has room to spare. Sitting it at the
				// top left a large empty field below it. `auto` block margins
				// centre it in whatever the header and the footer leave over,
				// and they collapse to the natural top offset as soon as the
				// disclosure below is expanded and the block outgrows the space.
				my: 'auto',
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'center',
				textAlign: 'center'
			}}
		>
			{/* Inlined at build time — no request, and it takes the brand colour. */}
			<Box
				aria-hidden
				sx={{
					'width': { xs: 132, sm: 152 },
					'height': { xs: 132, sm: 152 },
					'mb': 2.5,
					'color': registrationMd3.primary,
					'& svg': { width: '100%', height: '100%', display: 'block' }
				}}
			>
				<AgencyCounsellingIcon />
			</Box>
			<Typography
				component="h1"
				sx={{
					fontSize: { xs: 24, sm: 28 },
					lineHeight: { xs: '31px', sm: '35px' },
					fontWeight: 700,
					color: registrationMd3.onSurface,
					textWrap: 'pretty'
				}}
			>
				{t('registration.zipcode.headline')}
			</Typography>
			<Typography
				sx={{
					mt: 1,
					fontSize: 14,
					lineHeight: '20px',
					color: registrationMd3.onSurfaceVariant,
					textWrap: 'pretty'
				}}
			>
				{t('registration.zipcode.subline')}
			</Typography>

			<Box sx={{ width: '100%', maxWidth: 340, mt: 3 }}>
				<ZipcodeDigits
					value={value}
					onChange={setValue}
					digitLabel={(position) =>
						t('registration.zipcode.digitLabel', {
							position,
							total: ZIPCODE_LENGTH
						})
					}
				/>
				<Typography
					role="status"
					aria-live="polite"
					sx={{
						mt: 1.25,
						minHeight: 20,
						fontSize: 13,
						lineHeight: '20px',
						color: registrationMd3.onSurfaceVariant
					}}
				>
					{remaining > 0 && value.length > 0
						? t('registration.zipcode.remaining', {
								count: remaining
							})
						: ''}
				</Typography>
			</Box>

			<Box sx={{ width: '100%', maxWidth: 400, mt: 3 }}>
				<WhyLocalDisclosure />
			</Box>
		</Box>
	);
};
