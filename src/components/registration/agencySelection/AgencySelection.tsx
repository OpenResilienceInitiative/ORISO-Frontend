import * as React from 'react';
import {
	useState,
	useEffect,
	VFC,
	useContext,
	Dispatch,
	SetStateAction
} from 'react';
import { AgencySelectionResults } from './AgencySelectionResults';
import { RegistrationContext, RegistrationData } from '../../../globalState';
import { Box, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { UrlParamsContext } from '../../../globalState/provider/UrlParamsProvider';
import { useAgenciesForRegistration } from '../../../containers/registration/hooks/useAgenciesForRegistration';
import { Loading } from '../../../components/app/Loading';

export const AgencySelection: VFC<{
	onChange: Dispatch<SetStateAction<Partial<RegistrationData>>>;
	nextStepUrl: string;
	onNextClick(): void;
}> = ({ nextStepUrl, onNextClick, onChange }) => {
	const { t } = useTranslation();
	const { registrationData } = useContext(RegistrationContext);
	const { consultant: preselectedConsultant } = useContext(UrlParamsContext);

	const { isLoading, agencies } = useAgenciesForRegistration({
		topic: registrationData.mainTopic,
		postcode: registrationData?.zipcode
	});

	const [headlineZipcode, setHeadlineZipcode] = useState<string>('');

	useEffect(() => {
		if (!preselectedConsultant && registrationData?.zipcode?.length === 5) {
			setHeadlineZipcode(registrationData.zipcode);
		}
	}, [registrationData, preselectedConsultant]);

	if (isLoading) {
		return (
			<Box
				sx={{
					mt: '80px',
					width: '100%',
					display: 'flex',
					justifyContent: 'center'
				}}
			>
				<Loading />
			</Box>
		);
	}

	return (
		<>
			<Typography variant="h3">
				{preselectedConsultant?.agencies?.length === 1 ||
				agencies?.length === 1
					? t('registration.agency.consultantheadline')
					: t('registration.agency.headline')}
			</Typography>
			<AgencySelectionResults
				onChange={onChange}
				nextStepUrl={nextStepUrl}
				onNextClick={onNextClick}
				zipcode={headlineZipcode}
				results={agencies}
				fallbackUrl={registrationData?.mainTopic?.fallbackUrl}
			/>
		</>
	);
};
