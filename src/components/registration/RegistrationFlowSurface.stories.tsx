import * as React from 'react';
import { useMemo, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box, Typography } from '@mui/material';
import PlaceRoundedIcon from '@mui/icons-material/PlaceRounded';
import { RegistrationProvider } from '../../globalState';
import { TopicSelection } from './topicSelection/TopicSelection';
import { ZipcodeInput } from './zipcodeInput/ZipcodeInput';
import { AgencySelection } from './agencySelection/AgencySelection';
import { AccountData } from './accountData/AccountData';
import { RegistrationHeader } from './registrationHeader/RegistrationHeader';
import { RegistrationStepNav } from './registrationStepNav/RegistrationStepNav';
import { RegistrationSelectionChip } from './selectionChips/RegistrationSelectionChips';
import { registrationMd3 } from './registrationDesign/registrationDesign';
import {
	APP_ORISO_FIGMA_URL,
	ORISO_M3_FIGMA_URL
} from '../storybookDesignLinks';

/**
 * Composite review surface for the registration flow.
 *
 * Every panel below renders the **product component** — `TopicSelection`,
 * `ZipcodeInput`, `AgencySelection`, `AccountData` — inside the real
 * `RegistrationProvider` and the real chrome (`RegistrationHeader` +
 * `RegistrationStepNav`). Nothing here is rebuilt for the story: what you see is
 * what registration ships, including its own copy, icons, validation and
 * disabled-state logic. Topics and agencies come from the Storybook API
 * fixtures in `.storybook/preview.tsx`.
 *
 * The routed flow with real step navigation lives in
 * `REGISTRATION/Registration runtime`; this surface exists to review all four
 * steps at once without clicking through them.
 */

const STEPS = [
	{ name: 'topic-selection', label: 'Thema' },
	{ name: 'zipcode', label: 'Postleitzahl' },
	{ name: 'agency-selection', label: 'Beratungsstelle' },
	{ name: 'account-data', label: 'Anmeldedaten' }
] as const;

type StepName = (typeof STEPS)[number]['name'];

const STEP_NAMES = STEPS.map((step) => step.name);

const noop = () => undefined;

/** The four real step bodies, keyed by step name. */
const StepBody = ({ step }: { step: StepName }) => {
	switch (step) {
		case 'topic-selection':
			return (
				<TopicSelection
					onChange={noop}
					onNextClick={noop}
					nextStepUrl="/registration/zipcode"
				/>
			);
		case 'zipcode':
			return <ZipcodeInput onChange={noop} />;
		case 'agency-selection':
			return (
				<AgencySelection
					onChange={noop}
					onNextClick={noop}
					nextStepUrl="/registration/account-data"
				/>
			);
		case 'account-data':
		default:
			return <AccountData onChange={noop} />;
	}
};

/**
 * One step in its chrome. `layout` is passed explicitly because MUI breakpoints
 * follow the **browser viewport**, not the story frame — a panel rendered at
 * 375 pt inside a wide window would otherwise pick the desktop header.
 */
const StepPanel = ({
	step,
	layout,
	width,
	chips
}: {
	step: StepName;
	layout: 'compact' | 'stepper';
	width: number;
	chips?: RegistrationSelectionChip[];
}) => {
	const index = STEP_NAMES.indexOf(step);

	return (
		<Box
			sx={{
				width,
				maxWidth: '100%',
				display: 'flex',
				flexDirection: 'column',
				bgcolor: registrationMd3.surface,
				border: '1px solid rgba(0,0,0,.14)',
				borderRadius: 2,
				overflow: 'hidden'
			}}
		>
			<RegistrationHeader
				fullBleed={false}
				layout={layout}
				currentStepName={step}
				visibleStepNames={[...STEP_NAMES]}
				clickableStepNames={STEP_NAMES.slice(0, index)}
				onStepClick={noop}
				chips={chips}
			/>
			<Box
				sx={{
					flex: 1,
					minHeight: 0,
					overflowY: 'auto',
					px: layout === 'compact' ? 2 : 3,
					pt: 2.5,
					pb: 3
				}}
			>
				<StepBody step={step} />
			</Box>
			<Box
				sx={{
					flex: 'none',
					borderTop: `1px solid ${registrationMd3.outlineVariant}`,
					p: 2
				}}
			>
				<RegistrationStepNav
					prevStepUrl={index === 0 ? null : '/back'}
					backLabel="Zurück"
					nextStepUrl={
						index === STEP_NAMES.length - 1 ? null : '/next'
					}
					nextLabel="Weiter"
					registerLabel="Registrieren"
					registeringLabel="Wird registriert …"
				/>
			</Box>
		</Box>
	);
};

