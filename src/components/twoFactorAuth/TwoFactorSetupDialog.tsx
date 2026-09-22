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
	Tooltip,
	Typography
} from '@mui/material';
import clsx from 'clsx';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import AndroidIcon from '@mui/icons-material/Android';
import AppleIcon from '@mui/icons-material/Apple';
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
import {
	AccountSetupField,
	AccountSetupHeader,
	AccountSetupHeaderIcon,
	AccountSetupProgress
} from './accountSetupDialogChrome';
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
// The shared confirmation animation, so this success step reads like every
// other one in the product. Falls back to a static illustration under
// prefers-reduced-motion, both in the tenant's brand colour.
import { CheckAnimation } from '../animatedIllustration/AnimatedIllustration';
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

/** Every step names itself; one shared dialog title told nobody where they were. */
const STEP_HEADERS: Record<
	TwoFactorSetupStep,
	{ icon: AccountSetupHeaderIcon; titleKey: string; copyKey: string }
> = {
	'decision': {
		icon: 'phone',
		titleKey: 'twoFactorAuth.setupDialog.decision.title',
		copyKey: 'twoFactorAuth.setupDialog.decision.copy'
	},
	'app-install': {
		icon: 'phone',
		titleKey: 'twoFactorAuth.setupDialog.app.install.title',
		copyKey: 'twoFactorAuth.setupDialog.app.install.copy'
	},
	'app-connect': {
		icon: 'phone',
		titleKey: 'twoFactorAuth.setupDialog.app.connect.title',
		copyKey: 'twoFactorAuth.setupDialog.app.connect.copy'
	},
	'app-verify': {
		icon: 'phone',
		titleKey: 'twoFactorAuth.setupDialog.app.verify.title',
		copyKey: 'twoFactorAuth.setupDialog.app.verify.copy'
	},
	'app-success': {
		icon: 'phone',
		titleKey: 'twoFactorAuth.setupDialog.success.title',
		copyKey: 'twoFactorAuth.setupDialog.app.success.title'
	},
	'email-select': {
		icon: 'phone',
		titleKey: 'twoFactorAuth.setupDialog.email.select.title',
		copyKey: 'twoFactorAuth.setupDialog.email.select.copy'
	},
	'email-connect': {
		icon: 'phone',
		titleKey: 'twoFactorAuth.setupDialog.email.connect.title',
		copyKey: 'twoFactorAuth.setupDialog.email.connect.copy'
	},
	'email-success': {
		icon: 'phone',
		titleKey: 'twoFactorAuth.setupDialog.success.title',
		copyKey: 'twoFactorAuth.setupDialog.email.success.title'
	}
};

interface TwoFactorSetupDialogProps {
	open: boolean;
	canClose: boolean;
	canDisable: boolean;
	/** Forced setup only: the dialog is modal and cannot be closed, so logging out — the one other
	 *  way on — has to be offered inside it. */
	onLogout?: () => void;
	currentType?: TwoFactorType;
	email?: string;
	qrCode?: string;
	secret?: string;
	onClose: () => void;
	onDisable: () => Promise<void> | void;
	onSetupAborted?: () => void;
	onSetupComplete: () => Promise<void> | void;
	/** Account setup only: this dialog is step 2 of 2, and says so at the top. */
	showAccountProgress?: boolean;
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
	onLogout,
	currentType = TWO_FACTOR_TYPES.NONE,
	email: initialEmail = '',
	qrCode,
	secret,
	onClose,
	onDisable,
	onSetupAborted,
	onSetupComplete,
	showAccountProgress = false
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
	const isSuccess = step === 'app-success' || step === 'email-success';
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
			setOtp('');
			setErrorKey('');
			setHelperKey('');

			try {
				await apiPatchTwoFactorAuthEncourage(false);
			} catch {
				// 2FA is already active; encourage is best-effort.
			}

			try {
				await onSetupComplete();
			} catch {
				// The 2FA credential is already active at this point. User data can
				// still be stale until the next login (especially after changing the
				// account e-mail), so a failed refresh must not report setup failure.
				onSetupAborted?.();
			}

