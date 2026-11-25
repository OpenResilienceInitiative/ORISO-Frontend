import './loginMatrixFeedback.scss';
import * as React from 'react';
import {
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
	useSyncExternalStore
} from 'react';
import { expect, waitFor } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useTranslation } from 'react-i18next';
import {
	Avatar,
	Box,
	Button,
	Divider,
	InputAdornment,
	Stack,
	Typography
} from '@mui/material';
import LockRounded from '@mui/icons-material/LockRounded';
import MailOutlineRounded from '@mui/icons-material/MailOutlineRounded';
import PersonOutlineRounded from '@mui/icons-material/PersonOutlineRounded';
import VerifiedUserOutlined from '@mui/icons-material/VerifiedUserOutlined';
import { OrisoTextField } from '../form/OrisoTextField';
import { Stage } from '../stage/stage';
import { StageLayout } from '../stageLayout/StageLayout';
import { Loading } from './Loading';
import '../login/login.styles';
import './loginTransitionPrototype.scss';

const DEMO_USERNAME = 'demo.beratung';
const DEMO_PASSWORD = 'storybook-demo';
const DEMO_CODE = '123456';

type Phase = 'form' | 'loading' | 'revealing' | 'app';

const loadMatrixDissolve = () => import('./loginMatrixDissolve');
const reducedMotion = () =>
	window.matchMedia('(prefers-reduced-motion: reduce)');
const subscribeMotion = (notify: () => void) => {
	const media = reducedMotion();
	media.addEventListener('change', notify);
	return () => media.removeEventListener('change', notify);
};
const prefersReducedMotion = () => reducedMotion().matches;
const surfaceText = { color: 'var(--m3-on-surface)' };
const secondaryText = { color: 'var(--m3-on-surface-variant)' };
const avatarPalette = {
	bgcolor: 'var(--m3-primary)',
	color: 'var(--m3-on-primary)'
};

const InboxPreview = ({
	available,
	onReplay
}: {
	available: boolean;
	onReplay: () => void;
}) => {
	const heading = useRef<HTMLHeadingElement>(null);
	useEffect(() => {
		if (available) heading.current?.focus({ preventScroll: true });
	}, [available]);

	return (
		<div
			className="loginTransitionPrototype__app"
			inert={!available}
			aria-hidden={!available}
		>
			<Stack
				component="header"
				direction="row"
				justifyContent="space-between"
				alignItems="center"
				className="loginTransitionPrototype__appHeader"
			>
				<Stack direction="row" alignItems="center" spacing={1.5}>
					<Avatar sx={{ ...avatarPalette, width: 36, height: 36 }}>
						<MailOutlineRounded fontSize="small" />
					</Avatar>
					<Typography fontWeight={700} sx={surfaceText}>
						Beratung & Hilfe
					</Typography>
				</Stack>
				<Button onClick={onReplay} sx={{ color: 'var(--m3-primary)' }}>
					Erneut ansehen
				</Button>
			</Stack>
			<div className="loginTransitionPrototype__workArea">
				<aside className="loginTransitionPrototype__inbox">
					<Typography
						component="h2"
						variant="h5"
						fontWeight={700}
						sx={surfaceText}
					>
						Postfach
					</Typography>
					<Stack
						direction="row"
						spacing={1.5}
						alignItems="center"
						className="loginTransitionPrototype__thread"
					>
						<Avatar sx={avatarPalette}>B</Avatar>
						<Box>
							<Typography fontWeight={700} sx={surfaceText}>
								Beratungsstelle
							</Typography>
							<Typography variant="body2" sx={secondaryText}>
								Willkommen in der Online-Beratung
							</Typography>
						</Box>
					</Stack>
				</aside>
				<main className="loginTransitionPrototype__conversation">
					<Stack
						component="header"
						direction="row"
						alignItems="center"
						spacing={1.5}
					>
						<Avatar sx={avatarPalette}>B</Avatar>
						<div>
							<Typography
								component="h1"
								variant="h6"
								tabIndex={-1}
								ref={heading}
							>
								Beratungsstelle
							</Typography>
							<Stack
								direction="row"
								spacing={0.5}
								alignItems="center"
							>
								<LockRounded fontSize="inherit" />
								<Typography variant="body2" sx={secondaryText}>
									Verschlüsselt
								</Typography>
							</Stack>
						</div>
					</Stack>
					<Divider
						sx={{ my: 2, borderColor: 'var(--m3-outline-variant)' }}
					/>
					<Typography
						className="loginTransitionPrototype__message"
						sx={surfaceText}
					>
						Willkommen! Was können wir für Sie tun?
					</Typography>
					<div className="loginTransitionPrototype__composer">
						<OrisoTextField label="Nachricht schreiben" fullWidth />
					</div>
				</main>
			</div>
		</div>
	);
};

