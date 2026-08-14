import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box, Typography } from '@mui/material';
import CenterFocusStrongRoundedIcon from '@mui/icons-material/CenterFocusStrongRounded';
import PlaceRoundedIcon from '@mui/icons-material/PlaceRounded';
import ApartmentRoundedIcon from '@mui/icons-material/ApartmentRounded';
import HowToRegRoundedIcon from '@mui/icons-material/HowToRegRounded';
import ChatBubbleRoundedIcon from '@mui/icons-material/ChatBubbleRounded';
import ShieldRoundedIcon from '@mui/icons-material/ShieldRounded';
import MailRoundedIcon from '@mui/icons-material/MailRounded';
import { StepDot } from './atoms/StepDot';
import { StepConnector } from './atoms/StepConnector';
import { StepLabel } from './atoms/StepLabel';
import { StepSegments } from './atoms/StepSegments';
import { IconStepper } from './molecules/IconStepper';
import { CompactStepRow } from './molecules/CompactStepRow';
import { phone375Globals } from '../message/messageStoryShell';

const meta: Meta = {
	title: 'Molecules/Stepper',
	parameters: {
		docs: {
			description: {
				component:
					'One step indicator for the whole product. Before this, the registration flow (MUI `sx`, 44 px circles) and the setup dialogs (BEM SCSS, 34 px circles) each carried their own copy and had drifted apart. Atoms: StepDot, StepConnector, StepLabel, StepSegments.'
			}
		}
	}
};

export default meta;

const REGISTRATION_STEPS = [
	{
		name: 'topic-selection',
		label: 'Thema wählen',
		icon: <CenterFocusStrongRoundedIcon />
	},
	{ name: 'zipcode', label: 'Postleitzahl', icon: <PlaceRoundedIcon /> },
	{
		name: 'agency-selection',
		label: 'Beratungsstelle',
		icon: <ApartmentRoundedIcon />
	},
	{
		name: 'account-data',
		label: 'Registrieren',
		icon: <HowToRegRoundedIcon />
	},
	{
		name: 'request',
		label: 'Anfrage stellen',
		icon: <ChatBubbleRoundedIcon />
	}
];

const DIALOG_STEPS = [
	{ name: 'decision', label: 'Methode', icon: <ShieldRoundedIcon /> },
	{ name: 'email', label: 'E-Mail', icon: <MailRoundedIcon /> },
	{ name: 'verify', label: 'Bestätigen', icon: <HowToRegRoundedIcon /> }
];

const Caption = ({ children }: { children: React.ReactNode }) => (
	<Typography
		sx={{ fontSize: 12, fontWeight: 700, mb: 1.5, color: 'text.secondary' }}
	>
		{children}
	</Typography>
);

const Panel = ({
	title,
	children
}: {
	title: string;
	children: React.ReactNode;
}) => (
	<Box sx={{ mb: 5 }}>
		<Caption>{title}</Caption>
		<Box
			sx={{
				p: 3,
				bgcolor: '#fff',
				border: '1px solid rgba(0,0,0,.12)',
				borderRadius: 2
			}}
		>
			{children}
		</Box>
	</Box>
);

/** The four atoms in every state, so drift is visible at a glance. */
export const Atoms: StoryObj = {
	render: () => (
		<Box sx={{ maxWidth: 820 }}>
			<Panel title="StepDot — md (44 px, desktop registration)">
				<Box sx={{ display: 'flex', gap: 3, alignItems: 'center' }}>
					<StepDot state="done" icon={<PlaceRoundedIcon />} />
					<StepDot state="active" icon={<PlaceRoundedIcon />} />
					<StepDot state="pending" icon={<PlaceRoundedIcon />} />
				</Box>
			</Panel>
			<Panel title="StepDot — sm (34 px, dialogs; no ring around active)">
				<Box sx={{ display: 'flex', gap: 3, alignItems: 'center' }}>
					<StepDot
						state="done"
						size="sm"
						emphasizeActive={false}
						icon={<MailRoundedIcon />}
					/>
					<StepDot
						state="active"
						size="sm"
						emphasizeActive={false}
						icon={<MailRoundedIcon />}
					/>
					<StepDot
						state="pending"
						size="sm"
						emphasizeActive={false}
						icon={<MailRoundedIcon />}
					/>
				</Box>
			</Panel>
			<Panel title="StepConnector — passed vs. ahead">
				<Box sx={{ display: 'flex', width: 320 }}>
					<StepConnector done />
					<StepConnector done={false} />
				</Box>
			</Panel>
			<Panel title="StepLabel">
				<Box sx={{ display: 'flex', gap: 4 }}>
					<StepLabel state="done">Beratungsstelle</StepLabel>
					<StepLabel state="active">Beratungsstelle</StepLabel>
					<StepLabel state="pending">Beratungsstelle</StepLabel>
				</Box>
			</Panel>
			<Panel title="StepSegments — 4 steps, 7 steps (collapses to a track above 6)">
				<Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
					<StepSegments total={4} current={2} />
					<StepSegments total={7} current={3} />
				</Box>
			</Panel>
		</Box>
	)
};

/** Desktop registration header. Frank 2026-08-06: desktop keeps this. */
export const IconStepperDesktop: StoryObj = {
	render: () => (
		<Box sx={{ maxWidth: 820 }}>
			<Panel title="Registrierung — Schritt 2 von 5 (md, 44 px)">
				<IconStepper
					steps={REGISTRATION_STEPS}
					currentStepName="zipcode"
					ariaLabel="Registrierung"
				/>
			</Panel>
			<Panel title="Dialog-Größe (sm, 34 px) — Vorschlag für den 2FA-Dialog">
				<IconStepper
					steps={DIALOG_STEPS}
					currentStepName="email"
					size="sm"
					emphasizeActive={false}
					ariaLabel="Zwei-Faktor-Einrichtung"
				/>
			</Panel>
		</Box>
	),
	parameters: {
		docs: {
			description: {
				story: 'The `sm` variant is a **proposal** for `TwoFactorSetupDialog`. That dialog still renders its own SCSS stepper — rewiring it is a separate slice and needs sign-off, because "done" would change from an outlined circle to a filled check.'
			}
		}
	}
};

/** Mobile registration header row. Replaces the icon stepper below `sm`. */
export const CompactRowMobile: StoryObj = {
	globals: phone375Globals,
	render: () => (
		<Box sx={{ maxWidth: 375 }}>
			<Panel title="375 pt — Schritt 2 von 4">
				<CompactStepRow current={2} total={4} label="Postleitzahl" />
			</Panel>
			<Panel title="Langes Label (Ellipsis statt Umbruch)">
				<CompactStepRow
					current={3}
					total={4}
					label="Beratungsstelle auswählen und bestätigen"
				/>
			</Panel>
			<Panel title="7 Schritte — Segmente werden zur Spur">
				<CompactStepRow current={5} total={7} label="Registrieren" />
			</Panel>
		</Box>
	)
};
