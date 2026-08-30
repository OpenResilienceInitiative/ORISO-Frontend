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
	Navigate,
	useNavigate,
	useLocation,
	useParams,
	Link as RouterLink
} from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet';
import { StageLayout } from '../../components/stageLayout/StageLayout';
import useIsFirstVisit from '../../utils/useIsFirstVisit';
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
	getPostRegistrationGroupChatId,
	POST_REGISTRATION_LOADER_KEY
} from '../../components/registration/autoLogin';
import { PreselectionBox } from './preselectionBox/PreselectionBox';
import { endpoints } from '../../resources/scripts/endpoints';
import { apiPostRegistration } from '../../api';
import { useAppConfig } from '../../hooks/useAppConfig';
import { REGISTRATION_DATA_VALIDATION } from './registrationDataValidation';
import {
	getRegistrationValidationFields,
	getConsultantDirectLinkTopicIds
} from './registrationSteps';
import { getUrlParameter } from '../../utils/getUrlParameter';
import { resolveRegistrationConsultingType } from './resolveRegistrationConsultingType';
import { UrlParamsContext } from '../../globalState/provider/UrlParamsProvider';
import { RegistrationHeader } from './registrationHeader/RegistrationHeader';
import { RegistrationStepNav } from './registrationStepNav/RegistrationStepNav';
import {
	getRegistrationTopicDisplay,
	getRegistrationTopicIconForGroup,
	registrationMd3,
	registrationMotion
} from './registrationDesign/registrationDesign';
import { clearAccountDataDraft } from './accountData/accountDataDraft';
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

const registrationMaxStepSessionStorageKey = 'registrationMaxStepReached';

