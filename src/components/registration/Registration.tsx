import { Avatar, Box, Button, Chip, Link, Typography } from '@mui/material';
import * as React from 'react';
import {
	useState,
	useEffect,
	useContext,
	useCallback,
	useMemo,
	FormEvent
} from 'react';
import {
	Route,
	Switch,
	useHistory,
	useLocation,
	useParams,
	useRouteMatch,
	generatePath,
	Link as RouterLink
} from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet';
import { StageLayout } from '../../components/stageLayout/StageLayout';
import useIsFirstVisit from '../../utils/useIsFirstVisit';
import { WelcomeScreen } from './welcomeScreen/WelcomeScreen';
import {
	RegistrationContext,
	TenantContext,
	registrationSessionStorageKey,
	RegistrationData,
	NotificationsContext,
	NOTIFICATION_TYPE_ERROR,
	LocaleContext
} from '../../globalState';
import { GlobalComponentContext } from '../../globalState/provider/GlobalComponentContext';
import {
	redirectToApp,
	POST_REGISTRATION_LOADER_KEY
} from '../../components/registration/autoLogin';
import { PreselectionBox } from './preselectionBox/PreselectionBox';
import { endpoints } from '../../resources/scripts/endpoints';
import { apiPostRegistration } from '../../api';
import { useAppConfig } from '../../hooks/useAppConfig';
import { REGISTRATION_DATA_VALIDATION } from './registrationDataValidation';
import { UrlParamsContext } from '../../globalState/provider/UrlParamsProvider';
import { RegistrationStepper } from './registrationStepper/RegistrationStepper';
import {
	getRegistrationTopicDisplay,
	getRegistrationTopicIconForGroup,
	registrationMd3
} from './registrationDesign/registrationDesign';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import PlaceRoundedIcon from '@mui/icons-material/PlaceRounded';

/**
 * This type of registration is currently not supporting:
 * - autoSelectPostcode because its loaded over the consultingType and
 *
 * MultiTenancy:
 * Each consultingType in mongodb has stored the tenant id (One to One Relation) -> Tenant URL could load by consultingType by tenant alternative only one consultingType exits
 * MultiTenancyWithSingleDomain:
 * Each consultintType in mongodb has stored the tenant id but this relation could not be loaded because no idea which consultingType settings to load before agency is selected
 * For Caritas there is no consultingType tenant relation and every tenant could have different consultingType depending on agency. So before agency is selected no idea which consultingType settings to load before agency is selected
 * @constructor
 */

