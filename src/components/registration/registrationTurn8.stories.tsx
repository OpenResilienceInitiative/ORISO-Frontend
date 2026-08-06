import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box, Typography } from '@mui/material';
import PlaceRoundedIcon from '@mui/icons-material/PlaceRounded';
import { RegistrationHeader } from './registrationHeader/RegistrationHeader';
import { RegistrationStepNav } from './registrationStepNav/RegistrationStepNav';
import { RegistrationSelectionChip } from './selectionChips/RegistrationSelectionChips';
import { ZipcodeInput } from './zipcodeInput/ZipcodeInput';
import { WhyLocalDisclosure } from './zipcodeInput/WhyLocalDisclosure';
import { RegistrationHandover } from '../app/registrationLoader/RegistrationHandover';
import { HandoverGateButton } from '../app/registrationLoader/HandoverGateButton';
import { HandoverGateState } from '../app/registrationLoader/handoverGate';
import { registrationMd3 } from './registrationDesign/registrationDesign';

const meta: Meta = {
	title: 'Registration/Turn 8 — Mobile Dichte',
	// No Router decorator here: the Storybook preview already provides one, and
	// nesting a second router throws.
	parameters: {
		docs: {
			description: {
				component:
					'Implementation of design turn 8 ("Finale"). Approval surface — nothing here is wired into the live registration flow yet. Card artwork is still a placeholder; the finals are being delivered separately.'
			}
		}
	}
};

export default meta;

const STEP_NAMES = [
	'topic-selection',
	'zipcode',
	'agency-selection',
	'account-data'
];

const CHIPS: RegistrationSelectionChip[] = [
	{
		key: 'topic',
		label: 'Allgemeine Sozialberatung',
		onDelete: () => undefined,
		deleteAriaLabel: 'Thema entfernen'
	},
	{
		key: 'zipcode',
		label: '10117',
		iconNode: <PlaceRoundedIcon />,
		fixed: true,
		onDelete: () => undefined,
		deleteAriaLabel: 'Postleitzahl entfernen'
	}
];

const Phone = ({ children }: { children: React.ReactNode }) => (
	<Box
		sx={{
			width: 375,
			height: 784,
			position: 'relative',
			display: 'flex',
			flexDirection: 'column',
			overflow: 'hidden',
			bgcolor: registrationMd3.surface,
			border: '1px solid rgba(0,0,0,.14)',
			borderRadius: 2
		}}
	>
		{children}
	</Box>
);

const Caption = ({ children }: { children: React.ReactNode }) => (
	<Typography
		sx={{ fontSize: 12, fontWeight: 700, mb: 1.5, color: 'text.secondary' }}
	>
		{children}
	</Typography>
);

/**
 * Header + F3 footer, the chrome shared by every step.
 *
 * MUI breakpoints follow the **browser viewport**, not the story frame — set
 * Storybook's viewport to 375 pt to see the mobile header, or widen it past
 * `sm` (600 pt) to see the icon stepper.
 */
export const ChromeMobile: StoryObj = {
	name: 'Kopf + F3-Fuss (mobil, Viewport 375)',
	parameters: {
		docs: {
			description: {
				story: 'Kopf = 40 pt Fortschrittszeile + 38 pt Chip-Zeile (78 pt statt ~150 pt Icon-Stepper). Ohne Auswahl entfaellt die Chip-Zeile ganz.'
			}
		}
	},
	render: () => (
		<Box sx={{ width: 375 }}>
			<Caption>Mit Auswahl</Caption>
			<Box sx={{ border: '1px solid rgba(0,0,0,.14)', mb: 3 }}>
				<RegistrationHeader
					fullBleed={false}
					layout="compact"
					currentStepName="zipcode"
					visibleStepNames={STEP_NAMES}
					chips={CHIPS}
				/>
			</Box>
			<Caption>Ohne Auswahl — Chip-Zeile entfaellt</Caption>
			<Box sx={{ border: '1px solid rgba(0,0,0,.14)', mb: 3 }}>
				<RegistrationHeader
					fullBleed={false}
					layout="compact"
					currentStepName="topic-selection"
					visibleStepNames={STEP_NAMES}
				/>
			</Box>
			<Caption>F3-Fuss — aktiv / deaktiviert / erster Schritt</Caption>
			<Box
				sx={{
					p: 2,
					bgcolor: '#fff',
					border: '1px solid rgba(0,0,0,.14)',
					display: 'flex',
					flexDirection: 'column',
					gap: 2
				}}
			>
				<RegistrationStepNav
					prevStepUrl="/back"
					backLabel="Zurueck"
					nextStepUrl="/next"
					nextLabel="Weiter"
					registerLabel="Registrieren"
					registeringLabel="Wird registriert ..."
				/>
				<RegistrationStepNav
					prevStepUrl="/back"
					backLabel="Zurueck"
					nextStepUrl="/next"
					nextLabel="Weiter"
					registerLabel="Registrieren"
					registeringLabel="Wird registriert ..."
					disabledNext
				/>
				<RegistrationStepNav
					prevStepUrl={null}
					backLabel="Zurueck"
					nextStepUrl={null}
					nextLabel="Weiter"
					registerLabel="Registrieren"
					registeringLabel="Wird registriert ..."
					isRegistering
				/>
			</Box>
		</Box>
	)
};

