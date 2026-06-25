import * as React from 'react';
import {
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState
} from 'react';
import { encode } from 'hi-base32';
import {
	Box,
	Button,
	Dialog,
	Fade,
	IconButton,
	Link,
	TextField,
	Tooltip,
	Typography
} from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import SmartphoneRoundedIcon from '@mui/icons-material/SmartphoneRounded';
import {
	apiPatchTwoFactorAuthEncourage,
	apiPostTwoFactorAuthEmailWithCode,
	apiPutTwoFactorAuthApp,
	apiPutTwoFactorAuthEmail,
	FETCH_ERRORS
} from '../../api';
import { ModalContext } from '../../globalState/context/ModalContext';
import { OVERLAY_TWO_FACTOR_SETUP } from '../../globalState/interfaces/AppConfig/OverlaysConfigInterface';
import { isStringValidEmail } from '../registration/registrationHelpers';
import {
	getNextSetupStep,
	getPreviousSetupStep,
	getSetupSteps,
	getStepIndex,
	isOtpValid,
	normalizeOtp,
	TwoFactorSetupMethod,
	TwoFactorSetupStep
} from './twoFactorSetupFlow';
import {
	OTP_LENGTH,
	TWO_FACTOR_TYPES,
	TwoFactorType
} from './twoFactorAuthConstants';
import { useTranslation } from 'react-i18next';
import { ReactComponent as AppGraphic } from '../../resources/img/icons/two-factor/otp_app_graphic.svg';
import { ReactComponent as EmailGraphic } from '../../resources/img/icons/two-factor/email_code_graphic.svg';
import { ReactComponent as DecisionIcon } from '../../resources/img/icons/two-factor/decision_400.svg';
import { ReactComponent as DecisionFilledIcon } from '../../resources/img/icons/two-factor/decision_filled.svg';
import { ReactComponent as InstallIcon } from '../../resources/img/icons/two-factor/install_400.svg';
import { ReactComponent as InstallFilledIcon } from '../../resources/img/icons/two-factor/install_filled.svg';
import { ReactComponent as SelectIcon } from '../../resources/img/icons/two-factor/select_account_400.svg';
import { ReactComponent as SelectFilledIcon } from '../../resources/img/icons/two-factor/select_account_filled.svg';
import { ReactComponent as ConnectIcon } from '../../resources/img/icons/two-factor/connect_400.svg';
import { ReactComponent as ConnectFilledIcon } from '../../resources/img/icons/two-factor/connect_filled.svg';
import { ReactComponent as VerificationIcon } from '../../resources/img/icons/two-factor/verification_400.svg';
import { ReactComponent as VerificationFilledIcon } from '../../resources/img/icons/two-factor/verification_filled.svg';
import { ReactComponent as ConfirmIcon } from '../../resources/img/icons/two-factor/confirm_400.svg';
import { ReactComponent as ConfirmFilledIcon } from '../../resources/img/icons/two-factor/confirm_filled.svg';
import './twoFactorSetupDialog.styles.scss';

type IconComponent = React.FunctionComponent<
	React.SVGProps<SVGSVGElement> & { title?: string }
>;

interface StepIconPair {
	default: IconComponent;
	filled: IconComponent;
}

const STEP_ICONS: Record<string, StepIconPair> = {
	decision: { default: DecisionIcon, filled: DecisionFilledIcon },
	install: { default: InstallIcon, filled: InstallFilledIcon },
	select: { default: SelectIcon, filled: SelectFilledIcon },
	connect: { default: ConnectIcon, filled: ConnectFilledIcon },
	verify: { default: VerificationIcon, filled: VerificationFilledIcon },
	confirm: { default: ConfirmIcon, filled: ConfirmFilledIcon }
};

const APP_DOWNLOADS = [
	{
		titleKey: 'twoFactorAuth.setupDialog.app.install.google.title',
		androidKey: 'twoFactorAuth.setupDialog.app.install.google.android',
		iosKey: 'twoFactorAuth.setupDialog.app.install.google.ios'
	},
	{
		titleKey: 'twoFactorAuth.setupDialog.app.install.microsoft.title',
		androidKey: 'twoFactorAuth.setupDialog.app.install.microsoft.android',
		iosKey: 'twoFactorAuth.setupDialog.app.install.microsoft.ios'
	}
];

interface TwoFactorSetupDialogProps {
	open: boolean;
	canClose: boolean;
	canDisable: boolean;
	currentType?: TwoFactorType;
	email?: string;
	qrCode?: string;
	secret?: string;
	onClose: () => void;
	onDisable: () => Promise<void> | void;
	onSetupComplete: () => Promise<void> | void;
}