export const Registration = () => {
	const { t } = useTranslation(['common', 'consultingTypes', 'agencies']);
	const settings = useAppConfig();
	const isFirstVisit = useIsFirstVisit();
	const location = useLocation();
	const history = useHistory();
	const { path } = useRouteMatch();
	const { step, topicSlug } = useParams<{
		step: string;
		topicSlug: string;
	}>();

	const { Stage } = useContext(GlobalComponentContext);
	const { addNotification } = useContext(NotificationsContext);
	const {
		disabledNextButton,
		setDisabledNextButton,
		updateRegistrationData,
		registrationData,
		availableSteps
	} = useContext(RegistrationContext);
	const { consultant: preselectedConsultant } = useContext(UrlParamsContext);
	const { tenant } = useContext(TenantContext);
	const { locale } = useContext(LocaleContext);

	const [stepData, setStepData] = useState<Partial<RegistrationData>>({});
	const [isRegistering, setIsRegistering] = useState<boolean>(false);
	const [clearSelectionVersion, setClearSelectionVersion] =
		useState<number>(0);

	const checkForStepsWithMissingMandatoryFields =
		useCallback((): number[] => {
			return availableSteps.reduce<number[]>(
				(missingSteps, step, currentIndex) => {
					if (
						step?.mandatoryFields?.some(
							(mandatoryField) =>
								registrationData?.[mandatoryField] === undefined
						)
					) {
						return [...missingSteps, currentIndex];
					}
					return missingSteps;
				},
				[]
			);
		}, [availableSteps, registrationData]);

	const currStepIndex = useMemo(
		() => availableSteps.findIndex(({ name }) => name === step),
		[availableSteps, step]
	);

	const [prevStepUrl, nextStepUrl] = useMemo(
		() => [
			`${generatePath(path, { topicSlug, step: availableSteps[currStepIndex - 1]?.name || 'welcome' })}${location.search}`,
			availableSteps[currStepIndex + 1]
				? `${generatePath(path, { topicSlug, step: availableSteps[currStepIndex + 1]?.name || 'welcome' })}${location.search}`
				: null
		],
		[availableSteps, currStepIndex, path, topicSlug, location.search]
	);

	const mergedRegistrationData = useMemo(
		() => ({
			...registrationData,
			...stepData
		}),
		[registrationData, stepData]
	);

	const selectedTopic = mergedRegistrationData.mainTopic;
	const selectedAgency = mergedRegistrationData.agency;
	const selectedTopicLabel =
		(selectedTopic
			? getRegistrationTopicDisplay(selectedTopic, locale).title
			: null) ||
		selectedTopic?.name ||
		null;
	const selectedTopicIcon = selectedTopic
		? getRegistrationTopicIconForGroup(
				selectedTopic,
				mergedRegistrationData.topicGroupId
			)
		: undefined;
	const selectedPrefix = t('registration.selectedLabel', 'Ausgewählt');
	const noneSelectedLabel = t(
		'registration.noneSelected',
		'Bitte wählen Sie ein Thema, um fortzufahren.'
	);

	const onNextClick = useCallback(() => {
		updateRegistrationData(stepData);
		setStepData({});
		if (history && nextStepUrl) {
			history.push(nextStepUrl);
		}
	}, [updateRegistrationData, stepData, history, nextStepUrl]);

	const onPrevClick = useCallback(() => {
		if (stepData.zipcode) {
			registrationData.zipcode = '';
		}
		setStepData({});
		if (history) {
			history.push(prevStepUrl);
		}
	}, [registrationData, stepData, history, prevStepUrl]);

	const onClearSelection = useCallback(() => {
		setStepData({});
		setClearSelectionVersion((version) => version + 1);
		setDisabledNextButton?.(true);
		updateRegistrationData({
			mainTopic: undefined,
			mainTopicId: undefined,
			topic: undefined,
			topicId: undefined,
			topicGroupId: undefined,
			agency: undefined,
			agencyId: undefined
		});
		history.push(
			`${generatePath(path, {
				topicSlug,
				step: 'topic-selection'
			})}${location.search}`
		);
	}, [
		history,
		location.search,
		path,
		setDisabledNextButton,
		topicSlug,
		updateRegistrationData
	]);

	const onClearPostcodeSelection = useCallback(() => {
		setStepData({});
		setDisabledNextButton?.(true);
		updateRegistrationData({
			zipcode: undefined,
			agency: undefined,
			agencyId: undefined
		});
		history.push(
			`${generatePath(path, {
				topicSlug,
				step: 'zipcode'
			})}${location.search}`
		);
	}, [
		history,
		location.search,
		path,
		setDisabledNextButton,
		topicSlug,
		updateRegistrationData
	]);

	const footerChips = useMemo<RegistrationFooterChipItem[]>(() => {
		const chips: RegistrationFooterChipItem[] = [];

		if (selectedTopicLabel) {
			chips.push({
				key: 'topic',
				label: selectedTopicLabel,
				icon: selectedTopicIcon,
				onDelete: onClearSelection
			});
		} else if (selectedAgency?.name) {
			chips.push({
				key: 'agency',
				label: selectedAgency.name,
				onDelete: onClearSelection
			});
		}

		if (
			REGISTRATION_DATA_VALIDATION.zipcode.validation(
				mergedRegistrationData.zipcode
			)
		) {
			chips.push({
				key: 'zipcode',
				label: mergedRegistrationData.zipcode,
				iconNode: <PlaceRoundedIcon />,
				fixed: true,
				onDelete: onClearPostcodeSelection
			});
		}

		return chips;
	}, [
		mergedRegistrationData.zipcode,
		onClearPostcodeSelection,
		onClearSelection,
		selectedAgency?.name,
		selectedTopicIcon,
		selectedTopicLabel
	]);

	const handleSubmit = useCallback(
		(e: FormEvent<HTMLFormElement>) => {
			e.preventDefault();
			if (disabledNextButton) return;
			onNextClick();
		},
		[disabledNextButton, onNextClick]
	);

	useEffect(() => {
		// Check if mandatory fields from previous steps are missing
		const missingPreviousSteps = checkForStepsWithMissingMandatoryFields()
			.sort()
			.filter((missingStep) => missingStep < currStepIndex);

		if (missingPreviousSteps.length > 0) {
			history.push(
				`${generatePath(path, { topicSlug, step: availableSteps[missingPreviousSteps[0]]?.name })}${location.search}`
			);
		}
	}, [
		availableSteps,
		checkForStepsWithMissingMandatoryFields,
		history,
		location.search,
		currStepIndex,
		path,
		topicSlug
	]);

	const onRegisterClick = useCallback(() => {
		// Prevent multiple clicks
		if (isRegistering) {
			return;
		}

		const data = {
			...registrationData,
			...stepData,
			mainTopicId: registrationData.mainTopic.id.toString(),
			topicId: registrationData.topic?.id?.toString(),
			agencyId: registrationData.agency.id.toString(),
			postcode: registrationData.zipcode,
			termsAccepted: 'true',
			preferredLanguage: locale || 'de',
			consultingType: registrationData.agency.consultingType,
			...(preselectedConsultant && !preselectedConsultant.absent
				? { consultantId: preselectedConsultant?.consultantId }
				: {})
		};

		if (
			Object.keys(REGISTRATION_DATA_VALIDATION).every((item) =>
				REGISTRATION_DATA_VALIDATION[item].validation(data[item])
			)
		) {
			setIsRegistering(true);
			apiPostRegistration(
				endpoints.registerAsker,
				data,
				settings.multitenancyWithSingleDomainEnabled,
				tenant
			)
				.then(() => {
					sessionStorage.removeItem(registrationSessionStorageKey);
					// Skip the manual "registration successful" overlay: flag the app
					// to play the welcome loading animation and go straight into the
					// chat room (autoLogin already ran inside apiPostRegistration).
					sessionStorage.setItem(
						POST_REGISTRATION_LOADER_KEY,
						'true'
					);
					redirectToApp();
				})
				.catch((error) => {
					// console.error('Registration failed:', error);
					setIsRegistering(false);
					addNotification({
						notificationType: NOTIFICATION_TYPE_ERROR,
						title: t('registration.errors.ups.title'),
						text: t('registration.errors.ups.text'),
						closeable: true,
						timeout: 3000
					});
				});
		} else {
			addNotification({
				notificationType: NOTIFICATION_TYPE_ERROR,
				title: t('registration.errors.ups.title'),
				text: t('registration.errors.ups.text'),
				closeable: true,
				timeout: 3000
			});
		}
	}, [
		registrationData,
		stepData,
		preselectedConsultant,
		settings.multitenancyWithSingleDomainEnabled,
		tenant,
		addNotification,
		t,
		locale,
		isRegistering
	]);

	const stepPaths = useMemo(
		() =>
			availableSteps.reduce(
				(acc, { name }) =>
					acc.concat(generatePath(path, { topicSlug, step: name })),
				[]
			),
		[availableSteps, path, topicSlug]
	);

	return (
		<>
			<StageLayout
				className="stageLayout--registration"
				showLegalLinks={true}
				showLoginLink={true}
				stage={<Stage hasAnimation={isFirstVisit} />}
				showRegistrationInfoDrawer={true}
			>
				<Box
					sx={{
						maxWidth: '780px !important',
						width: '100%'
					}}
				>
					<Switch>
						<Route path={stepPaths}>
							<Helmet>
								<meta name="robots" content="noindex"></meta>
							</Helmet>
							<form
								onSubmit={handleSubmit}
								data-cy="registration-form"
								data-cy-step={step}
								data-cy-steps={availableSteps
									.map(({ name }) => name)
									.join(',')}
							>
								<Box
									sx={{
										marginBottom: {
											xs: '144px',
											sm: '112px'
										}
									}}
								>
									<PreselectionBox hasDrawer={false} />
									<RegistrationStepper
										currentStepName={step}
									/>

									<Box
										sx={{
											maxWidth: '780px',
											mx: 'auto'
										}}
									>
										<Switch>
											{availableSteps.map(
												({
													name,
													component: Component
												}) => (
													<Route
														path={generatePath(
															path,
															{
																topicSlug,
																step: name
															}
														)}
														key={name}
													>
														<Component
															key={`${name}-${clearSelectionVersion}`}
															onChange={
																setStepData
															}
															onNextClick={
																onNextClick
															}
															nextStepUrl={
																nextStepUrl
															}
														/>
													</Route>
												)
											)}
										</Switch>
									</Box>
								</Box>
								<Box
									sx={{
										minHeight: {
											xs: 'auto',
											sm: '96px'
										},
										position: 'fixed',
										bottom: '0',
										right: '0',
										px: {
											xs: '16px',
											md: '32px',
											lg: '0'
										},
										width: { xs: '100vw', lg: '60vw' },
										backgroundColor:
											'rgba(255, 255, 255, 0.94)',
										backdropFilter: 'blur(8px)',
										borderTop: `1px solid ${registrationMd3.outlineVariant}`,
										display: 'flex',
										justifyContent: 'center',
										alignItems: 'center',
										pt: { xs: 1.5, sm: 0 },
										pb: {
											xs: 'calc(12px + env(safe-area-inset-bottom))',
											sm: 0
										},
										zIndex: 65
									}}
								>
									<Box
										sx={{
											width: '100%',
											maxWidth: '780px',
											minWidth: 0
										}}
									>
										<Box
											sx={{
												display: {
													xs: 'none',
													sm: 'grid'
												},
												gridTemplateColumns:
													'auto minmax(0, 1fr) auto',
												alignItems: 'center',
												gap: 2
											}}
										>
											<RegistrationFooterBackLink
												to={prevStepUrl}
												onClick={onPrevClick}
												label={t('registration.back')}
											/>
											<RegistrationFooterChips
												chips={footerChips}
												selectedPrefix={selectedPrefix}
												emptyLabel={noneSelectedLabel}
											/>
											<RegistrationFooterPrimaryButton
												nextStepUrl={nextStepUrl}
												disabledNextButton={
													disabledNextButton
												}
												isRegistering={isRegistering}
												onRegisterClick={
													onRegisterClick
												}
												onNextClick={onNextClick}
												registerLabel={t(
													'registration.register'
												)}
												registeringLabel={t(
													'registration.registering',
													'Registering...'
												)}
												nextLabel={t(
													'registration.next'
												)}
											/>
										</Box>
										<Box
											sx={{
												display: {
													xs: 'block',
													sm: 'none'
												}
											}}
										>
											<RegistrationFooterChips
												chips={footerChips}
												selectedPrefix={selectedPrefix}
												emptyLabel={noneSelectedLabel}
												mobile
											/>
											<Box
												sx={{
													display: 'flex',
													alignItems: 'center',
													gap: 1.5
												}}
											>
												<RegistrationFooterBackLink
													to={prevStepUrl}
													onClick={onPrevClick}
													label={t(
														'registration.back'
													)}
												/>
												<Box sx={{ flex: 1 }} />
												<RegistrationFooterPrimaryButton
													nextStepUrl={nextStepUrl}
													disabledNextButton={
														disabledNextButton
													}
													isRegistering={
														isRegistering
													}
													onRegisterClick={
														onRegisterClick
													}
													onNextClick={onNextClick}
													registerLabel={t(
														'registration.register'
													)}
													registeringLabel={t(
														'registration.registering',
														'Registering...'
													)}
													nextLabel={t(
														'registration.next'
													)}
												/>
											</Box>
										</Box>
									</Box>
								</Box>
							</form>
						</Route>
						<Route>
							<WelcomeScreen nextStepUrl={nextStepUrl} />
						</Route>
					</Switch>
				</Box>
			</StageLayout>
		</>
	);
};

