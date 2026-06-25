import { useEffect, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Avatar from '@mui/material/Avatar';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Link from '@mui/material/Link';
import LoginRoundedIcon from '@mui/icons-material/LoginRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';

import LanguageSwitcher from './LanguageSwitcher';
import RegistrationStepper from './RegistrationStepper';
import { md3 } from '../theme';

const LOGO_BASE = `${import.meta.env.BASE_URL}logos/`;
const PARTNER_ROWS: { file: string; h: number }[][] = [
	[
		{ file: 'skf.svg', h: 55 },
		{ file: 'caritas.svg', h: 55 },
		{ file: 'skm.svg', h: 55 }
	],
	[
		{ file: 'malteser.svg', h: 55 },
		{ file: 'kreuzbund.svg', h: 55 },
		{ file: 'raphaelswerk.svg', h: 64 },
		{ file: 'invia.svg', h: 55 }
	]
];

const CONTENT_MAX = 780;

interface RegistrationLayoutProps {
	step: number;
	totalSteps: number;
	selectedLabel?: string | null;
	selectedIcon?: string | null;
	onClearSelection?: () => void;
	canContinue: boolean;
	onBack: () => void;
	onNext: () => void;
	maxStep?: number;
	onStepClick?: (step: number) => void;
	nextLabel?: string;
	children: ReactNode;
}

function PartnerLogos() {
	// Figma node 7642:36404 — two BOTTOM-aligned rows, centered. Logos render at
	// 55px (Raphaelswerk 64px). Row-1 gap 32px, row-2 gap 26px. The SVGs keep
	// their native brand colours (caritas = red box, SKM = white box, Malteser =
	// red+white shield, rest white) — visible against the dark hero gradient.
	return (
		<Box
			sx={{
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'center',
				gap: '30px'
			}}
		>
			{PARTNER_ROWS.map((row, i) => (
				<Box
					key={i}
					sx={{
						display: 'flex',
						alignItems: 'flex-end',
						justifyContent: 'center',
						gap: i === 0 ? '32px' : '26px'
					}}
				>
					{row.map(({ file, h }) => (
						<Box
							key={file}
							component="img"
							src={`${LOGO_BASE}${file}`}
							alt=""
							sx={{ height: h, width: 'auto', display: 'block' }}
						/>
					))}
				</Box>
			))}
		</Box>
	);
}

export default function RegistrationLayout({
	step,
	totalSteps,
	selectedLabel,
	selectedIcon,
	onClearSelection,
	canContinue,
	onBack,
	onNext,
	maxStep,
	onStepClick,
	nextLabel,
	children
}: RegistrationLayoutProps) {
	const { t } = useTranslation();
	const heroRef = useRef<HTMLDivElement>(null);
	const targetPos = useRef({ x: 32, y: 24 });

	// Mouse-tracked sheen that *drifts* toward the cursor (lerp on rAF) instead of
	// snapping to it — gives a soft "floating" feel rather than feeling glued to
	// the mouse. Two layered highlights (white core + warm coral halo) make it pop.
	useEffect(() => {
		let raf = 0;
		const cur = { x: 32, y: 24 };
		const tick = () => {
			cur.x += (targetPos.current.x - cur.x) * 0.06;
			cur.y += (targetPos.current.y - cur.y) * 0.06;
			const el = heroRef.current;
			if (el) {
				el.style.setProperty('--mx', `${cur.x.toFixed(2)}%`);
				el.style.setProperty('--my', `${cur.y.toFixed(2)}%`);
			}
			raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	}, []);

	const handleHeroMove = (e: React.MouseEvent<HTMLDivElement>) => {
		const el = heroRef.current;
		if (!el) return;
		const r = el.getBoundingClientRect();
		targetPos.current = {
			x: ((e.clientX - r.left) / r.width) * 100,
			y: ((e.clientY - r.top) / r.height) * 100
		};
	};

	const heroBackground = [
		'radial-gradient(circle at var(--mx, 32%) var(--my, 24%), rgba(255,255,255,0.22), rgba(255,255,255,0) 40%)',
		'radial-gradient(560px circle at var(--mx, 32%) var(--my, 24%), rgba(255,138,128,0.34), rgba(255,138,128,0) 60%)',
		md3.heroGradient
	].join(', ');

	const backButton = (
		<Button
			startIcon={<ArrowBackRoundedIcon />}
			onClick={onBack}
			disabled={step <= 1}
			sx={{ color: md3.onSurfaceVariant, fontSize: 15 }}
		>
			{t('reg.back')}
		</Button>
	);

	const nextButton = (
		<Button
			variant="contained"
			size="large"
			endIcon={<ArrowForwardRoundedIcon />}
			disabled={!canContinue}
			onClick={onNext}
			sx={{
				'px': 4,
				'py': 1.35,
				'fontSize': 17,
				'fontWeight': 700,
				'minWidth': { xs: 150, sm: 176 },
				'boxShadow': canContinue
					? '0 6px 18px rgba(164,38,46,0.30)'
					: 'none',
				'&:hover': { boxShadow: '0 8px 22px rgba(164,38,46,0.40)' }
			}}
		>
			{nextLabel ?? t('reg.next')}
		</Button>
	);

	const selectionChip =
		selectedLabel != null ? (
			<Chip
				avatar={
					selectedIcon ? (
						<Avatar src={selectedIcon} alt="" />
					) : undefined
				}
				label={selectedLabel}
				onDelete={onClearSelection}
				deleteIcon={<CloseRoundedIcon />}
				variant="outlined"
				aria-label={t('reg.removeSelection')}
				sx={{
					'height': 38,
					'borderRadius': 999,
					'fontWeight': 600,
					'fontSize': 14,
					'bgcolor': '#fff',
					'borderColor': md3.outlineVariant,
					// Flexible: the chip shrinks to the space actually available and
					// truncates (…), so a long topic name never pushes "Weiter/Далее"
					// out — at any viewport width, not just past a fixed cap.
					'maxWidth': '100%',
					'minWidth': 0,
					'flexShrink': 1,
					'& .MuiChip-label': {
						overflow: 'hidden',
						textOverflow: 'ellipsis',
						whiteSpace: 'nowrap'
					},
					'& .MuiChip-avatar': { width: 26, height: 26 }
				}}
			/>
		) : null;

	return (
		<Box
			sx={{
				display: 'flex',
				height: '100dvh',
				overflow: 'hidden',
				bgcolor: '#fff'
			}}
		>
			{/* Hero (desktop) — classic Caritas red, extends wider on large screens */}
			<Box
				ref={heroRef}
				onMouseMove={handleHeroMove}
				sx={{
					display: { xs: 'none', md: 'flex' },
					flexDirection: 'column',
					width: { md: 'clamp(340px, 42vw, 720px)' },
					flexShrink: 0,
					background: heroBackground,
					color: '#fff',
					p: 5,
					position: 'relative',
					overflow: 'hidden'
				}}
			>
				<Box
					sx={{
						flex: 1,
						display: 'flex',
						flexDirection: 'column',
						justifyContent: 'center'
					}}
				>
					<Typography
						sx={{
							fontSize: 42,
							fontWeight: 700,
							lineHeight: 1.1,
							mb: 1.5
						}}
					>
						{t('app.brandTitle')}
					</Typography>
					<Typography
						sx={{ fontSize: 19, fontWeight: 400, opacity: 0.92 }}
					>
						{t('app.brandSubtitle')}
					</Typography>
				</Box>

				<PartnerLogos />

				<Box
					sx={{
						display: 'flex',
						gap: 1.5,
						mt: 3,
						fontSize: 12.5,
						opacity: 0.85,
						justifyContent: 'center'
					}}
				>
					<Link href="#" underline="hover" color="inherit">
						{t('app.imprint')}
					</Link>
					<Box component="span" sx={{ opacity: 0.6 }}>
						|
					</Box>
					<Link href="#" underline="hover" color="inherit">
						{t('app.privacy')}
					</Link>
				</Box>
			</Box>

			{/* Content column — CSS grid [header][scroll][footer]. `minmax(0, 1fr)` on
          the middle row is the robust way to keep the footer pinned and the list
          scrollable on mobile: a definite track that can shrink below its content,
          avoiding the flex `min-height:auto` trap that pushed the footer off-screen
          (and broke scrolling) on real phones. */}
			<Box
				sx={{
					flex: 1,
					minWidth: 0,
					height: '100dvh',
					display: 'grid',
					gridTemplateRows: 'auto minmax(0, 1fr) auto',
					overflow: 'hidden'
				}}
			>
				{/* Header group — brand (mobile) + top bar + stepper; always on top */}
				<Box sx={{ minWidth: 0 }}>
					{/* Slim brand bar on mobile only */}
					<Box
						sx={{
							display: { xs: 'flex', md: 'none' },
							alignItems: 'center',
							gap: 1.25,
							px: 2,
							py: 1.25,
							background: md3.heroGradient,
							color: '#fff'
						}}
					>
						<Typography sx={{ fontSize: 17, fontWeight: 700 }}>
							{t('app.brandTitle')}
						</Typography>
						<Typography sx={{ fontSize: 13, opacity: 0.85 }}>
							{t('app.brandSubtitle')}
						</Typography>
					</Box>

					{/* Sticky top bar — stays on top, never scrolls */}
					<Stack
						direction="row"
						alignItems="center"
						justifyContent="flex-end"
						spacing={1.5}
						sx={{
							px: { xs: 2, md: 4 },
							py: 1.5,
							flexShrink: 0,
							bgcolor: '#fff'
						}}
					>
						<LanguageSwitcher />
						<Button
							variant="outlined"
							startIcon={<LoginRoundedIcon />}
							sx={{
								borderColor: md3.outlineVariant,
								color: md3.onSurface
							}}
						>
							{t('app.login')}
						</Button>
					</Stack>

					{/* Sticky stepper — also stays on top */}
					<Box
						sx={{
							flexShrink: 0,
							px: { xs: 2, md: 4 },
							pb: 1.5,
							borderBottom: `1px solid ${md3.outlineVariant}`,
							bgcolor: '#fff'
						}}
					>
						<Box sx={{ maxWidth: CONTENT_MAX, mr: 'auto' }}>
							<RegistrationStepper
								current={step}
								total={totalSteps}
								maxStep={maxStep}
								onStepClick={onStepClick}
							/>
						</Box>
					</Box>
				</Box>
				{/* end header group */}

				{/* Scrollable step content, left-anchored. This is the grid's
            minmax(0, 1fr) row — it owns all remaining height and scrolls
            internally, so the footer below stays pinned and visible. */}
				<Box
					sx={{
						minHeight: 0,
						overflowY: 'auto',
						WebkitOverflowScrolling: 'touch',
						overscrollBehavior: 'contain',
						px: { xs: 2, md: 4 }
					}}
				>
					<Box
						sx={{
							maxWidth: CONTENT_MAX,
							mr: 'auto',
							pt: { xs: 2, md: 3 },
							pb: 3
						}}
					>
						{/* Each step renders its own <StepHeading/> so the title/subtitle
                change per step (topic → postcode → …). */}
						{children}
					</Box>
				</Box>

				{/* Sticky footer */}
				<Box
					sx={{
						flexShrink: 0,
						borderTop: `1px solid ${md3.outlineVariant}`,
						bgcolor: 'rgba(255,255,255,0.94)',
						backdropFilter: 'blur(8px)',
						px: { xs: 2, md: 4 },
						py: 1.5
					}}
				>
					<Box sx={{ maxWidth: CONTENT_MAX, mr: 'auto' }}>
						{/* Desktop: grid row [back | chip | next]. The middle column is
                minmax(0, 1fr) so it shrinks reliably (flex-basis:0 would NOT
                shrink on overflow), letting the chip truncate while "Weiter"
                stays fixed. */}
						<Box
							sx={{
								display: { xs: 'none', sm: 'grid' },
								gridTemplateColumns: 'auto minmax(0, 1fr) auto',
								alignItems: 'center',
								gap: 2
							}}
						>
							{backButton}
							<Box
								sx={{
									minWidth: 0,
									overflow: 'hidden',
									display: 'flex',
									justifyContent: 'center',
									alignItems: 'center',
									gap: 1
								}}
							>
								{selectionChip ? (
									<>
										<Typography
											sx={{
												fontSize: 13,
												color: md3.onSurfaceVariant,
												flexShrink: 0
											}}
										>
											{t('reg.selectedLabel')}:
										</Typography>
										{selectionChip}
									</>
								) : (
									<Typography
										sx={{
											fontSize: 13,
											color: md3.outline
										}}
									>
										{t('reg.noneSelected')}
									</Typography>
								)}
							</Box>
							{nextButton}
						</Box>

						{/* Mobile: chip stacked above the buttons, centered */}
						<Box sx={{ display: { xs: 'block', sm: 'none' } }}>
							{selectionChip && (
								<Box
									sx={{
										mb: 1.25,
										display: 'flex',
										flexDirection: 'column',
										alignItems: 'center',
										textAlign: 'center'
									}}
								>
									<Typography
										sx={{
											fontSize: 11,
											fontWeight: 700,
											letterSpacing: 1,
											textTransform: 'uppercase',
											color: md3.onSurfaceVariant,
											mb: 0.75
										}}
									>
										{t('reg.selectedLabel')}
									</Typography>
									{selectionChip}
								</Box>
							)}
							<Box sx={{ display: 'flex', alignItems: 'center' }}>
								{backButton}
								<Box sx={{ flex: 1 }} />
								{nextButton}
							</Box>
						</Box>
					</Box>
				</Box>
			</Box>
		</Box>
	);
}
