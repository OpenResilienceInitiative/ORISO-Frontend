import * as React from 'react';
import {
	Typography,
	FormControlLabel,
	FormControl,
	Radio,
	RadioGroup,
	Box,
	Button,
	Link,
	Avatar
} from '@mui/material';
import {
	Dispatch,
	SetStateAction,
	useContext,
	useEffect,
	useState
} from 'react';
import ConsultantIllustration from '../../../resources/img/illustrations/consultant-found.svg';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import { useTranslation } from 'react-i18next';
import { RegistrationContext, RegistrationData } from '../../../globalState';
import { AgencyDataInterface } from '../../../globalState/interfaces';
import { AgencyLanguages } from './AgencyLanguages';
import { AgencyDetailsPanel } from './AgencyDetailsPanel';
import { REGISTRATION_DATA_VALIDATION } from '../registrationDataValidation';
import { UrlParamsContext } from '../../../globalState/provider/UrlParamsProvider';
import { getOrganizationHomeUrl } from '../../../resources/scripts/runtimeConfig';
import ApartmentRoundedIcon from '@mui/icons-material/ApartmentRounded';
import { registrationMd3 } from '../registrationDesign/registrationDesign';
import { SearchEmptyStateAnimation } from '../../emptyState/SearchEmptyStateAnimation';
import '../../emptyState/emptyState.styles';

interface AgencySelectionResultsProps {
	onChange: Dispatch<SetStateAction<Partial<RegistrationData>>>;
	isLoading?: boolean;
	zipcode?: string;
	results?: AgencyDataInterface[];
	nextStepUrl: string;
	fallbackUrl: string;
	onNextClick(): void;
}