const RegistrationFooterBackLink = ({
	to,
	onClick,
	label
}: {
	to: string;
	onClick: () => void;
	label: string;
}) => (
	<Link
		sx={{
			textDecoration: 'none',
			color: registrationMd3.onSurfaceVariant,
			fontWeight: '700',
			display: 'inline-flex',
			alignItems: 'center',
			gap: '8px',
			whiteSpace: 'nowrap'
		}}
		component={RouterLink}
		onClick={onClick}
		to={to}
	>
		<ArrowBackRoundedIcon fontSize="small" />
		{label}
	</Link>
);

interface RegistrationFooterChipItem {
	key: string;
	label: string;
	icon?: string;
	iconNode?: React.ReactElement;
	fixed?: boolean;
	onDelete: () => void;
}

const RegistrationFooterChips = ({
	chips,
	selectedPrefix,
	emptyLabel,
	mobile = false
}: {
	chips: RegistrationFooterChipItem[];
	selectedPrefix: string;
	emptyLabel: string;
	mobile?: boolean;
}) => {
	if (chips.length === 0) {
		return mobile ? null : (
			<Typography
				sx={{
					fontSize: 13,
					color: registrationMd3.outline,
					textAlign: 'center'
				}}
			>
				{emptyLabel}
			</Typography>
		);
	}

	const renderChip = (chip: RegistrationFooterChipItem) => (
		<Chip
			key={chip.key}
			avatar={
				chip.icon ? (
					<Avatar alt="" sx={{ bgcolor: 'transparent' }}>
						<Box
							component="img"
							src={chip.icon}
							aria-hidden
							sx={{
								position: 'absolute',
								inset: 0,
								width: '100%',
								height: '100%',
								objectFit: 'cover',
								filter: 'blur(5px)',
								transform: 'scale(1.6)'
							}}
						/>
						<Box
							component="img"
							src={chip.icon}
							alt=""
							sx={{
								position: 'relative',
								width: '82%',
								height: '82%',
								objectFit: 'contain'
							}}
						/>
					</Avatar>
				) : undefined
			}
			icon={chip.iconNode}
			label={chip.label}
			onDelete={chip.onDelete}
			deleteIcon={<CloseRoundedIcon />}
			variant="outlined"
			aria-label={`${selectedPrefix}: ${chip.label}`}
			sx={{
				'maxWidth': '100%',
				'minWidth': chip.fixed ? 0 : 96,
				'flexShrink': chip.fixed ? 0 : 1,
				'height': '38px',
				'borderRadius': '999px',
				'bgcolor': '#fff',
				'fontWeight': 600,
				'fontSize': 14,
				'borderColor': registrationMd3.outlineVariant,
				'& .MuiChip-label': {
					overflow: 'hidden',
					textOverflow: 'ellipsis',
					whiteSpace: 'nowrap'
				},
				'& .MuiChip-avatar': {
					width: 26,
					height: 26
				},
				'& .MuiChip-icon': {
					color: registrationMd3.onSurfaceVariant,
					ml: 1,
					fontSize: 20
				},
				'& .MuiChip-deleteIcon': {
					color: registrationMd3.onSurfaceVariant,
					fontSize: 20
				}
			}}
		/>
	);

	return (
		<Box
			sx={{
				minWidth: 0,
				overflow: 'hidden',
				display: 'flex',
				flexDirection: mobile ? 'column' : 'row',
				flexWrap: mobile ? 'wrap' : 'nowrap',
				justifyContent: 'center',
				alignItems: 'center',
				textAlign: mobile ? 'center' : 'left',
				gap: mobile ? 1 : 1,
				mb: mobile ? 1.5 : 0,
				containerType: mobile ? undefined : 'inline-size'
			}}
		>
			<Typography
				sx={{
					'fontSize': mobile ? 11 : 13,
					'fontWeight': mobile ? 700 : 400,
					'letterSpacing': mobile ? 1 : 0,
					'textTransform': mobile ? 'uppercase' : 'none',
					'color': registrationMd3.onSurfaceVariant,
					'flexShrink': 0,
					'whiteSpace': 'nowrap',
					'mb': mobile ? -0.25 : 0,
					'@container (max-width: 360px)': {
						display: 'none'
					}
				}}
			>
				{selectedPrefix}
				{mobile ? '' : ':'}
			</Typography>
			<Box
				sx={{
					minWidth: 0,
					maxWidth: '100%',
					display: 'flex',
					flexWrap: mobile ? 'wrap' : 'nowrap',
					gap: 1,
					justifyContent: 'center'
				}}
			>
				{chips.map(renderChip)}
			</Box>
		</Box>
	);
};