/** Desktop header: icon stepper kept, dead space and doubled rule removed. */
export const ChromeDesktop: StoryObj = {
	name: 'Kopf (Desktop) — entspacet',
	render: () => (
		<Box sx={{ width: 1040 }}>
			<Caption>
				Desktop behaelt den Icon-Stepper. Weg sind der leere Streifen
				unter den Labels und die doppelte Linie — jetzt ein Divider in
				default outline.
			</Caption>
			<Box sx={{ border: '1px solid rgba(0,0,0,.14)', bgcolor: '#fff' }}>
				<RegistrationHeader
					fullBleed={false}
					layout="stepper"
					currentStepName="account-data"
					visibleStepNames={STEP_NAMES}
					clickableStepNames={['topic-selection', 'zipcode']}
					onStepClick={() => undefined}
					chips={CHIPS}
				/>
				<Box sx={{ p: 3 }}>
					<Typography sx={{ fontSize: 22, fontWeight: 700 }}>
						Anmeldedaten erfassen
					</Typography>
				</Box>
			</Box>
		</Box>
	)
};

/** 8a — the postcode step, rendering the real `ZipcodeInput`. */
export const ZipcodeStep: StoryObj = {
	name: '8a — Postleitzahl',
	parameters: {
		docs: {
			description: {
				story: 'Der echte Schritt, nicht nachgebaut: Ziffer eingeben springt weiter, Ruecktaste auf leerem Feld springt zurueck, Einfuegen fuellt die ganze Zeile. Der Aufklapper ist zu — die vier Motive laden erst beim Oeffnen. **Bilder sind Platzhalter.**'
			}
		}
	},
	render: () => (
		<Phone>
			<RegistrationHeader
				fullBleed={false}
				layout="compact"
				currentStepName="zipcode"
				visibleStepNames={STEP_NAMES}
				chips={[CHIPS[0]]}
			/>
			<Box
				sx={{
					flex: 1,
					minHeight: 0,
					overflowY: 'auto',
					px: 2,
					pt: 4
				}}
			>
				<ZipcodeInput onChange={() => undefined} />
			</Box>
			<Box
				sx={{
					flex: 'none',
					bgcolor: '#fff',
					borderTop: `1px solid ${registrationMd3.outlineVariant}`,
					p: 2
				}}
			>
				<RegistrationStepNav
					prevStepUrl="/back"
					backLabel="Zurueck"
					nextStepUrl="/next"
					nextLabel="Weiter"
					registerLabel="Registrieren"
					registeringLabel="Wird registriert ..."
				/>
			</Box>
		</Phone>
	)
};

/** The disclosure on its own, open, so the four motifs are reviewable. */
export const WhyLocalOpen: StoryObj = {
	name: '8a — Aufklapper "Warum lokal beraten?"',
	render: () => (
		<Box sx={{ width: 343 }}>
			<Caption>
				Platzhalter-Motive — die finalen 48-pt-Bilder ersetzen sie in
				einer Datei (registrationArtwork.ts).
			</Caption>
			<WhyLocalDisclosure />
		</Box>
	)
};

/** 8c/8d — the handover screen, at every gate state. */
export const HandoverGateStates: StoryObj = {
	name: 'Gate-Zustände (Button)',
	render: () => {
		const states: HandoverGateState[] = [
			'preparing',
			'verifying',
			'queued',
			'ready',
			'slow',
			'entering'
		];
		return (
			<Box
				sx={{
					width: 420,
					display: 'flex',
					flexDirection: 'column',
					gap: 2.5
				}}
			>
				<Caption>
					Nur `ready` und `slow` sind klickbar. `verifying` und
					`queued` sind für Altcha bzw. Server-Überlast reserviert und
					heute nicht verdrahtet.
				</Caption>
				{states.map((state) => (
					<Box key={state}>
						<Typography
							sx={{
								fontSize: 11,
								fontFamily: 'monospace',
								mb: 0.5
							}}
						>
							{state}
						</Typography>
						<HandoverGateButton
							state={state}
							onEnter={() => undefined}
						/>
					</Box>
				))}
			</Box>
		);
	}
};

export const HandoverMobile: StoryObj = {
	name: '8c — Geschafft (mobil)',
	render: () => (
		<Box
			sx={{
				width: 375,
				height: 784,
				position: 'relative',
				overflow: 'hidden',
				border: '1px solid rgba(0,0,0,.14)',
				borderRadius: 2
			}}
		>
			<RegistrationHandover
				ready={false}
				onEnter={() => undefined}
				forcedState="preparing"
			/>
		</Box>
	),
	parameters: {
		layout: 'centered',
		docs: {
			description: {
				story: 'Ladephase: Text steht sofort, der Button ist zu. Die Karten sind horizontal wischbar. **Bilder sind Platzhalter.**'
			}
		}
	}
};

export const HandoverMobileReady: StoryObj = {
	name: '8c — Geschafft (bereit)',
	render: () => (
		<Box
			sx={{
				width: 375,
				height: 784,
				position: 'relative',
				overflow: 'hidden',
				border: '1px solid rgba(0,0,0,.14)',
				borderRadius: 2
			}}
		>
			<RegistrationHandover ready onEnter={() => undefined} />
		</Box>
	),
	parameters: { layout: 'centered' }
};

export const HandoverDesktop: StoryObj = {
	name: '8d — Geschafft (Desktop)',
	render: () => (
		<Box
			sx={{
				width: 1120,
				height: 760,
				position: 'relative',
				overflow: 'hidden',
				border: '1px solid rgba(0,0,0,.14)',
				borderRadius: 2
			}}
		>
			<RegistrationHandover ready onEnter={() => undefined} />
		</Box>
	),
	parameters: { layout: 'centered' }
};
