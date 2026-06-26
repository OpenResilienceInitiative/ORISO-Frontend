import { Link, Button, Box, Chip, Stack, Avatar } from '@mui/material';
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
	getRegistrationTopicIcon,
	registrationMd3
} from './registrationDesign/registrationDesign';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';

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
		updateRegistrationData,
		registrationData,
		availableSteps
	} = useContext(RegistrationContext);
	const { consultant: preselectedConsultant } = useContext(UrlParamsContext);
	const { tenant } = useContext(TenantContext);
	const { locale } = useContext(LocaleContext);

	const [stepData, setStepData] = useState<Partial<RegistrationData>>({});
	const [isRegistering, setIsRegistering] = useState<boolean>(false);

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
	const selectedLabel =
		(selectedTopic
			? getRegistrationTopicDisplay(selectedTopic, locale).title
			: null) ||
		selectedTopic?.name ||
		selectedAgency?.name ||
		null;
	const selectedIcon = selectedTopic
		? getRegistrationTopicIcon(selectedTopic)
		: undefined;

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
								<Box sx={{ marginBottom: '112px' }}>
									<PreselectionBox hasDrawer={false} />
									<RegistrationStepper
										currentStepName={step}
									/>

									<Box
										sx={{
											maxWidth: '780px',
											mr: 'auto'
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
										minHeight: '96px',
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
										zIndex: 65
									}}
								>
									<Stack
										direction="row"
										spacing={{ xs: 1.5, md: 2 }}
										alignItems="center"
										justifyContent="space-between"
										sx={{
											width: '100%',
											maxWidth: '780px',
											minWidth: 0
										}}
									>
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
											onClick={onPrevClick}
											to={prevStepUrl}
										>
											<ArrowBackRoundedIcon fontSize="small" />
											{t('registration.back')}
										</Link>
										<Box
											sx={{
												display: {
													xs: 'none',
													sm: 'flex'
												},
												justifyContent: 'center',
												minWidth: 0,
												flex: 1
											}}
										>
											{selectedLabel ? (
												<Chip
													avatar={
														selectedIcon ? (
															<Avatar
																src={
																	selectedIcon
																}
																alt=""
															/>
														) : undefined
													}
													label={selectedLabel}
													variant="outlined"
													sx={{
														'maxWidth': '100%',
														'height': '42px',
														'borderRadius': '999px',
														'bgcolor': '#fff',
														'fontWeight': 700,
														'borderColor':
															registrationMd3.outlineVariant,
														'& .MuiChip-label': {
															overflow: 'hidden',
															textOverflow:
																'ellipsis',
															whiteSpace: 'nowrap'
														},
														'& .MuiChip-avatar': {
															width: 28,
															height: 28
														}
													}}
												/>
											) : null}
										</Box>

										{!nextStepUrl ? (
											<Button
												data-cy="button-register"
												disabled={
													disabledNextButton ||
													isRegistering
												}
												variant="contained"
												onClick={onRegisterClick}
												type={
													disabledNextButton ||
													isRegistering
														? 'button'
														: 'submit'
												}
												sx={{
													borderRadius: '999px',
													px: { xs: 3, md: 4 },
													py: 1.25,
													fontWeight: 800,
													minWidth: {
														xs: 150,
														md: 176
													},
													boxShadow:
														disabledNextButton ||
														isRegistering
															? 'none'
															: '0 6px 18px rgba(164, 38, 46, 0.30)'
												}}
											>
												{isRegistering
													? t(
															'registration.registering',
															'Registering...'
														)
													: t(
															'registration.register'
														)}
											</Button>
										) : (
											<Button
												data-cy="button-next"
												disabled={disabledNextButton}
												variant="contained"
												onClick={onNextClick}
												endIcon={
													<ArrowForwardRoundedIcon />
												}
												sx={{
													width: 'unset',
													borderRadius: '999px',
													px: { xs: 3, md: 4 },
													py: 1.25,
													fontWeight: 800,
													minWidth: {
														xs: 150,
														md: 176
													},
													boxShadow:
														disabledNextButton
															? 'none'
															: '0 6px 18px rgba(164, 38, 46, 0.30)'
												}}
												type={
													disabledNextButton
														? 'button'
														: 'submit'
												}
											>
												{t('registration.next')}
											</Button>
										)}
									</Stack>
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