/** Storybook-only motion study. The delay stands in for actual app readiness. */
const LoginTransitionPrototype = ({
	readyAfter,
	effect = 'orbital'
}: {
	readyAfter: number;
	effect?: 'orbital' | 'matrix';
}) => {
	const { t } = useTranslation();
	const reduce = useSyncExternalStore(
		subscribeMotion,
		prefersReducedMotion,
		() => false
	);
	const [phase, setPhase] = useState<Phase>('form');
	const [code, setCode] = useState(DEMO_CODE);
	const [hasReplayed, setHasReplayed] = useState(false);
	const [matrixFailed, setMatrixFailed] = useState(false);
	const [matrixActive, setMatrixActive] = useState(false);
	const formRef = useRef<HTMLFormElement>(null);
	const scene = useRef<ReturnType<
		typeof import('./loginMatrixDissolve').startLoginMatrix
	> | null>(null);
	const matrix = effect === 'matrix';
	const waiting = phase === 'loading';
	const revealing = phase === 'revealing';
	const formAvailable = phase === 'form';
	const displayValues = matrix && !formAvailable;
	const showingMatrix = displayValues && phase !== 'app';

	useEffect(() => {
		if (!waiting) return;
		const timeout = window.setTimeout(
			() => setPhase(prefersReducedMotion() ? 'app' : 'revealing'),
			readyAfter
		);
		return () => window.clearTimeout(timeout);
	}, [waiting, readyAfter]);

	useEffect(() => {
		if (!revealing) return;
		const fallback = window.setTimeout(() => setPhase('app'), 700);
		return () => window.clearTimeout(fallback);
	}, [revealing]);

	const warmMatrix = () => {
		if (matrix && !reduce) void loadMatrixDissolve().catch(() => undefined);
	};

	useLayoutEffect(() => {
		const form = formRef.current;
		if (!showingMatrix || !form || reduce) return;
		let stopped = false;
		void loadMatrixDissolve()
			.then(({ startLoginMatrix }) => {
				if (stopped || !form.closest('[data-phase="loading"]')) return;
				scene.current = startLoginMatrix(form);
				setMatrixActive(true);
			})
			.catch(() => {
				if (!stopped) setMatrixFailed(true);
			});
		return () => {
			stopped = true;
			scene.current?.dispose();
			scene.current = null;
		};
	}, [showingMatrix, reduce]);

	useLayoutEffect(() => {
		if (revealing && reduce) setPhase('app');
		else if (revealing) scene.current?.pause();
	}, [revealing, reduce]);

	return (
		<div
			className="loginTransitionPrototype"
			data-phase={phase}
			data-effect={effect}
			data-matrix-failed={matrixFailed && !formAvailable}
			onAnimationEnd={(event) => {
				if (
					revealing &&
					event.animationName === 'prototype-form-exit' &&
					(event.target as HTMLElement).classList.contains(
						'stageLayout__contentWrapper'
					)
				)
					setPhase('app');
			}}
		>
			<InboxPreview
				available={phase === 'app'}
				onReplay={() => {
					setHasReplayed(true);
					setCode(DEMO_CODE);
					setPhase('form');
				}}
			/>
			<span
				className="loginTransitionPrototype__matrixStatus"
				role="status"
			>
				{waiting && t('app.wait')}
			</span>
			{phase !== 'app' && (
				<div
					className="loginTransitionPrototype__foreground"
					inert={!formAvailable}
				>
					<StageLayout
						className="stageLayout--login"
						stage={<Stage hasAnimation={false} isReady />}
						mobileHero="branding"
					>
						<div className="loginTransitionPrototype__area">
							<form
								ref={formRef}
								className="loginForm loginTransitionPrototype__form"
								onSubmit={(event) => {
									event.preventDefault();
									setMatrixFailed(false);
									setMatrixActive(false);
									setPhase('loading');
								}}
							>
								<Stack spacing={2.25} sx={{ width: '100%' }}>
									<Typography
										component="h2"
										variant="h4"
										fontWeight={700}
										sx={{
											fontSize: { xs: 26, md: 34 },
											color: 'var(--m3-on-surface)'
										}}
									>
										<span>{t('login.headline')}</span>
									</Typography>
									<OrisoTextField
										label={
											<span>{t('login.user.label')}</span>
										}
										value={DEMO_USERNAME}
										InputProps={{
											readOnly: true,
											startAdornment: (
												<InputAdornment position="start">
													<PersonOutlineRounded />
												</InputAdornment>
											)
										}}
									/>
									<OrisoTextField
										label={
											<span>
												{t('login.password.label')}
											</span>
										}
										value={DEMO_PASSWORD}
										type="password"
										InputProps={{
											readOnly: true,
											startAdornment: (
												<InputAdornment position="start">
													<LockRounded />
												</InputAdornment>
											)
										}}
									/>
									<Typography
										variant="body2"
										sx={secondaryText}
										textAlign="left"
									>
										{t(
											'twoFactorAuth.activate.email.resend.hint'
										)}
									</Typography>
									<OrisoTextField
										label={
											<span>
												{t(
													'twoFactorAuth.activate.otp.input.label.text'
												)}
											</span>
										}
										value={code}
										autoFocus={hasReplayed}
										autoComplete="off"
										onFocus={warmMatrix}
										onChange={(event) =>
											setCode(event.target.value)
										}
										inputProps={{
											inputMode: 'numeric'
										}}
										InputProps={{
											readOnly: displayValues,
											startAdornment: (
												<InputAdornment position="start">
													<VerifiedUserOutlined />
												</InputAdornment>
											)
										}}
									/>
									<div className="loginTransitionPrototype__submitRow">
										<Button
											fullWidth
											disableRipple={matrix}
											type="submit"
											onFocus={warmMatrix}
											onPointerEnter={warmMatrix}
											variant="contained"
											size="large"
											disabled={!code.trim()}
											sx={{
												borderRadius: 99,
												minHeight: 48
											}}
										>
											<span>
												{t('login.button.label')}
											</span>
										</Button>
										{matrix &&
											waiting &&
											!reduce &&
											!matrixActive &&
											!matrixFailed && (
												<div
													className="loginTransitionPrototype__pending"
													aria-hidden
												>
													<Loading
														compact
														delayMs={200}
														label={t('app.wait')}
													/>
												</div>
											)}
									</div>
								</Stack>
							</form>
							{!matrix && !formAvailable && (
								<div className="loginTransitionPrototype__loader">
									<Loading
										delayMs={0}
										label={t('app.wait')}
									/>
								</div>
							)}
						</div>
					</StageLayout>
				</div>
			)}
		</div>
	);
};