export const AgencySelectionResults = ({
	onChange,
	zipcode,
	results,
	fallbackUrl
}: AgencySelectionResultsProps) => {
	const { t } = useTranslation();
	const { setDisabledNextButton, registrationData } =
		useContext(RegistrationContext);
	const { consultant: preselectedConsultant } = useContext(UrlParamsContext);
	const [selectedAgency, setSelectedAgency] = useState<AgencyDataInterface>(
		registrationData?.agency
	);
	const [openAgencyDetailsId, setOpenAgencyDetailsId] = useState<
		number | null
	>(null);

	const onlyExternalAgencies = results?.every((agency) => agency.external);
	const isSingleResultAndNotOnlyExternal =
		results?.length === 1 && !onlyExternalAgencies;

	useEffect(() => {
		if (
			// only external agencies
			results?.length > 0 &&
			results?.every((agency) => agency.external)
		) {
			setSelectedAgency(undefined);
			setDisabledNextButton(true);
			onChange({
				agency: undefined
			});
			return;
		}
		if (
			// only one agency
			results?.length === 1 &&
			results?.every((agency) => !agency.external)
		) {
			setSelectedAgency(results[0]);
			setDisabledNextButton(false);
			onChange({
				agency: results[0]
			});
			return;
		}

		if (results?.length === 0) {
			setDisabledNextButton(true);
			onChange({
				agency: undefined
			});
			return;
		}

		if (
			// valid agencyId
			REGISTRATION_DATA_VALIDATION.agencyId.validation(
				selectedAgency?.id?.toString()
			)
		) {
			setDisabledNextButton(false);
			onChange({ agency: selectedAgency });
		}
	}, [selectedAgency, results, onChange, setDisabledNextButton, zipcode]);

	const renderAgencyLabel = (agency: AgencyDataInterface) => {
		const detailsOpen = openAgencyDetailsId === agency.id;
		const detailsLabel = detailsOpen
			? t('registration.agency.details.less', 'Weniger')
			: t('registration.agency.details.more', 'Mehr');

		return (
			<Box
				sx={{
					width: '100%',
					minWidth: 0,
					py: 1.75,
					pl: 2,
					pr: { xs: 7, sm: 7.5 }
				}}
			>
				<Box
					sx={{
						display: 'grid',
						gridTemplateColumns: {
							xs: 'auto minmax(0, 1fr)',
							sm: 'auto minmax(0, 1fr) auto'
						},
						columnGap: { xs: 1.25, sm: 1.75 },
						rowGap: { xs: 1, sm: 0 },
						alignItems: 'flex-start'
					}}
				>
					<Avatar
						sx={{
							width: { xs: 40, sm: 48 },
							height: { xs: 40, sm: 48 },
							bgcolor: registrationMd3.surfaceContainer,
							color: registrationMd3.primary
						}}
					>
						<ApartmentRoundedIcon />
					</Avatar>
					<Box sx={{ minWidth: 0 }}>
						<Typography
							variant="subtitle1"
							sx={{
								fontWeight: 700,
								color: registrationMd3.onSurface,
								wordBreak: 'normal',
								overflowWrap: 'normal',
								hyphens: 'none'
							}}
						>
							{agency.name}
						</Typography>
						<Typography
							variant="body2"
							sx={{
								color: registrationMd3.onSurfaceVariant,
								mt: '8px'
							}}
						>
							{t('registration.agency.result.languages')}
						</Typography>
						<AgencyLanguages agencyId={agency.id} />
					</Box>
					<Button
						type="button"
						aria-expanded={detailsOpen}
						aria-label={`${detailsLabel}: ${agency.name}`}
						onClick={(event) => {
							event.preventDefault();
							event.stopPropagation();
							setOpenAgencyDetailsId((currentId) =>
								currentId === agency.id ? null : agency.id
							);
						}}
						endIcon={
							<ExpandMoreRoundedIcon
								sx={{
									transform: detailsOpen
										? 'rotate(180deg)'
										: 'none',
									transition: 'transform 160ms ease'
								}}
							/>
						}
						sx={{
							'alignSelf': 'center',
							'gridColumn': { xs: '2 / 3', sm: 'auto' },
							'justifySelf': { xs: 'start', sm: 'auto' },
							'color': registrationMd3.onSurfaceVariant,
							'fontWeight': 700,
							'fontSize': 14,
							'textTransform': 'none',
							'minWidth': { xs: 44, sm: 'auto' },
							'px': { xs: 1, sm: 1.25 },
							'whiteSpace': 'nowrap',
							'&:hover': {
								backgroundColor: registrationMd3.hoverLayer
							},
							'&:focus-visible': {
								outline: `2px solid ${registrationMd3.focus}`,
								outlineOffset: 2
							},
							'& .MuiButton-endIcon': {
								ml: { xs: 0, sm: 0.5 },
								mr: { xs: 0, sm: -0.25 }
							}
						}}
					>
						<Box
							component="span"
							sx={{ display: { xs: 'none', sm: 'inline' } }}
						>
							{detailsLabel}
						</Box>
					</Button>
				</Box>
				<AgencyDetailsPanel agency={agency} open={detailsOpen} />
			</Box>
		);
	};

	return (
		<>
			{!!results && !preselectedConsultant && (
				<Typography
					variant="body1"
					sx={{
						mt: '24px',
						mb: '16px',
						fontWeight: '700',
						color: registrationMd3.onSurface
					}}
				>
					{t('registration.agency.result.headline') + ' ' + zipcode}:
				</Typography>
			)}

			{/* no Results */}
			{results?.length === 0 && (
				<Box
					sx={{
						display: 'flex',
						flexWrap: { xs: 'wrap-reverse', md: 'nowrap' },
						justifyContent: 'space-between',
						alignItems: 'center',
						p: '16px',
						mt: '16px',
						borderRadius: '4px',
						border: '1px solid #c6c5c4'
					}}
				>
					<Box sx={{ mr: { xs: '0', md: '24px' } }}>
						<Typography variant="h5" sx={{ fontWeight: '600' }}>
							{t('registration.agency.noresult.headline')}
						</Typography>
						<Typography sx={{ mt: '16px' }}>
							{t('registration.agency.noresult.subline')}
						</Typography>
						<Button
							sx={{
								mt: '16px',
								width: { xs: '100%', md: 'auto' }
							}}
							variant="contained"
							startIcon={<OpenInNewIcon />}
							target="_blank"
							component={Link}
							href={
								fallbackUrl
									? `${fallbackUrl}${zipcode}/`
									: getOrganizationHomeUrl()
							}
						>
							{t('registration.agency.noresult.label')}
						</Button>
					</Box>
					<Box
						sx={{
							'--empty-state-animation-size': '176px',
							'--empty-state-lottie-scale': '0.86',
							'mx': 'auto',
							'mb': { xs: '24px', md: '0' },
							'flexShrink': 0
						}}
					>
						<SearchEmptyStateAnimation />
					</Box>
				</Box>
			)}

			{/* only external results */}
			{results?.length > 0 && onlyExternalAgencies && (
				<Box
					sx={{
						display: 'flex',
						flexWrap: { xs: 'wrap-reverse', md: 'nowrap' },
						justifyContent: 'space-between',
						alignItems: 'center',
						p: '16px',
						mt: '16px',
						borderRadius: '4px',
						border: '1px solid #c6c5c4'
					}}
				>
					<Box sx={{ mr: { xs: '0', md: '24px' } }}>
						<Typography variant="h5" sx={{ fontWeight: '600' }}>
							{t('registration.agency.result.external.headline')}
						</Typography>
						<Typography sx={{ mt: '16px' }}>
							{t('registration.agency.result.external.subline')}
						</Typography>
						{results?.[0]?.url && (
							<Button
								target="_blank"
								component={Link}
								href={results?.[0]?.url}
								sx={{
									mt: '16px',
									width: { xs: '100%', md: 'auto' }
								}}
								variant="contained"
								startIcon={<OpenInNewIcon />}
							>
								{t('registration.agency.result.external.link')}
							</Button>
						)}
					</Box>
					<Box
						component="img"
						src={ConsultantIllustration}
						sx={{
							height: '156px',
							width: '156px',
							mx: 'auto',
							mb: { xs: '24px', md: '0' }
						}}
					/>
				</Box>
			)}

			{/* one Result */}
			{isSingleResultAndNotOnlyExternal && (
				<FormControl
					sx={{
						width: '100%',
						border: `1px solid ${registrationMd3.outlineVariant}`,
						borderRadius: '16px',
						overflow: 'hidden',
						bgcolor: registrationMd3.surface
					}}
				>
					<RadioGroup
						data-cy="agency-selection-radio-group"
						aria-label="agency-selection-radio-group"
						name="agency-selection-radio-group"
						value={results?.[0].name || ''}
					>
						<Box
							sx={{
								display: 'flex',
								justifyContent: 'space-between',
								width: '100%',
								backgroundColor: registrationMd3.selectedLayer
							}}
						>
							<FormControlLabel
								data-cy={`agency-selection-radio-${results?.[0].id}`}
								labelPlacement="start"
								sx={{
									'alignItems': 'stretch',
									'm': 0,
									'width': '100%',
									'justifyContent': 'space-between',
									'position': 'relative',
									'& .MuiFormControlLabel-label': {
										width: '100%',
										minWidth: 0
									},
									'& .MuiRadio-root': {
										position: 'absolute',
										top: '18px',
										right: { xs: 12, sm: 16 },
										m: 0
									}
								}}
								value={results?.[0].name || ''}
								control={
									<Radio
										sx={{
											'color': registrationMd3.outline,
											'&.Mui-checked': {
												color: registrationMd3.primary
											}
										}}
										checked
									/>
								}
								label={renderAgencyLabel(results![0])}
							/>
						</Box>
					</RadioGroup>
				</FormControl>
			)}

			{/* more Results */}
			{results?.length > 1 && !onlyExternalAgencies && (
				<FormControl
					sx={{
						width: '100%',
						border: `1px solid ${registrationMd3.outlineVariant}`,
						borderRadius: '16px',
						overflow: 'hidden',
						bgcolor: registrationMd3.surface
					}}
				>
					<RadioGroup
						data-cy="agency-selection-radio-group"
						aria-label="agency-selection-radio-group"
						name="agency-selection-radio-group"
						value={selectedAgency?.id?.toString() || ''}
					>
						{results
							?.filter((agency) => !agency.external)
							.map((agency, index) => (
								<Box
									key={`agency-${agency.id}`}
									sx={{
										display: 'flex',
										justifyContent: 'space-between',
										width: '100%',
										borderTop:
											index === 0
												? 'none'
												: `1px solid ${registrationMd3.outlineVariant}`,
										backgroundColor:
											selectedAgency?.id === agency.id
												? registrationMd3.selectedLayer
												: registrationMd3.surface
									}}
								>
									<FormControlLabel
										data-cy={`agency-selection-radio-${agency.id}`}
										onClick={() => {
											setDisabledNextButton(false);
											setSelectedAgency(agency);
											onChange({ agency });
										}}
										labelPlacement="start"
										sx={{
											'alignItems': 'stretch',
											'm': 0,
											'width': '100%',
											'justifyContent': 'space-between',
											'position': 'relative',
											'&:hover': {
												backgroundColor:
													selectedAgency?.id ===
													agency.id
														? registrationMd3.selectedLayer
														: registrationMd3.hoverLayer
											},
											'& .MuiFormControlLabel-label': {
												width: '100%',
												minWidth: 0
											},
											'& .MuiRadio-root': {
												position: 'absolute',
												top: '18px',
												right: { xs: 12, sm: 16 },
												m: 0
											}
										}}
										value={agency.id.toString()}
										control={
											<Radio
												checked={
													selectedAgency?.id ===
													agency.id
												}
												sx={{
													'color':
														registrationMd3.outline,
													'&.Mui-checked': {
														color: registrationMd3.primary
													}
												}}
											/>
										}
										label={renderAgencyLabel(agency)}
									/>
								</Box>
							))}
					</RadioGroup>
				</FormControl>
			)}
		</>
	);
};
