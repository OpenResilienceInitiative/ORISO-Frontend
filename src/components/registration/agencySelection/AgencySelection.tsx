import * as React from 'react';
import {
	useState,
	useEffect,
	FC,
	useContext,
	Dispatch,
	SetStateAction
} from 'react';
import { useNavigate } from 'react-router-dom';
import { AgencySelectionResults } from './AgencySelectionResults';
import {
	RegistrationContext,
	RegistrationData,
	TenantContext
} from '../../../globalState';
import { Box, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { UrlParamsContext } from '../../../globalState/provider/UrlParamsProvider';
import { useAgenciesForRegistration } from '../../../containers/registration/hooks/useAgenciesForRegistration';
import { Loading } from '../../../components/app/Loading';
import { registrationScreenTitleSx } from '../registrationDesign/registrationDesign';
import { useRegistrationAddon } from '../../../addons/registrationAddon';
import { RegistrationAddonStep } from '../../../addons/RegistrationAddonStep';
import { useRegistrationAddonComplete } from './useRegistrationAddonComplete';

interface AgencySelectionProps {
	onChange: Dispatch<SetStateAction<Partial<RegistrationData>>>;
	nextStepUrl: string;
	onNextClick(): void;
	prevStepUrl?: string | null;
}

const CenteredLoading = () => (
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

/** The agency selection step: an add-on's when the Träger has one, the core's otherwise. */
export const AgencySelection: FC<AgencySelectionProps> = (props) => {
	const { tenant } = useContext(TenantContext) ?? {};
	const registrationAddon = useRegistrationAddon(tenant?.id);

	if (registrationAddon.status === 'loading') {
		return <CenteredLoading />;
	}
	if (registrationAddon.status === 'ready') {
		return (
			<AddonAgencySelection
				{...props}
				addon={registrationAddon.addon}
				app={registrationAddon.app}
			/>
		);
	}
	return <CoreAgencySelection {...props} />;
};

const AddonAgencySelection = ({
	addon,
	app,
	onNextClick,
	prevStepUrl
}: AgencySelectionProps &
	Pick<
		React.ComponentProps<typeof RegistrationAddonStep>,
		'addon' | 'app'
	>) => {
	const navigate = useNavigate();
	const { registrationData } = useContext(RegistrationContext);
	const complete = useRegistrationAddonComplete(onNextClick);
	const back = React.useCallback(() => {
		if (prevStepUrl) {
			navigate(prevStepUrl);
		}
	}, [navigate, prevStepUrl]);
	return (
		<RegistrationAddonStep
			addon={addon}
			app={app}
			topicId={registrationData?.mainTopic?.id}
			postcode={registrationData?.zipcode || undefined}
			onComplete={complete}
			onBack={back}
		/>
	);
};

const CoreAgencySelection: FC<AgencySelectionProps> = ({
	nextStepUrl,
	onNextClick,
	onChange
}) => {
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
		return <CenteredLoading />;
	}

	return (
		<>
			<Typography
				component="h1"
				variant="h3"
				sx={registrationScreenTitleSx}
			>
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