interface StepperProps {
	activeStep: TwoFactorSetupStep;
	selectedMethod: TwoFactorType;
}

const FlowStepper = ({ activeStep, selectedMethod }: StepperProps) => {
	const { t: translate } = useTranslation();
	const steps = getSetupSteps(activeStep, selectedMethod);
	const activeIndex = getStepIndex(activeStep, selectedMethod);

	return (
		<div className="twoFactorSetupDialog__stepper" aria-hidden="true">
			{steps.map((step, index) => {
				const isActive = index === activeIndex;
				const isDone = index < activeIndex;
				const StepIcon =
					isActive || isDone
						? STEP_ICONS[step.icon].filled
						: STEP_ICONS[step.icon].default;

				return (
					<div
						className="twoFactorSetupDialog__stepUnit"
						key={step.key}
					>
						<div
							className={[
								'twoFactorSetupDialog__stepCircle',
								isActive &&
									'twoFactorSetupDialog__stepCircle--active',
								isDone &&
									'twoFactorSetupDialog__stepCircle--done'
							]
								.filter(Boolean)
								.join(' ')}
						>
							<StepIcon />
						</div>
						<Typography
							className={[
								'twoFactorSetupDialog__stepLabel',
								(isActive || isDone) &&
									'twoFactorSetupDialog__stepLabel--active'
							]
								.filter(Boolean)
								.join(' ')}
							variant="subtitle2"
						>
							{translate(step.labelKey)}
						</Typography>
					</div>
				);
			})}
		</div>
	);
};