const Caption = ({ children }: { children: React.ReactNode }) => (
	<Typography
		sx={{ fontSize: 12, fontWeight: 700, mb: 1.5, color: 'text.secondary' }}
	>
		{children}
	</Typography>
);

/** Chips as the flow builds them up: topic first, then the fixed postcode. */
const useChips = (step: StepName): RegistrationSelectionChip[] => {
	const index = STEP_NAMES.indexOf(step);

	return useMemo(() => {
		const chips: RegistrationSelectionChip[] = [];
		if (index >= 1) {
			chips.push({
				key: 'topic',
				label: 'Allgemeine Sozialberatung',
				onDelete: noop,
				deleteAriaLabel: 'Thema entfernen'
			});
		}
		if (index >= 2) {
			chips.push({
				key: 'zipcode',
				label: '50667',
				iconNode: <PlaceRoundedIcon />,
				fixed: true,
				onDelete: noop,
				deleteAriaLabel: 'Postleitzahl entfernen'
			});
		}
		return chips;
	}, [index]);
};

function RegistrationFlowSurface({
	layout = 'stepper',
	width = 900
}: {
	layout?: 'compact' | 'stepper';
	width?: number;
}) {
	const [step, setStep] = useState<StepName>('topic-selection');
	const chips = useChips(step);

	return (
		<RegistrationProvider>
			<Box sx={{ display: 'grid', gap: 2, justifyItems: 'start' }}>
				<Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
					{STEPS.map((entry) => (
						<Box
							key={entry.name}
							component="button"
							type="button"
							onClick={() => setStep(entry.name)}
							sx={{
								border: `1px solid ${registrationMd3.outline}`,
								borderRadius: '999px',
								px: 1.75,
								py: 0.75,
								fontSize: 13,
								fontWeight: 700,
								cursor: 'pointer',
								bgcolor:
									step === entry.name
										? registrationMd3.primary
										: 'transparent',
								// Buttons inherit the surrounding colour, but only
								// because this is a plain Box — Typography would
								// resolve to text.primary and go black on red.
								color:
									step === entry.name
										? registrationMd3.onPrimary
										: registrationMd3.onSurfaceVariant
							}}
						>
							{entry.label}
						</Box>
					))}
				</Box>
				<StepPanel
					step={step}
					layout={layout}
					width={width}
					chips={chips}
				/>
			</Box>
		</RegistrationProvider>
	);
}

const meta = {
	title: 'REGISTRATION/Registration flow surface',
	component: RegistrationFlowSurface,
	tags: ['autodocs'],
	parameters: {
		layout: 'padded',
		design: [
			{
				type: 'figma',
				name: 'App.Oriso registration context',
				url: APP_ORISO_FIGMA_URL
			},
			{
				type: 'figma',
				name: 'Design System M3 ORISO',
				url: ORISO_M3_FIGMA_URL
			}
		],
		docs: {
			description: {
				component:
					'All four registration steps rendered from the **product components** inside the real `RegistrationProvider` and the real header/footer chrome — no story-local rebuild, no fake topic or agency data. Use the switcher to move between steps. The routed flow with real navigation is in `REGISTRATION/Registration runtime`.'
			}
		}
	}
} satisfies Meta<typeof RegistrationFlowSurface>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Desktop: Story = {
	render: () => <RegistrationFlowSurface layout="stepper" width={900} />
};

export const Mobile: Story = {
	name: 'Mobil (375)',
	render: () => <RegistrationFlowSurface layout="compact" width={375} />
};

/** Every step side by side — the review view, no clicking required. */
export const AllSteps: Story = {
	name: 'Alle Schritte nebeneinander',
	render: () => (
		<RegistrationProvider>
			<Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
				{STEPS.map((entry, index) => (
					<Box key={entry.name}>
						<Caption>
							{index + 1}. {entry.label}
						</Caption>
						<Box sx={{ height: 760, display: 'flex' }}>
							<StepPanel
								step={entry.name}
								layout="compact"
								width={375}
								chips={
									index === 0
										? []
										: [
												{
													key: 'topic',
													label: 'Allgemeine Sozialberatung',
													onDelete: noop,
													deleteAriaLabel:
														'Thema entfernen'
												},
												...(index >= 2
													? [
															{
																key: 'zipcode',
																label: '50667',
																iconNode: (
																	<PlaceRoundedIcon />
																),
																fixed: true,
																onDelete: noop,
																deleteAriaLabel:
																	'Postleitzahl entfernen'
															}
														]
													: [])
											]
								}
							/>
						</Box>
					</Box>
				))}
			</Box>
		</RegistrationProvider>
	)
};