			setStep(nextStep);
		},
		[onSetupAborted, onSetupComplete]
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
			onSetupAborted?.();
			setFetchError(
				error as Error,
				'twoFactorAuth.setupDialog.error.appSetup'
			);
		} finally {
			setIsRequestInProgress(false);
		}
	}, [finishSetup, onSetupAborted, otp, secret, setFetchError]);

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
			onSetupAborted?.();
			setFetchError(
				error as Error,
				'twoFactorAuth.setupDialog.error.emailSetup'
			);
		} finally {
			setIsRequestInProgress(false);
		}
	}, [finishSetup, onSetupAborted, otp, setFetchError]);

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

	// These steps show the error on the field itself, so the body must not
	// repeat it further down the dialog.
	const stepHasField =
		step === 'app-verify' ||
		step === 'email-connect' ||
		step === 'email-select';

	const isPrimaryDisabled =
		isRequestInProgress ||
		(step === 'email-select' && !isStringValidEmail(email)) ||
		((step === 'app-verify' || step === 'email-connect') &&
			!isOtpValid(otp));

	const primaryLabelKey =
		step === 'app-install'
			? 'twoFactorAuth.setupDialog.app.install.done'
			: step === 'app-verify' || step === 'email-connect'
				? 'twoFactorAuth.setupDialog.action.confirm'
				: isSuccess
					? 'twoFactorAuth.setupDialog.action.close'
					: 'twoFactorAuth.setupDialog.action.next';

	const renderDecision = () => (
		<div className="twoFactorSetupDialog__decision">
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
			<div className="twoFactorSetupDialog__downloadGrid">
				{APP_DOWNLOADS.map((app) => (
					<div
						className="twoFactorSetupDialog__card twoFactorSetupDialog__downloadCard"
						key={app.titleKey}
					>
						<div className="twoFactorSetupDialog__downloadText">
							<Typography className="twoFactorSetupDialog__downloadTitle">
								{translate(app.titleKey)}
							</Typography>
							<Typography className="twoFactorSetupDialog__downloadNote">
								{translate(
									'twoFactorAuth.setupDialog.app.install.note'
								)}
							</Typography>
						</div>
						<div className="twoFactorSetupDialog__storeBadges">
							<Link
								className="twoFactorSetupDialog__storeBadge"
								href={translate(app.iosKey)}
								target="_blank"
								rel="noreferrer"
								underline="none"
								aria-label={`${translate(app.titleKey)} – ${translate(
									'twoFactorAuth.setupDialog.app.install.ios'
								)}`}
							>
								<AppleIcon fontSize="small" />
								App Store
							</Link>
							<Link
								className="twoFactorSetupDialog__storeBadge"
								href={translate(app.androidKey)}
								target="_blank"
								rel="noreferrer"
								underline="none"
								aria-label={`${translate(app.titleKey)} – ${translate(
									'twoFactorAuth.setupDialog.app.install.android'
								)}`}
							>
								<AndroidIcon fontSize="small" />
								Google Play
							</Link>
						</div>
					</div>
				))}
			</div>
		</div>
	);

	const renderAppConnect = () => (
		<div className="twoFactorSetupDialog__connect">
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
				<div className="twoFactorSetupDialog__card twoFactorSetupDialog__manualKey">
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
		<AccountSetupField
			key={`otp-${labelKey}`}
			autoFocus
			errorMessage={errorKey ? translate(errorKey) : ''}
			id="two-factor-setup-otp"
			inputMode="numeric"
			label={translate(labelKey)}
			maxLength={OTP_LENGTH}
			name="two-factor-setup-otp"
			onChange={handleOtpChange}
			pattern="[0-9]*"
			value={otp}
		/>
	);

	const renderEmailSelect = () => (
		<div key="email-select" className="twoFactorSetupDialog__emailSelect">
			<AccountSetupField
				key="tfa-email-select-input"
				autoFocus
				errorMessage={
					errorKey
						? translate(errorKey)
						: email.length > 0 && !isStringValidEmail(email)
							? translate(
									'twoFactorAuth.setupDialog.error.invalidEmail'
								)
							: ''
				}
				hint={translate('twoFactorAuth.setupDialog.email.select.hint')}
				id="two-factor-setup-email"
				inputMode="email"
				label={translate(
					'twoFactorAuth.setupDialog.email.select.input'
				)}
				name="two-factor-setup-email"
				onChange={handleEmailChange}
				type="email"
				value={email}
			/>
		</div>
	);

	const renderEmailConnect = () => (
		<div key="email-connect" className="twoFactorSetupDialog__emailCode">
			{renderOtpInput('twoFactorAuth.setupDialog.email.connect.input')}
			<div className="twoFactorSetupDialog__card twoFactorSetupDialog__resend">
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
			<CheckAnimation className="twoFactorSetupDialog__successIcon" />
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
				return renderOtpInput(
					'twoFactorAuth.setupDialog.app.verify.input'
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
			maxWidth={false}
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
			{showAccountProgress && <AccountSetupProgress active="twoFactor" />}
			<AccountSetupHeader
				descriptionId="two-factor-setup-description"
				icon={STEP_HEADERS[step].icon}
				subtitle={translate(
					STEP_HEADERS[step].copyKey,
					// Only the sent-to line names an address; the rest would
					// carry an unused interpolation.
					step === 'email-connect' ? { email } : {}
				)}
				title={translate(STEP_HEADERS[step].titleKey)}
				titleId="two-factor-setup-title"
			/>
			<FlowStepper activeStep={step} selectedMethod={selectedMethod} />
			<Box className="twoFactorSetupDialog__body">
				{renderStep()}
				{errorKey && !stepHasField && (
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
			<div className="twoFactorSetupDialog__actionBlock">
				{step !== 'decision' && (
					<div
						className={clsx('twoFactorSetupDialog__actions', {
							// Success hides both icon buttons, so the
							// remaining close action gets its own
							// right-aligned single row.
							'twoFactorSetupDialog__actions--single': isSuccess
						})}
					>
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
							variant="contained"
						>
							{translate(primaryLabelKey)}
						</Button>
					</div>
				)}
				{onLogout && !isSuccess && (
					<Button
						className="twoFactorSetupDialog__logout"
						disabled={isRequestInProgress}
						onClick={onLogout}
						variant="text"
					>
						{translate('accountSetup.required.logout')}
					</Button>
				)}
			</div>
		</Dialog>
	);
};
