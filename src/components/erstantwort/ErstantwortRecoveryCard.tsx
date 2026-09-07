import * as React from 'react';
import { Box, Typography } from '@mui/material';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import { stepperColors } from '../stepper/stepperDesign';
import {
	ErstantwortRecoverySteps,
	type ErstantwortRecoveryStep
} from './ErstantwortRecoverySteps';
import type { ErstantwortRecoveryState } from './erstantwortRecoveryCopy';

/**
 * Modul 3 — the part that lives **inside** the Carimat bubble, next to the
 * bubble's own text (the `slots` mechanism `SaveCredentialsCard` already uses).
 *
 * It is the one place that decides what each state shows inline, which is
 * exactly the decision the future wiring has to make:
 *
 * - **`notSecured`** — the walkthrough. The only state that asks for anything.
 * - **`secured`** — a quiet closing strip. The parked copy was deleted on
 *   confirmation and the server never held it, so instructions here would be
 *   instructions for a job that is done and cannot be redone.
 * - **`unsupported`** — nothing. There is no key on this client, and an empty
 *   stepper would be five steps toward a thing that does not exist.
 *
 * Holds no Matrix state: which state applies is read by the caller. See
 * `0 - Docs/VERDRAHTUNG-modul3-ersatzschluessel-2026-09-07.md`.
 */

export interface ErstantwortRecoveryCardProps {
	state: ErstantwortRecoveryState;
	steps: ErstantwortRecoveryStep[];
	/** 1-based step the pager opens on. */
	initialStep?: number;
	illustrationHeight?: number;
}

export const ErstantwortRecoveryCard: React.FC<
	ErstantwortRecoveryCardProps
> = ({ state, steps, initialStep, illustrationHeight }) => {
	if (state === 'unsupported') {
		return null;
	}

	if (state === 'secured') {
		return (
			<Box
				data-testid="erstantwort-recovery-card"
				data-state={state}
				sx={{
					'display': 'flex',
					'alignItems': 'center',
					'gap': '10px',
					'marginTop': '12px',
					'padding': '10px 12px',
					'borderRadius': '12px',
					/* `surfaceContainer` is the bubble's own tone, so a strip
					   painted with it is invisible inside the bubble. The one
					   step lighter reads as a panel without adding a border. */
					'bgcolor': stepperColors.surface,
					'color': stepperColors.onSurface,
					'& svg': {
						fontSize: 20,
						color: stepperColors.primary,
						flexShrink: 0
					}
				}}
			>
				<CheckCircleRoundedIcon aria-hidden />
				<Typography sx={{ fontSize: 14, fontWeight: 600 }}>
					Alle Schritte erledigt
				</Typography>
				{/* The dot row from the walkthrough, all filled — the sequence
				    visibly closes instead of just disappearing. Decorative: the
				    line beside it already says the same thing. */}
				<Box
					aria-hidden
					sx={{
						display: 'flex',
						gap: '6px',
						marginLeft: 'auto',
						alignItems: 'center'
					}}
				>
					{steps.map((step) => (
						<Box
							key={step.id}
							sx={{
								width: 8,
								height: 8,
								borderRadius: 999,
								bgcolor: stepperColors.primary
							}}
						/>
					))}
				</Box>
			</Box>
		);
	}

	return (
		<Box data-testid="erstantwort-recovery-card" data-state={state}>
			<ErstantwortRecoverySteps
				steps={steps}
				initialStep={initialStep}
				illustrationHeight={illustrationHeight}
			/>
		</Box>
	);
};