const RegistrationFooterPrimaryButton = ({
	nextStepUrl,
	disabledNextButton,
	isRegistering,
	onRegisterClick,
	onNextClick,
	registerLabel,
	registeringLabel,
	nextLabel
}: {
	nextStepUrl: string | null;
	disabledNextButton?: boolean;
	isRegistering: boolean;
	onRegisterClick: () => void;
	onNextClick: () => void;
	registerLabel: string;
	registeringLabel: string;
	nextLabel: string;
}) => {
	const disabled = Boolean(disabledNextButton || isRegistering);
	const buttonSx = {
		'borderRadius': '999px',
		'px': 4,
		'py': 1.35,
		'fontSize': 17,
		'fontWeight': 700,
		'minWidth': { xs: 150, sm: 176 },
		'boxShadow': disabled ? 'none' : '0 6px 18px rgba(164, 38, 46, 0.30)',
		'&:hover': {
			boxShadow: disabled ? 'none' : '0 8px 22px rgba(164, 38, 46, 0.40)'
		}
	};

	return nextStepUrl ? (
		<Button
			data-cy="button-next"
			disabled={disabledNextButton}
			variant="contained"
			onClick={onNextClick}
			endIcon={<ArrowForwardRoundedIcon />}
			sx={{ width: 'unset', ...buttonSx }}
			type={disabledNextButton ? 'button' : 'submit'}
		>
			{nextLabel}
		</Button>
	) : (
		<Button
			data-cy="button-register"
			disabled={disabled}
			variant="contained"
			onClick={onRegisterClick}
			type={disabled ? 'button' : 'submit'}
			sx={buttonSx}
		>
			{isRegistering ? registeringLabel : registerLabel}
		</Button>
	);
};