export const Registration = () => {
	const { t } = useTranslation(['common', 'consultingTypes', 'agencies']);
	const settings = useAppConfig();
	const isFirstVisit = useIsFirstVisit();
	const location = useLocation();
	const navigate = useNavigate();
	const { step, topicSlug } = useParams<{
		step?: string;
		topicSlug?: string;
	}>();

	// Build an absolute step URL from the route params (replaces v5's
	// generatePath(useRouteMatch().path, …)). No/`welcome` step → the bare
	// registration path (which then redirects to the first step).
	const makeStepUrl = useCallback(
		(stepName?: string | null) => {
			const base = topicSlug
				? `/${topicSlug}/registration`
				: '/registration';
			return stepName && stepName !== 'welcome'
				? `${base}/${stepName}${location.search}`
				: `${base}${location.search}`;
		},
		[topicSlug, location.search]
	);

	const { Stage } = useContext(GlobalComponentContext);
	const { addNotification } = useContext(NotificationsContext);
	const {
		disabledNextButton,
		setDisabledNextButton,
		updateRegistrationData,
		registrationData,
		availableSteps,
		registrationConsultingType
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

	/* Highest step the user has reached so far (prototype parity): the stepper
	   is clickable back AND forth up to this step, so users can freely move
	   between steps without losing anything. Persisted per tab so a reload
	   within the registration keeps the reached range. */
	const [maxReachedStepName, setMaxReachedStepName] = useState<string | null>(
		() => {
			try {
				return sessionStorage.getItem(
					registrationMaxStepSessionStorageKey
				);
			} catch {
				return null;
			}
		}
	);

	const persistMaxReachedStepName = useCallback((name: string | null) => {
		setMaxReachedStepName(name);
		try {
			if (name) {
				sessionStorage.setItem(
					registrationMaxStepSessionStorageKey,
					name
				);
			} else {
				sessionStorage.removeItem(registrationMaxStepSessionStorageKey);
			}
		} catch {
			/* non-fatal — navigation still works, just not across reloads */
		}
	}, []);

	const maxReachedStepIndex = useMemo(() => {
		const storedIndex = availableSteps.findIndex(
			({ name }) => name === maxReachedStepName
		);
		return Math.max(storedIndex, currStepIndex);
	}, [availableSteps, maxReachedStepName, currStepIndex]);

	useEffect(() => {
		if (currStepIndex < 0) {
			return;
		}
		const storedIndex = availableSteps.findIndex(
			({ name }) => name === maxReachedStepName
		);
		if (currStepIndex > storedIndex) {
			persistMaxReachedStepName(availableSteps[currStepIndex].name);
		}
	}, [
		availableSteps,
		currStepIndex,
		maxReachedStepName,
		persistMaxReachedStepName
	]);

	// The step form renders only for a real step; bare /registration (no/unknown
	// :step) redirects to the first step — dev's stabilized entry, no separate
	// welcome screen.
	const activeStep = availableSteps[currStepIndex];

	const firstStepUrl = useMemo(
		() => makeStepUrl(availableSteps[0]?.name || 'topic-selection'),
		[availableSteps, makeStepUrl]
	);

	const [prevStepUrl, nextStepUrl] = useMemo(() => {
		const previousStepName =
			availableSteps[Math.max(currStepIndex - 1, 0)]?.name ||
			availableSteps[0]?.name ||
			'topic-selection';
		const nextStepName = availableSteps[currStepIndex + 1]?.name;
		return [
			makeStepUrl(previousStepName),
			nextStepName ? makeStepUrl(nextStepName) : null
		];
	}, [availableSteps, currStepIndex, makeStepUrl]);

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
	const footerEmptyLabel =
		step === 'topic-selection'
			? t('registration.topicInstruction', 'Wählen Sie ein Thema aus.')
			: noneSelectedLabel;

	/* Navigating between steps must never discard what was entered: merge the
	   current step's data into the registration context instead of throwing it
	   away (prototype parity — moving back and forth keeps every value). */
	const commitStepData = useCallback(() => {
		updateRegistrationData(stepData);
		setStepData({});
	}, [updateRegistrationData, stepData]);

	const onNextClick = useCallback(() => {
		commitStepData();
		if (nextStepUrl) {
			navigate(nextStepUrl);
		}
	}, [commitStepData, navigate, nextStepUrl]);

	const onPrevClick = useCallback(() => {
		commitStepData();
	}, [commitStepData]);

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
			agencyId: undefined,
			age: undefined,
			state: undefined
		});
		navigate(makeStepUrl('topic-selection'));
	}, [navigate, makeStepUrl, setDisabledNextButton, updateRegistrationData]);

	const onClearPostcodeSelection = useCallback(() => {
		setStepData({});
		setDisabledNextButton?.(true);
		updateRegistrationData({
			zipcode: undefined,
			agency: undefined,
			agencyId: undefined,
			age: undefined,
			state: undefined
		});
		navigate(makeStepUrl('zipcode'));
	}, [navigate, makeStepUrl, setDisabledNextButton, updateRegistrationData]);

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

	/** Header chips are the same picks, plus the a11y label the chip row needs. */
	const headerChips = useMemo(
		() =>
			footerChips.map((chip) => ({
				...chip,
				deleteAriaLabel: t('registration.selection.remove', {
					label: chip.label
				})
			})),
		[footerChips, t]
	);

	/* Forward navigation is additionally capped by data validity: once an
	   earlier step's mandatory value was cleared (chip ✕), later steps stop
	   being clickable until the flow is completed again. The missing step
	   itself stays clickable so it can be fixed directly. */
	const maxNavigableStepIndex = useMemo(() => {
		const firstMissingIndex = availableSteps.findIndex(
			({ mandatoryFields }, index) =>
				index < maxReachedStepIndex &&
				mandatoryFields?.some(
					(field) => mergedRegistrationData?.[field] === undefined
				)
		);
		return firstMissingIndex >= 0
			? Math.min(maxReachedStepIndex, firstMissingIndex)
			: maxReachedStepIndex;
	}, [availableSteps, maxReachedStepIndex, mergedRegistrationData]);

	/* Every step already reached is clickable — back AND forth (prototype
	   parity). The missing-mandatory-fields effect below still bounces the
	   user back if an earlier step was cleared in the meantime. */
	const clickableStepperStepNames = useMemo(
		() =>
			availableSteps
				.filter(
					(_, index) =>
						index <= maxNavigableStepIndex &&
						index !== currStepIndex
				)
				.map(({ name }) => name),
		[availableSteps, maxNavigableStepIndex, currStepIndex]
	);

	const onStepperClick = useCallback(
		(targetStepName: string) => {
			const targetStepIndex = availableSteps.findIndex(
				({ name }) => name === targetStepName
			);

			if (
				targetStepIndex < 0 ||
				targetStepIndex > maxNavigableStepIndex
			) {
				return;
			}

			commitStepData();
			navigate(makeStepUrl(targetStepName));
		},
		[
			availableSteps,
			maxNavigableStepIndex,
			commitStepData,
			navigate,
			makeStepUrl
		]
	);

	useEffect(() => {
		// Check if mandatory fields from previous steps are missing
		const missingPreviousSteps = checkForStepsWithMissingMandatoryFields()
			.sort()
			.filter((missingStep) => missingStep < currStepIndex);

		if (missingPreviousSteps.length > 0) {
			navigate(
				makeStepUrl(availableSteps[missingPreviousSteps[0]]?.name)
			);
		}
	}, [
		availableSteps,
		checkForStepsWithMissingMandatoryFields,
		navigate,
		makeStepUrl,
		currStepIndex
	]);

	useEffect(() => {
		if (
			!getUrlParameter('cid') ||
			step !== 'topic-selection' ||
			!nextStepUrl
		) {
			return;
		}

		const topicIds = getConsultantDirectLinkTopicIds(
			preselectedConsultant,
			registrationData?.agency
		);
		if (
			topicIds.length === 1 &&
			registrationData?.mainTopic?.id === topicIds[0]
		) {
			navigate(nextStepUrl, { replace: true });
		}
	}, [
		step,
		nextStepUrl,
		navigate,
		preselectedConsultant,
		registrationData?.agency,
		registrationData?.mainTopic?.id
	]);

	const onRegisterClick = useCallback(() => {
		// Prevent multiple clicks
		if (isRegistering) {
			return;
		}

		const mergedData = {
			...registrationData,
			...stepData
		};
		const selectedTopic = mergedData.topic || mergedData.mainTopic;
		const data = {
			...mergedData,
			mainTopicId: selectedTopic?.id?.toString(),
			topicId: selectedTopic?.id?.toString(),
			topicIds: selectedTopic?.id ? [selectedTopic.id] : [],
			agencyId: mergedData.agency?.id?.toString(),
			postcode: mergedData.zipcode,
			termsAccepted: 'true',
			preferredLanguage: locale,
			consultingType: resolveRegistrationConsultingType(
				mergedData.agency,
				registrationConsultingType,
				preselectedConsultant?.agencies
			),
			...(preselectedConsultant && !preselectedConsultant.absent
				? { consultantId: preselectedConsultant?.consultantId }
				: {})
		};

		if (
			getRegistrationValidationFields(availableSteps).every((item) =>
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
					sessionStorage.removeItem(
						registrationMaxStepSessionStorageKey
					);
					clearAccountDataDraft();
					// Skip the manual "registration successful" overlay: flag the app
					// to play the welcome loading animation and go straight into the
					// chat room (autoLogin already ran inside apiPostRegistration).
					sessionStorage.setItem(
						POST_REGISTRATION_LOADER_KEY,
						'true'
					);
					redirectToApp(
						getPostRegistrationGroupChatId(location.search)
					);
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
		isRegistering,
		availableSteps,
		registrationConsultingType,
		location.search
	]);

	const handleSubmit = useCallback(
		(e: FormEvent<HTMLFormElement>) => {
			e.preventDefault();
			if (disabledNextButton || isRegistering) return;

			if (nextStepUrl) {
				onNextClick();
				return;
			}

			onRegisterClick();
		},
		[
			disabledNextButton,
			isRegistering,
			nextStepUrl,
			onNextClick,
			onRegisterClick
		]
	);

	return (
		<>
			<StageLayout
				className="stageLayout--registration"
				showLegalLinks={true}
				showLoginLink={true}
				stage={<Stage hasAnimation={isFirstVisit} />}
				showRegistrationInfoDrawer={true}
				mobileHero="bar"
			>
				<Box
					sx={{
						// Top of the chain: `.stageLayout__content` is already a
						// flex column filling the viewport, so the growth starts
						// being passed on here.
						flex: 1,
						minHeight: 0,
						display: 'flex',
						flexDirection: 'column',
						boxSizing: 'border-box',
						width: '100%',
						maxWidth: '100%'
					}}
				>
					{activeStep ? (
						<>
							<Helmet>
								<meta name="robots" content="noindex"></meta>
							</Helmet>
							<form
								onSubmit={handleSubmit}
								// Part of the same chain: a plain block form
								// would swallow the growth again.
								style={{
									flex: 1,
									minHeight: 0,
									display: 'flex',
									flexDirection: 'column'
								}}
								data-cy="registration-form"
								data-cy-step={step}
								data-cy-steps={availableSteps
									.map(({ name }) => name)
									.join(',')}
							>
								<Box
									sx={{
										// The stage column is a flex column that
										// fills the viewport, but every box below
										// it defaulted to `flex: 0 1 auto`, so the
										// step body stopped at its own height and
										// the leftover space was dead. Passing the
										// growth down lets a step centre itself in
										// what is actually left (see the postcode
										// step) without anyone computing a height.
										flex: 1,
										minHeight: 0,
										display: 'flex',
										flexDirection: 'column',
										marginBottom: {
											xs: '144px',
											sm: '112px'
										}
									}}
								>
									<PreselectionBox hasDrawer={false} />
									<RegistrationHeader
										currentStepName={step}
										visibleStepNames={availableSteps.map(
											({ name }) => name
										)}
										clickableStepNames={
											clickableStepperStepNames
										}
										onStepClick={onStepperClick}
										chips={headerChips}
										fullBleed
									/>

									<Box
										sx={{
											'flex': 1,
											'minHeight': 0,
											'display': 'flex',
											'flexDirection': 'column',
											'width': '100%',
											'maxWidth': '780px',
											'mx': 'auto',
											'px': { xs: 2, sm: 3, lg: 4 },
											// The band above is opaque and sits
											// flush; without this the first line of
											// every step starts hard against its
											// lower edge.
											'pt': 1.5,
											'& > *': { minHeight: 0 }
										}}
									>
										{(() => {
											const StepComponent =
												activeStep.component;
											return (
												<StepComponent
													key={`${activeStep.name}-${clearSelectionVersion}`}
													onChange={setStepData}
													onNextClick={onNextClick}
													nextStepUrl={nextStepUrl}
												/>
											);
										})()}
									</Box>
								</Box>
								<Box
									sx={{
										'minHeight': {
											xs: 'auto',
											sm: '96px'
										},
										'position': 'fixed',
										'bottom': '0',
										'right': '0',
										'width': { xs: '100vw', lg: '60vw' },
										'backgroundColor':
											'rgba(255, 255, 255, 0.94)',
										'backdropFilter': 'blur(8px)',
										'borderTop': `1px solid ${registrationMd3.outlineVariant}`,
										'display': 'flex',
										'justifyContent': 'center',
										'alignItems': 'center',
										'pt': { xs: 1.5, sm: 0 },
										'pb': {
											xs: 'calc(12px + env(safe-area-inset-bottom))',
											sm: 0
										},
										'px': { xs: 2, sm: 3, lg: 4 },
										'zIndex': 65,
										'animation': `registrationFooterEnter ${registrationMotion.slow} ${registrationMotion.easeOut} both`,
										'@keyframes registrationFooterEnter': {
											'0%': {
												opacity: 0,
												transform: 'translateY(18px)'
											},
											'100%': {
												opacity: 1,
												transform: 'translateY(0)'
											}
										},
										'@media (prefers-reduced-motion: reduce)':
											{
												animation: 'none'
											}
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
												columnGap: { sm: 2.5, md: 3 },
												rowGap: 1
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
												emptyLabel={footerEmptyLabel}
											/>
											<RegistrationFooterPrimaryButton
												nextStepUrl={nextStepUrl}
												disabledNextButton={
													disabledNextButton
												}
												isRegistering={isRegistering}
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
											{/* F3: the picks live in the
											    header chip row on mobile, so
											    the footer is navigation only. */}
											<RegistrationStepNav
												prevStepUrl={
													currStepIndex === 0
														? null
														: prevStepUrl
												}
												onPrevClick={onPrevClick}
												backLabel={t(
													'registration.back'
												)}
												nextStepUrl={nextStepUrl}
												nextLabel={t(
													'registration.next'
												)}
												registerLabel={t(
													'registration.register'
												)}
												registeringLabel={t(
													'registration.registering',
													'Registering...'
												)}
												disabledNext={
													disabledNextButton
												}
												isRegistering={isRegistering}
											/>
										</Box>
									</Box>
								</Box>
							</form>
						</>
					) : (
						<Navigate to={firstStepUrl} replace />
					)}
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
			'textDecoration': 'none',
			'color': registrationMd3.onSurfaceVariant,
			'fontWeight': '700',
			'display': 'inline-flex',
			'alignItems': 'center',
			'gap': '8px',
			'whiteSpace': 'nowrap',
			'px': { xs: 0.5, sm: 1, md: 1.25 },
			'py': { xs: 0.75, sm: 1 },
			'mx': { xs: -0.5, sm: 0 },
			'borderRadius': '999px',
			'&:hover': {
				backgroundColor: registrationMd3.hoverLayer
			},
			'&:focus-visible': {
				outline: `2px solid ${registrationMd3.focus}`,
				outlineOffset: 2
			}
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
		return (
			<Typography
				data-cy="registration-footer-empty-selection"
				sx={{
					fontSize: mobile ? 13 : 13,
					fontWeight: mobile ? 600 : 400,
					color: registrationMd3.outline,
					textAlign: 'center',
					lineHeight: 1.4,
					px: mobile ? 1 : 0,
					mb: mobile ? 1.25 : 0
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
	registerLabel,
	registeringLabel,
	nextLabel
}: {
	nextStepUrl: string | null;
	disabledNextButton?: boolean;
	isRegistering: boolean;
	registerLabel: string;
	registeringLabel: string;
	nextLabel: string;
}) => {
	const disabled = Boolean(disabledNextButton || isRegistering);
	const buttonSx = {
		'borderRadius': '999px',
		'px': { xs: 3, sm: 4.5, md: 5 },
		'py': 1.35,
		'fontSize': 17,
		'fontWeight': 700,
		'minWidth': { xs: 150, sm: 188, md: 196 },
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
			type={disabled ? 'button' : 'submit'}
			sx={buttonSx}
		>
			{isRegistering ? registeringLabel : registerLabel}
		</Button>
	);
};
