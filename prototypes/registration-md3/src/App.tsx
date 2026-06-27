import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';

import RegistrationLayout from './components/RegistrationLayout';
import StepHeading from './components/StepHeading';
import TopicSelection from './components/TopicSelection';
import PostcodeStep from './components/PostcodeStep';
import ConsultingCenterStep from './components/ConsultingCenterStep';
import RegisterStep, {
	type RegisterValues,
	isRegisterValid
} from './components/RegisterStep';
import { CATEGORIES } from './data/topics';

const TOTAL_STEPS = 5;
const EMPTY_REGISTER: RegisterValues = {
	username: '',
	password: '',
	confirm: '',
	privacy: false
};
const STORAGE_KEY = 'oriso-registration';

export default function App() {
	const { t } = useTranslation();

	// Keep all registration values in memory only. This prototype covers
	// counselling topics and free-text requests, so reload persistence would leave
	// sensitive context in browser storage.
	const [step, setStep] = useState(1);
	const [maxStep, setMaxStep] = useState(1);
	const [selected, setSelected] = useState<string | null>(null);
	const [postcode, setPostcode] = useState('');
	const [centerId, setCenterId] = useState<string | null>(null);
	const [register, setRegister] = useState<RegisterValues>(EMPTY_REGISTER);
	const [message, setMessage] = useState('');
	const [toast, setToast] = useState<string | null>(null);

	useEffect(() => {
		sessionStorage.removeItem(STORAGE_KEY);
	}, []);

	const selectedTopic = useMemo(() => {
		if (!selected) return null;
		for (const category of CATEGORIES) {
			const row = category.topics.find((topic) => topic.id === selected);
			if (row) return row;
		}
		return null;
	}, [selected]);

	const selectedLabel = selectedTopic
		? t(`topic.${selectedTopic.slug}.title`)
		: null;

	const postcodeValid = /^\d{5}$/.test(postcode);
	const registerValid = isRegisterValid(register);

	const canContinue =
		step === 1
			? Boolean(selected)
			: step === 2
				? postcodeValid
				: step === 3
					? Boolean(centerId)
					: step === 4
						? registerValid
						: registerValid && message.trim().length > 0; // step 5

	const goTo = (next: number) => {
		setStep(next);
		setMaxStep((m) => Math.max(m, next));
	};

	const handleNext = () => {
		if (!canContinue) return;
		if (step < TOTAL_STEPS) goTo(step + 1);
		else setToast(t('reg.sent')); // step 5 — the animated send/preload is issue #256
	};

	const handleBack = () => {
		if (step > 1) setStep(step - 1);
	};

	// Stepper click — jump to any step already reached. Step 5 stays gated on
	// valid registration even when maxStep was reached earlier in the session.
	const handleStepClick = (target: number) => {
		if (target > maxStep) return;
		if (target === 5 && !registerValid) return;
		setStep(target);
	};

	const handleTopicChange = (id: string) => {
		if (id === selected) return;
		setSelected(id);
		setPostcode('');
		setCenterId(null);
		setRegister(EMPTY_REGISTER);
		setMessage('');
		setStep(1);
		setMaxStep(1);
	};

	const handlePostcodeChange = (next: string) => {
		if (next !== postcode) {
			setCenterId(null);
			setMessage('');
			setMaxStep((m) => Math.min(m, 2));
		}
		setPostcode(next);
	};

	const handleCenterChange = (id: string) => {
		if (id !== centerId) {
			setMessage('');
			setMaxStep((m) => Math.min(m, 3));
		}
		setCenterId(id);
	};

	// Removing the topic chip clears the selection and returns to step 1 — a later
	// step can't stand once the foundational topic choice is empty.
	const clearSelection = () => {
		setSelected(null);
		setPostcode('');
		setCenterId(null);
		setRegister(EMPTY_REGISTER);
		setMessage('');
		setStep(1);
		setMaxStep(1);
	};

	const nextLabel =
		step === 4
			? t('reg.register.submit')
			: step === 5
				? t('reg.send')
				: t('reg.next');

	return (
		<>
			<RegistrationLayout
				step={step}
				totalSteps={TOTAL_STEPS}
				maxStep={maxStep}
				onStepClick={handleStepClick}
				nextLabel={nextLabel}
				selectedLabel={selectedLabel}
				selectedIcon={selectedTopic?.icon ?? null}
				onClearSelection={clearSelection}
				canContinue={canContinue}
				onBack={handleBack}
				onNext={handleNext}
			>
				{step === 1 && (
					<>
						<StepHeading
							title={t('reg.question')}
							subtitle={t('reg.subtitle')}
						/>
						<TopicSelection
							categories={CATEGORIES}
							value={selected}
							onChange={handleTopicChange}
						/>
					</>
				)}
				{step === 2 && (
					<PostcodeStep
						value={postcode}
						onChange={handlePostcodeChange}
					/>
				)}
				{step === 3 && (
					<ConsultingCenterStep
						value={centerId}
						onChange={handleCenterChange}
						postcode={postcode}
					/>
				)}
				{step === 4 && (
					<RegisterStep value={register} onChange={setRegister} />
				)}
				{step === 5 && (
					<Box sx={{ maxWidth: 540 }}>
						<StepHeading
							title={t('reg.message.title')}
							subtitle={t('reg.message.subtitle')}
						/>
						<TextField
							value={message}
							onChange={(e) => setMessage(e.target.value)}
							placeholder={t('reg.message.placeholder')}
							multiline
							minRows={5}
							fullWidth
							inputProps={{
								'aria-label': t('reg.message.placeholder')
							}}
							InputProps={{
								sx: { borderRadius: '12px', bgcolor: '#fff' }
							}}
						/>
					</Box>
				)}
			</RegistrationLayout>

			<Snackbar
				open={Boolean(toast)}
				autoHideDuration={2600}
				onClose={() => setToast(null)}
				anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
			>
				<Alert
					severity="success"
					variant="filled"
					onClose={() => setToast(null)}
					sx={{ borderRadius: 3 }}
				>
					{toast}
				</Alert>
			</Snackbar>
		</>
	);
}
