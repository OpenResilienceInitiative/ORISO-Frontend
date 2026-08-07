import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box, Typography } from '@mui/material';
import { StageEffectName, STAGE_EFFECT_NAMES } from './types';
import { useStageEffect, STAGE_EFFECT_MIN_WIDTH } from './useStageEffect';
import { loadStageEffect } from './loadStageEffect';
import { ConnectedDotsEffect } from './variants/connectedDots';
import { COVERAGE_IS_PROVISIONAL } from './variants/coverage';
import { CARRIERS } from './variants/carriers';

const meta: Meta = {
	title: 'Stage/Login effects',
	parameters: {
		docs: {
			description: {
				component: [
					'The four options a tenant can pick in Admin → Appearance.',
					'',
					'**Only one is ever downloaded.** Each variant is its own `import()`,',
					'so the bundler emits one chunk per effect and the visitor fetches',
					'exactly the one their tenant selected — never all four. `Normal`',
					'fetches nothing at all.',
					'',
					`Below ${STAGE_EFFECT_MIN_WIDTH}px the stage is not rendered, so the`,
					'chunk is never requested on a phone. `prefers-reduced-motion`',
					'renders one resting frame and stops.'
				].join('\n')
			}
		}
	}
};

export default meta;

const LABELS: Record<StageEffectName, string> = {
	none: 'Normal — keine Effekte, nur der bestehende Lichtkegel',
	lines: 'Lines — Lebenslinie mit seltenem Herzschlag',
	connectedDots: 'Connected Dots — Lichter der Traeger',
	cracks: 'Uncovering Cracks — Risse, die der Cursor freilegt'
};

const StagePanel = ({
	effect,
	width = 430,
	height = 560
}: {
	effect: StageEffectName;
	width?: number;
	height?: number;
}) => {
	const hostRef = useRef<HTMLDivElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const phase = useStageEffect(effect, { hostRef, canvasRef });

	return (
		<Box sx={{ width }}>
			<Typography
				sx={{ fontSize: 12, fontWeight: 700, mb: 0.5, minHeight: 32 }}
			>
				{LABELS[effect]}
			</Typography>
			<Typography
				sx={{
					fontSize: 11,
					fontFamily: 'monospace',
					color: 'text.secondary',
					mb: 1
				}}
			>
				chunk: {phase}
			</Typography>
			<Box
				ref={hostRef}
				sx={{
					position: 'relative',
					width,
					height,
					overflow: 'hidden',
					borderRadius: 2,
					cursor: 'crosshair',
					background:
						'linear-gradient(152deg,#da2530 0%,#c0121f 46%,#7c0d15 100%)'
				}}
			>
				<Box
					component="canvas"
					ref={canvasRef}
					sx={{
						position: 'absolute',
						inset: 0,
						width: '100%',
						height: '100%'
					}}
				/>
				<Box
					sx={{
						position: 'relative',
						height: '100%',
						display: 'flex',
						flexDirection: 'column',
						alignItems: 'center',
						justifyContent: 'center',
						color: '#fff',
						pointerEvents: 'none'
					}}
				>
					{/* Typography defaults to text.primary and ignores an
					    inherited colour, so white has to be set here. */}
					<Typography
						sx={{
							fontSize: 32,
							fontWeight: 600,
							lineHeight: 1.15,
							letterSpacing: '-0.5px',
							color: '#fff'
						}}
					>
						Beratung &amp; Hilfe
					</Typography>
					<Typography
						sx={{
							mt: 1.25,
							fontSize: 16,
							color: 'rgba(255,255,255,0.92)'
						}}
					>
						Online. Anonym. Sicher.
					</Typography>
				</Box>
			</Box>
		</Box>
	);
};

/** All four side by side. Move the cursor over each. */
export const AllVariants: StoryObj = {
	name: 'Alle vier Varianten',
	render: () => (
		<Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
			{STAGE_EFFECT_NAMES.map((effect) => (
				<StagePanel key={effect} effect={effect} />
			))}
		</Box>
	)
};

/**
 * Connected Dots with the carrier logos. Hover a logo to light its coverage.
 */