const meta = {
	title: 'Login/Übergang nach dem Einmal-Code',
	component: LoginTransitionPrototype,
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component:
					'Bewegungsprototyp mit simuliertem Login. Über „Anmelden“ starten und im Postfach über „Erneut ansehen“ zurücksetzen.'
			}
		}
	},
	argTypes: {
		readyAfter: {
			name: 'App bereit nach (ms)',
			control: { type: 'range', min: 100, max: 15000, step: 100 }
		}
	}
} satisfies Meta<typeof LoginTransitionPrototype>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FromCodeToInbox: Story = {
	name: 'Nach dem Einmal-Code',
	args: { readyAfter: 2350 }
};

export const Fast: Story = {
	name: 'Schneller Login',
	args: { readyAfter: 100 }
};

export const Slow: Story = {
	name: 'Längerer Login',
	args: { readyAfter: 4800 }
};

export const MatrixDissolve: Story = {
	name: 'Matrix — Buchstaben und Vorhang',
	args: { readyAfter: 2350, effect: 'matrix' }
};

export const MatrixFast: Story = {
	name: 'Matrix — kurze Wartezeit',
	args: { readyAfter: 290, effect: 'matrix' }
};

export const MatrixOneSecond: Story = {
	name: 'Matrix — nach einer Sekunde bereit',
	args: { readyAfter: 1000, effect: 'matrix' }
};

export const MatrixMobile: Story = {
	...MatrixDissolve,
	name: 'Matrix — Handy',
	globals: { viewport: { value: 'phone390' } }
};

export const MatrixSlow: Story = {
	...MatrixDissolve,
	name: 'Matrix — 15 Sekunden Wartezeit',
	args: { readyAfter: 15000, effect: 'matrix' }
};

export const MatrixDark: Story = {
	...MatrixDissolve,
	name: 'Matrix — dunkles Theme',
	globals: { scheme: 'dark' }
};

export const MatrixKeyboardHandover: Story = {
	name: 'Matrix — Übergabe per Tastatur',
	args: { readyAfter: 290, effect: 'matrix' },
	play: async ({ canvas, userEvent }) => {
		const submit = canvas.getByRole('button', { name: 'Anmelden' });
		submit.focus();
		await userEvent.keyboard('{Enter}');
		const replay = await canvas.findByRole('button', {
			name: 'Erneut ansehen'
		});
		await waitFor(() =>
			expect(
				canvas.getByRole('heading', { name: 'Beratungsstelle' })
			).toHaveFocus()
		);
		await userEvent.tab({ shift: true });
		await expect(replay).toHaveFocus();
		await userEvent.keyboard('{Enter}');
		await expect(
			canvas.getByRole('textbox', { name: /code/i })
		).toHaveFocus();
		await expect(
			canvas.getByRole('button', { name: 'Anmelden' })
		).toBeEnabled();
	}
};