export const TwoFactorSetupDialog: React.FC<TwoFactorSetupDialogProps> = ({
	open,
	canClose,
	canDisable,
	currentType = TWO_FACTOR_TYPES.NONE,
	email: initialEmail = '',
	qrCode,
	secret,
	onClose,
	onDisable,
	onSetupComplete
}) => {
	const { t: translate } = useTranslation();
	const { overlays, addOverlay, removeOverlay } = useContext(ModalContext);
	const modalId = useRef(
		`two-factor-setup-${Date.now()}-${Math.random().toString(16).slice(2)}`
	);
	const wasOpenRef = useRef(false);
	const [step, setStep] = useState<TwoFactorSetupStep>('decision');
	const [selectedMethod, setSelectedMethod] = useState<TwoFactorType>(
		currentType === TWO_FACTOR_TYPES.EMAIL
			? TWO_FACTOR_TYPES.EMAIL
			: TWO_FACTOR_TYPES.APP
	);
	const [otp, setOtp] = useState('');
	const [email, setEmail] = useState(initialEmail);
	const [errorKey, setErrorKey] = useState('');
	const [helperKey, setHelperKey] = useState('');
	const [isRequestInProgress, setIsRequestInProgress] = useState(false);
	const [isSecretCopied, setIsSecretCopied] = useState(false);

	const isTopOverlay =
		overlays.findIndex((overlay) => overlay.id === modalId.current) === 0;
	const isAppFlow = selectedMethod === TWO_FACTOR_TYPES.APP;
	const isSuccess = step === 'app-success' || step === 'email-success';
	const activeGraphic = isAppFlow ? AppGraphic : EmailGraphic;
	const ActiveGraphic =
		step === 'decision' ? DecisionFilledIcon : activeGraphic;
	const encodedSecret = useMemo(
		() => (secret ? encode(secret).replace(/={1,8}$/, '') : ''),
		[secret]
	);

	useEffect(() => {
		if (!open) {
			return undefined;
		}

		const currentModalId = modalId.current;

		addOverlay({
			id: currentModalId,
			name: OVERLAY_TWO_FACTOR_SETUP
		});

		return () => {
			removeOverlay(currentModalId);
		};
	}, [addOverlay, open, removeOverlay]);

	useEffect(() => {
		if (!open || !isTopOverlay) {
			return undefined;
		}

		document.querySelector('.app')?.classList.add('app--blur');

		return () => {
			document.querySelector('.app')?.classList.remove('app--blur');
		};
	}, [isTopOverlay, open]);

	useEffect(() => {
		if (!open) {
			wasOpenRef.current = false;
			return;
		}

		if (wasOpenRef.current) {
			return;
		}

		wasOpenRef.current = true;
		setStep('decision');
		setSelectedMethod(
			currentType === TWO_FACTOR_TYPES.EMAIL
				? TWO_FACTOR_TYPES.EMAIL
				: TWO_FACTOR_TYPES.APP
		);
		setOtp('');
		setEmail(initialEmail || '');
		setErrorKey('');
		setHelperKey('');
		setIsRequestInProgress(false);
		setIsSecretCopied(false);
	}, [currentType, initialEmail, open]);

	const setFetchError = useCallback((error: Error, fallbackKey: string) => {
		if (error.message === FETCH_ERRORS.BAD_REQUEST) {
			setErrorKey('twoFactorAuth.setupDialog.error.invalidCode');
		} else if (error.message === FETCH_ERRORS.PRECONDITION_FAILED) {
			setErrorKey('twoFactorAuth.setupDialog.error.precondition');
		} else if (error.message === FETCH_ERRORS.CONFLICT) {
			setErrorKey('twoFactorAuth.setupDialog.error.roleDisabled');
		} else if (error.message === FETCH_ERRORS.TOO_MANY_REQUESTS) {
			setErrorKey('twoFactorAuth.setupDialog.error.tooManyRequests');
		} else {
			setErrorKey(fallbackKey);
		}
	}, []);

	const closeDialog = useCallback(() => {
		if (!canClose || isRequestInProgress) {
			return;
		}

		onClose();
	}, [canClose, isRequestInProgress, onClose]);

	const chooseMethod = useCallback((method: TwoFactorSetupMethod) => {
		setSelectedMethod(method);
		setErrorKey('');
		setHelperKey('');
		setStep(getNextSetupStep('decision', method));
	}, []);

	const goBack = useCallback(() => {
		if (isRequestInProgress) {
			return;
		}

		setErrorKey('');
		setHelperKey('');
		setStep((currentStep) => getPreviousSetupStep(currentStep));
	}, [isRequestInProgress]);

	const finishSetup = useCallback(
		async (nextStep: TwoFactorSetupStep) => {
			await apiPatchTwoFactorAuthEncourage(false);
			await onSetupComplete();
			setStep(nextStep);
			setOtp('');
			setErrorKey('');
			setHelperKey('');
		},
		[onSetupComplete]
	);

	const sendEmailActivationCode = useCallback(
		async (nextStep?: TwoFactorSetupStep) => {
			if (!isStringValidEmail(email)) {
				setErrorKey('twoFactorAuth.setupDialog.error.invalidEmail');
				return;
			}

			setIsRequestInProgress(true);
			setErrorKey('');
			setHelperKey('');

			try {
				await apiPutTwoFactorAuthEmail(email);
				setHelperKey('twoFactorAuth.setupDialog.email.connect.sent');
				if (nextStep) {
					setStep(nextStep);
				}
			} catch (error) {
				setFetchError(
					error as Error,
					'twoFactorAuth.setupDialog.error.emailSend'
				);
			} finally {
				setIsRequestInProgress(false);
			}
		},
		[email, setFetchError]
	);

	const activateApp = useCallback(async () => {
		if (!secret || !isOtpValid(otp)) {
			setErrorKey('twoFactorAuth.setupDialog.error.invalidCode');
			return;
		}

		setIsRequestInProgress(true);
		setErrorKey('');

		try {
			await apiPutTwoFactorAuthApp({ secret, otp });
			await finishSetup('app-success');
		} catch (error) {
			setFetchError(
				error as Error,
				'twoFactorAuth.setupDialog.error.appSetup'
			);
		} finally {
			setIsRequestInProgress(false);
		}
	}, [finishSetup, otp, secret, setFetchError]);

	const activateEmail = useCallback(async () => {
		if (!isOtpValid(otp)) {
			setErrorKey('twoFactorAuth.setupDialog.error.invalidCode');
			return;
		}

		setIsRequestInProgress(true);
		setErrorKey('');

		try {
			await apiPostTwoFactorAuthEmailWithCode(otp);
			await finishSetup('email-success');
		} catch (error) {
			setFetchError(
				error as Error,
				'twoFactorAuth.setupDialog.error.emailSetup'
			);
		} finally {
			setIsRequestInProgress(false);
		}
	}, [finishSetup, otp, setFetchError]);

	const handlePrimaryAction = useCallback(() => {
		const nextStep = getNextSetupStep(
			step,
			selectedMethod as TwoFactorSetupMethod
		);

		if (step === 'email-select') {
			void sendEmailActivationCode(nextStep);
		} else if (step === 'app-verify') {
			void activateApp();
		} else if (step === 'email-connect') {
			void activateEmail();
		} else if (isSuccess) {
			onClose();
		} else {
			setErrorKey('');
			setHelperKey('');
			setStep(nextStep);
		}
	}, [
		activateApp,
		activateEmail,
		isSuccess,
		onClose,
		selectedMethod,
		sendEmailActivationCode,
		step
	]);

	const handleDisable = useCallback(async () => {
		setIsRequestInProgress(true);
		setErrorKey('');

		try {
			await onDisable();
		} catch (error) {
			setErrorKey('twoFactorAuth.setupDialog.error.disable');
		} finally {
			setIsRequestInProgress(false);
		}
	}, [onDisable]);

	const handleOtpChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		setOtp(normalizeOtp(event.target.value));
		setErrorKey('');
	};

	const handleEmailChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		setEmail(event.target.value.trim());
		setErrorKey('');
	};

	const copySecret = useCallback(async () => {
		if (!encodedSecret || !navigator.clipboard) {
			return;
		}

		await navigator.clipboard.writeText(encodedSecret);
		setIsSecretCopied(true);
	}, [encodedSecret]);

	const isPrimaryDisabled =
		isRequestInProgress ||
		(step === 'email-select' && !isStringValidEmail(email)) ||
		((step === 'app-verify' || step === 'email-connect') &&
			!isOtpValid(otp));

	const primaryLabelKey =
		step === 'app-verify' || step === 'email-connect'
			? 'twoFactorAuth.setupDialog.action.confirm'
			: isSuccess
				? 'twoFactorAuth.setupDialog.action.close'
				: 'twoFactorAuth.setupDialog.action.next';

	const renderDecision = () => (
		<div className="twoFactorSetupDialog__decision">
			<Typography className="twoFactorSetupDialog__copy">
				{translate('twoFactorAuth.setupDialog.decision.copy')}
			</Typography>
			<Button
				className="twoFactorSetupDialog__choiceButton"
				disabled={
					isRequestInProgress || currentType === TWO_FACTOR_TYPES.APP
				}
				onClick={() => chooseMethod(TWO_FACTOR_TYPES.APP)}
				startIcon={<SmartphoneRoundedIcon />}
				variant="contained"
			>
				{translate('twoFactorAuth.setupDialog.decision.app')}
			</Button>
			<Button
				className="twoFactorSetupDialog__choiceButton twoFactorSetupDialog__choiceButton--secondary"
				disabled={
					isRequestInProgress ||
					currentType === TWO_FACTOR_TYPES.EMAIL
				}
				onClick={() => chooseMethod(TWO_FACTOR_TYPES.EMAIL)}
				startIcon={<EmailOutlinedIcon />}
				variant="contained"
			>
				{translate('twoFactorAuth.setupDialog.decision.email')}
			</Button>
			{canDisable && (
				<Button
					className="twoFactorSetupDialog__choiceButton twoFactorSetupDialog__choiceButton--outline"
					disabled={isRequestInProgress}
					onClick={() => void handleDisable()}
					variant="outlined"
				>
					{translate('twoFactorAuth.setupDialog.action.disable')}
				</Button>
			)}
			{canClose && (
				<Button
					className="twoFactorSetupDialog__choiceButton twoFactorSetupDialog__choiceButton--muted"
					disabled={isRequestInProgress}
					onClick={closeDialog}
					startIcon={<CloseRoundedIcon />}
					variant="contained"
				>
					{translate('twoFactorAuth.setupDialog.action.close')}
				</Button>
			)}
		</div>
	);

	const renderInstall = () => (
		<div className="twoFactorSetupDialog__install">
			<Typography className="twoFactorSetupDialog__copy">
				{translate('twoFactorAuth.setupDialog.app.install.copy')}
			</Typography>
			<div className="twoFactorSetupDialog__downloadGrid">
				{APP_DOWNLOADS.map((app) => (
					<div
						className="twoFactorSetupDialog__downloadCard"
						key={app.titleKey}
					>
						<Typography className="twoFactorSetupDialog__downloadTitle">
							{translate(app.titleKey)}
						</Typography>
						<Link
							href={translate(app.androidKey)}
							target="_blank"
							rel="noreferrer"
						>
							<DownloadRoundedIcon fontSize="small" />
							{translate(
								'twoFactorAuth.setupDialog.app.install.android'
							)}
						</Link>
						<Link
							href={translate(app.iosKey)}
							target="_blank"
							rel="noreferrer"
						>
							<DownloadRoundedIcon fontSize="small" />
							{translate(
								'twoFactorAuth.setupDialog.app.install.ios'
							)}
						</Link>
					</div>
				))}
			</div>
		</div>
	);

	const renderAppConnect = () => (
		<div className="twoFactorSetupDialog__connect">
			<Typography className="twoFactorSetupDialog__copy">
				{translate('twoFactorAuth.setupDialog.app.connect.copy')}
			</Typography>
			<div className="twoFactorSetupDialog__qrSection">
				{qrCode ? (
					<img
						alt={translate(
							'twoFactorAuth.setupDialog.app.connect.qrAlt'
						)}
						className="twoFactorSetupDialog__qr"
						src={`data:image/png;base64,${qrCode}`}
					/>
				) : (
					<Typography className="twoFactorSetupDialog__fallback">
						{translate(
							'twoFactorAuth.setupDialog.app.connect.missingQr'
						)}
					</Typography>
				)}
				<Typography className="twoFactorSetupDialog__divider">
					{translate('twoFactorAuth.setupDialog.app.connect.or')}
				</Typography>
				<div className="twoFactorSetupDialog__manualKey">
					<Typography className="twoFactorSetupDialog__manualLabel">
						{translate(
							'twoFactorAuth.setupDialog.app.connect.manual'
						)}
					</Typography>
					<div className="twoFactorSetupDialog__secretRow">
						<Typography className="twoFactorSetupDialog__secret">
							{encodedSecret ||
								translate(
									'twoFactorAuth.setupDialog.app.connect.missingSecret'
								)}
						</Typography>
						<Tooltip
							title={translate(
								isSecretCopied
									? 'twoFactorAuth.setupDialog.action.copied'
									: 'twoFactorAuth.setupDialog.action.copy'
							)}
						>
							<span>
								<IconButton
									aria-label={translate(
										'twoFactorAuth.setupDialog.action.copy'
									)}
									disabled={!encodedSecret}
									onClick={() => void copySecret()}
									size="small"
								>
									<ContentCopyRoundedIcon fontSize="small" />
								</IconButton>
							</span>
						</Tooltip>
					</div>
				</div>
			</div>
		</div>
	);

	const renderOtpInput = (labelKey: string) => (
		<TextField
			autoFocus
			className="twoFactorSetupDialog__input"
			error={Boolean(errorKey)}
			fullWidth
			inputProps={{
				inputMode: 'numeric',
				maxLength: OTP_LENGTH,
				pattern: '[0-9]*'
			}}
			label={translate(labelKey)}
			onChange={handleOtpChange}
			value={otp}
		/>
	);

	const renderEmailSelect = () => (
		<div className="twoFactorSetupDialog__emailSelect">
			<Typography className="twoFactorSetupDialog__copy">
				{translate('twoFactorAuth.setupDialog.email.select.copy')}
			</Typography>
			<TextField
				autoFocus
				className="twoFactorSetupDialog__input"
				error={
					Boolean(errorKey) ||
					(email.length > 0 && !isStringValidEmail(email))
				}
				fullWidth
				label={translate(
					'twoFactorAuth.setupDialog.email.select.input'
				)}
				onChange={handleEmailChange}
				type="email"
				value={email}
			/>
			<Typography className="twoFactorSetupDialog__hint">
				{translate('twoFactorAuth.setupDialog.email.select.hint')}
			</Typography>
		</div>
	);

	const renderEmailConnect = () => (
		<div className="twoFactorSetupDialog__emailCode">
			<Typography className="twoFactorSetupDialog__copy">
				{translate('twoFactorAuth.setupDialog.email.connect.copy', {
					email
				})}
			</Typography>
			{renderOtpInput('twoFactorAuth.setupDialog.email.connect.input')}
			<div className="twoFactorSetupDialog__resend">
				<Typography className="twoFactorSetupDialog__resendTitle">
					{translate(
						'twoFactorAuth.setupDialog.email.connect.resendTitle'
					)}
				</Typography>
				<Button
					className="twoFactorSetupDialog__textButton"
					disabled={isRequestInProgress}
					onClick={() => void sendEmailActivationCode()}
					variant="text"
				>
					{translate(
						'twoFactorAuth.setupDialog.email.connect.resend'
					)}
				</Button>
			</div>
		</div>
	);

	const renderSuccess = () => (
		<div className="twoFactorSetupDialog__success">
			<CheckCircleRoundedIcon className="twoFactorSetupDialog__successIcon" />
			<Typography className="twoFactorSetupDialog__successTitle">
				{translate(
					isAppFlow
						? 'twoFactorAuth.setupDialog.app.success.title'
						: 'twoFactorAuth.setupDialog.email.success.title'
				)}
			</Typography>
		</div>
	);

	const renderStep = () => {
		switch (step) {
			case 'decision':
				return renderDecision();
			case 'app-install':
				return renderInstall();
			case 'app-connect':
				return renderAppConnect();
			case 'app-verify':
				return (
					<>
						<Typography className="twoFactorSetupDialog__copy">
							{translate(
								'twoFactorAuth.setupDialog.app.verify.copy'
							)}
						</Typography>
						{renderOtpInput(
							'twoFactorAuth.setupDialog.app.verify.input'
						)}
					</>
				);
			case 'email-select':
				return renderEmailSelect();
			case 'email-connect':
				return renderEmailConnect();
			case 'app-success':
			case 'email-success':
				return renderSuccess();
			default:
				return null;
		}
	};

	if (!open || !isTopOverlay) {
		return null;
	}

	return (
		<Dialog
			BackdropProps={{
				className: 'twoFactorSetupDialog__backdrop'
			}}
			TransitionComponent={Fade}
			TransitionProps={{ timeout: 180 }}
			aria-describedby="two-factor-setup-description"
			aria-labelledby="two-factor-setup-title"
			className="twoFactorSetupDialog"
			disableEscapeKeyDown={!canClose}
			fullWidth
			maxWidth="sm"
			onClose={(_, reason) => {
				if (reason === 'escapeKeyDown' || reason === 'backdropClick') {
					closeDialog();
				}
			}}
			open={open}
			PaperProps={{
				className: 'twoFactorSetupDialog__paper'
			}}
		>
			{canClose && !isSuccess && (
				<Tooltip
					title={translate('twoFactorAuth.setupDialog.action.close')}
				>
					<IconButton
						aria-label={translate(
							'twoFactorAuth.setupDialog.action.close'
						)}
						className="twoFactorSetupDialog__close"
						disabled={isRequestInProgress}
						onClick={closeDialog}
					>
						<CloseRoundedIcon />
					</IconButton>
				</Tooltip>
			)}
			<Box className="twoFactorSetupDialog__header">
				<ActiveGraphic
					aria-hidden="true"
					className="twoFactorSetupDialog__graphic"
				/>
				<Typography
					className="twoFactorSetupDialog__title"
					id="two-factor-setup-title"
					variant="h2"
				>
					{translate('twoFactorAuth.setupDialog.title')}
				</Typography>
			</Box>
			<FlowStepper activeStep={step} selectedMethod={selectedMethod} />
			<Box
				className="twoFactorSetupDialog__body"
				id="two-factor-setup-description"
			>
				{renderStep()}
				{errorKey && (
					<Typography
						className="twoFactorSetupDialog__error"
						role="alert"
					>
						{translate(errorKey)}
					</Typography>
				)}
				{helperKey && !errorKey && (
					<Typography className="twoFactorSetupDialog__helper">
						{translate(helperKey)}
					</Typography>
				)}
			</Box>
			{step !== 'decision' && (
				<div className="twoFactorSetupDialog__actions">
					{canClose && !isSuccess && (
						<Tooltip
							title={translate(
								'twoFactorAuth.setupDialog.action.close'
							)}
						>
							<IconButton
								aria-label={translate(
									'twoFactorAuth.setupDialog.action.close'
								)}
								className="twoFactorSetupDialog__iconAction twoFactorSetupDialog__iconAction--muted"
								disabled={isRequestInProgress}
								onClick={closeDialog}
							>
								<CloseRoundedIcon />
							</IconButton>
						</Tooltip>
					)}
					{!isSuccess && (
						<Tooltip
							title={translate(
								'twoFactorAuth.setupDialog.action.back'
							)}
						>
							<IconButton
								aria-label={translate(
									'twoFactorAuth.setupDialog.action.back'
								)}
								className="twoFactorSetupDialog__iconAction"
								disabled={isRequestInProgress}
								onClick={goBack}
							>
								<ArrowBackRoundedIcon />
							</IconButton>
						</Tooltip>
					)}
					<Button
						className="twoFactorSetupDialog__primaryAction"
						disabled={isPrimaryDisabled}
						onClick={handlePrimaryAction}
						startIcon={isSuccess ? undefined : <CheckRoundedIcon />}
						variant="contained"
					>
						{translate(primaryLabelKey)}
					</Button>
				</div>
			)}
		</Dialog>
	);
};