export const CarrierLights: StoryObj = {
	name: 'Connected Dots — Traeger-Abdeckung',
	parameters: {
		docs: {
			description: {
				story: COVERAGE_IS_PROVISIONAL
					? '⚠️ **Abdeckung ist noch nicht final.** Die Werte sind begruendete Schaetzungen aus den Selbstauskuenften der Traeger, nicht aus unseren Agency-Daten. Fuer echte Abdeckung braucht es einen Coverage-Endpunkt im AgencyService — dann wird `coverage.ts` ein duenner Adapter darueber. Bewusst ungleich: dass die Traeger einander ergaenzen, ist die Aussage.'
					: 'Abdeckung aus echten Agency-Daten.'
			}
		}
	},
	render: () => {
		const Demo = () => {
			const hostRef = useRef<HTMLDivElement>(null);
			const canvasRef = useRef<HTMLCanvasElement>(null);
			const effectRef = useRef<ConnectedDotsEffect | null>(null);
			const [active, setActive] = useState<string | null>(null);

			// The story drives the effect directly so the logo hover can reach
			// it; the real stage does the same through a ref.
			useEffect(() => {
				let cancelled = false;
				let frame: number | null = null;
				const run = async () => {
					const factory = await loadStageEffect('connectedDots');
					const host = hostRef.current;
					const canvas = canvasRef.current;
					if (!factory || !host || !canvas || cancelled) {
						return;
					}
					const dpr = Math.min(2, window.devicePixelRatio || 1);
					canvas.width = canvas.clientWidth * dpr;
					canvas.height = canvas.clientHeight * dpr;
					const effect = factory({
						canvas,
						host,
						width: canvas.clientWidth,
						height: canvas.clientHeight,
						intensity: 1,
						reducedMotion: false
					}) as ConnectedDotsEffect | null;
					if (!effect || cancelled) {
						return;
					}
					effectRef.current = effect;
					const startedAt = performance.now();
					const tick = () => {
						effect.frame((performance.now() - startedAt) / 1000);
						frame = requestAnimationFrame(tick);
					};
					frame = requestAnimationFrame(tick);
				};
				void run();
				return () => {
					cancelled = true;
					if (frame !== null) {
						cancelAnimationFrame(frame);
					}
					effectRef.current?.destroy?.();
				};
			}, []);

			useEffect(() => {
				effectRef.current?.setCarrier(active);
			}, [active]);

			return (
				<Box sx={{ width: 430 }}>
					<Typography sx={{ fontSize: 12, fontWeight: 700, mb: 1 }}>
						Auf einen Traeger zeigen — die Lichter zeichnen seine
						Abdeckung
					</Typography>
					<Box
						ref={hostRef}
						sx={{
							position: 'relative',
							width: 430,
							height: 640,
							overflow: 'hidden',
							borderRadius: 2,
							background:
								'linear-gradient(152deg,#c8161f 0%,#a5000a 48%,#6d0a11 100%)'
						}}
					>
						<Box
							component="canvas"
							ref={canvasRef}
							sx={{
								position: 'absolute',
								inset: 0,
								width: '100%',
								height: '100%'
							}}
						/>
						<Box
							sx={{
								position: 'relative',
								height: '100%',
								display: 'flex',
								flexDirection: 'column',
								alignItems: 'center',
								justifyContent: 'flex-end',
								p: 3,
								color: '#fff'
							}}
						>
							{/* The real marks from the design, at the sizes it
							    specifies: resting at 60% opacity, lifting on
							    hover. Focus does the same, so the map is
							    reachable from the keyboard. */}
							<Box
								component="ul"
								sx={{
									display: 'flex',
									flexWrap: 'wrap',
									justifyContent: 'center',
									alignItems: 'flex-end',
									gap: '14px 18px',
									width: 300,
									m: 0,
									p: 0,
									mb: 3,
									listStyle: 'none'
								}}
							>
								{CARRIERS.map((carrier) => (
									<Box
										component="li"
										key={carrier.id}
										sx={{ display: 'flex' }}
									>
										<Box
											component="button"
											type="button"
											aria-label={carrier.name}
											aria-pressed={active === carrier.id}
											onMouseEnter={() =>
												setActive(carrier.id)
											}
											onMouseLeave={() => setActive(null)}
											onFocus={() =>
												setActive(carrier.id)
											}
											onBlur={() => setActive(null)}
											sx={{
												'display': 'flex',
												'p': 0,
												'border': 'none',
												'background': 'none',
												'cursor': 'pointer',
												'opacity':
													active === carrier.id
														? 1
														: 0.6,
												'transform':
													active === carrier.id
														? 'translateY(-2px)'
														: 'none',
												'transition':
													'opacity 200ms ease, transform 200ms ease',
												'&:focus-visible': {
													outline: '2px solid #fff',
													outlineOffset: 3
												}
											}}
										>
											<Box
												component="img"
												src={carrier.logo}
												alt=""
												sx={{
													width: carrier.size,
													height: carrier.size
												}}
											/>
										</Box>
									</Box>
								))}
							</Box>
						</Box>
					</Box>
				</Box>
			);
		};
		return <Demo />;
	}
};
