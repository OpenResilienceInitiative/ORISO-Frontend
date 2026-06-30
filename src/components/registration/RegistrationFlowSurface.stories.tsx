import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import {
	Box,
	Button,
	Checkbox,
	Chip,
	FormControlLabel,
	Radio,
	Typography
} from '@mui/material';
import PlaceRoundedIcon from '@mui/icons-material/PlaceRounded';
import TaskAltRoundedIcon from '@mui/icons-material/TaskAltRounded';
import { StepBar } from './stepBar/StepBar';
import { OrisoTextField } from '../form/OrisoTextField';

const ORISO_M3_FIGMA_URL =
	'https://www.figma.com/design/RTUi1rcrEWECXz8rNFmj7Q/Design-System-M3_ORISO?node-id=60853-24182&p=f&t=ieIskw4Lz5hlc7iM-0';
const APP_ORISO_FIGMA_URL =
	'https://www.figma.com/design/L2mOFNSGdxPPx1XA4HFAog/App.Oriso?node-id=316-17725&t=XHH5HQNmA8DUWl2U-0';

const topics = [
	{
		id: 'family',
		label: 'Familienberatung',
		group: 'Familie und Beziehungen',
		description: 'Unterstuetzung bei Konflikten, Trennung und Erziehung.'
	},
	{
		id: 'addiction',
		label: 'Suchtberatung',
		group: 'Gesundheit',
		description: 'Beratung fuer Betroffene und Angehoerige.'
	},
	{
		id: 'u25',
		label: 'U25 Suizidpraevention',
		group: 'Krisenberatung',
		description: 'Niedrigschwellige Hilfe fuer junge Menschen.'
	}
];

const agencies = [
	{
		id: 'caritas',
		name: 'Caritas Berlin Mitte',
		meta: '10115 Berlin | Online und vor Ort',
		availability: 'Antwort meist innerhalb von 24 Stunden'
	},
	{
		id: 'oriso',
		name: 'ORISO Familienberatung',
		meta: 'Bundesweit | Online',
		availability: 'Freie Beratungskapazitaet'
	}
];

function RegistrationFlowSurface() {
	const [selectedTopic, setSelectedTopic] = useState('family');
	const [selectedAgency, setSelectedAgency] = useState('caritas');
	const [zipcode, setZipcode] = useState('10115');

	return (
		<Box sx={styles.viewport}>
			<Box sx={styles.shell}>
				<Box sx={styles.header}>
					<Box>
						<Typography variant="overline" sx={styles.overline}>
							Neue Registrierung
						</Typography>
						<Typography variant="h3" sx={styles.title}>
							Beratung finden und Konto anlegen
						</Typography>
					</Box>
					<Box sx={styles.stepper}>
						<StepBar currentStep={2} maxNumberOfSteps={5} />
					</Box>
				</Box>

				<Box sx={styles.grid}>
					<Box sx={styles.topicPanel}>
						<Typography variant="h5" sx={styles.sectionTitle}>
							Thema waehlen
						</Typography>
						<Typography sx={styles.sectionCopy}>
							Gruppierte Themenkarte mit eindeutiger Auswahl und
							Beschreibung.
						</Typography>
						<Box sx={styles.topicList} role="radiogroup">
							{topics.map((topic) => {
								const selected = selectedTopic === topic.id;
								return (
									<Box
										key={topic.id}
										component="button"
										type="button"
										onClick={() =>
											setSelectedTopic(topic.id)
										}
										sx={{
											...styles.topicButton,
											...(selected
												? styles.topicButtonSelected
												: {})
										}}
									>
										<Radio
											checked={selected}
											tabIndex={-1}
											sx={styles.radio}
										/>
										<Box sx={{ minWidth: 0 }}>
											<Chip
												label={topic.group}
												size="small"
												sx={styles.topicChip}
											/>
											<Typography sx={styles.topicName}>
												{topic.label}
											</Typography>
											<Typography sx={styles.topicText}>
												{topic.description}
											</Typography>
										</Box>
									</Box>
								);
							})}
						</Box>
					</Box>

					<Box sx={styles.flowPanel}>
						<Box sx={styles.zipcodeBand}>
							<Box sx={styles.iconCircle}>
								<PlaceRoundedIcon />
							</Box>
							<Box sx={{ flex: 1, minWidth: 0 }}>
								<Typography
									variant="h5"
									sx={styles.sectionTitle}
								>
									Postleitzahl
								</Typography>
								<Typography sx={styles.sectionCopy}>
									Die Auswahl grenzt passende Beratungsstellen
									ein.
								</Typography>
							</Box>
							<Box sx={styles.zipcodeField}>
								<OrisoTextField
									value={zipcode}
									onChange={(event) =>
										setZipcode(
											event.target.value
												.replace(/\D/g, '')
												.slice(0, 5)
										)
									}
									placeholder="10115"
									fullWidth
									inputProps={{
										'aria-label': 'Postleitzahl',
										'inputMode': 'numeric',
										'maxLength': 5
									}}
								/>
							</Box>
						</Box>

						<Box sx={styles.agencySection}>
							<Typography variant="h5" sx={styles.sectionTitle}>
								Beratungsstelle auswaehlen
							</Typography>
							<Box sx={styles.agencyGrid}>
								{agencies.map((agency) => {
									const selected =
										selectedAgency === agency.id;
									return (
										<Box
											key={agency.id}
											component="button"
											type="button"
											onClick={() =>
												setSelectedAgency(agency.id)
											}
											sx={{
												...styles.agencyCard,
												...(selected
													? styles.agencyCardSelected
													: {})
											}}
										>
											<Box sx={styles.agencyCardTop}>
												<Typography
													sx={styles.agencyName}
												>
													{agency.name}
												</Typography>
												{selected && (
													<TaskAltRoundedIcon
														sx={styles.checkIcon}
													/>
												)}
											</Box>
											<Typography sx={styles.agencyMeta}>
												{agency.meta}
											</Typography>
											<Typography
												sx={styles.agencyAvailability}
											>
												{agency.availability}
											</Typography>
										</Box>
									);
								})}
							</Box>
						</Box>

						<Box sx={styles.accountPanel}>
							<Box>
								<Typography
									variant="h5"
									sx={styles.sectionTitle}
								>
									Konto vorbereiten
								</Typography>
								<Typography sx={styles.sectionCopy}>
									Der Schritt nutzt dieselben ORISO TextFields
									wie die Formular-Stories, aber im echten
									Registrierungszusammenhang.
								</Typography>
							</Box>
							<Box sx={styles.accountFields}>
								<OrisoTextField
									label="E-Mail"
									defaultValue="alice@example.invalid"
								/>
								<OrisoTextField
									label="Passwort"
									type="password"
									defaultValue="storybook"
								/>
								<FormControlLabel
									control={<Checkbox defaultChecked />}
									label="Datenschutz akzeptiert"
									sx={styles.checkbox}
								/>
							</Box>
						</Box>
					</Box>
				</Box>

				<Box sx={styles.actions}>
					<Button variant="outlined">Zurueck</Button>
					<Button variant="contained">Weiter</Button>
				</Box>
			</Box>
		</Box>
	);
}

const meta = {
	title: 'REGISTRATION/Registration flow surface',
	component: RegistrationFlowSurface,
	tags: ['autodocs'],
	parameters: {
		layout: 'fullscreen',
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
					'Composite registration Storybook MCP target: StepBar, topic choice, zipcode input, agency cards and account fields in one M3-oriented registration surface. This fills the gap between isolated registration atoms and the full routed registration flow, which still needs API/provider mocks.'
			}
		}
	}
} satisfies Meta<typeof RegistrationFlowSurface>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	render: () => <RegistrationFlowSurface />
};

const styles = {
	viewport: {
		minHeight: 860,
		background: '#EAE7E8',
		p: 4,
		color: '#1D1B20'
	},
	shell: {
		maxWidth: 1180,
		mx: 'auto'
	},
	header: {
		display: 'grid',
		gridTemplateColumns: { xs: '1fr', md: '1fr 360px' },
		gap: 4,
		alignItems: 'start',
		mb: 4
	},
	overline: {
		color: '#A5000A',
		fontWeight: 800,
		letterSpacing: 0
	},
	title: {
		fontWeight: 750,
		lineHeight: 1.12,
		maxWidth: 680
	},
	stepper: {
		bgcolor: '#F6F3F3',
		borderRadius: '24px',
		p: 3,
		border: '1px solid rgba(29, 27, 32, 0.08)'
	},
	grid: {
		display: 'grid',
		gridTemplateColumns: { xs: '1fr', lg: '420px minmax(0, 1fr)' },
		gap: 3
	},
	topicPanel: {
		bgcolor: '#F6F3F3',
		borderRadius: '28px',
		p: 3,
		border: '1px solid rgba(29, 27, 32, 0.08)'
	},
	flowPanel: {
		display: 'grid',
		gap: 3
	},
	sectionTitle: {
		fontWeight: 750,
		mb: 0.5
	},
	sectionCopy: {
		color: '#4C555F',
		fontSize: 15,
		lineHeight: '22px'
	},
	topicList: {
		display: 'grid',
		gap: 1.5,
		mt: 3
	},
	topicButton: {
		display: 'grid',
		gridTemplateColumns: '44px minmax(0, 1fr)',
		gap: 1.5,
		width: '100%',
		textAlign: 'left',
		border: '1px solid #E4E2E2',
		bgcolor: '#FFFFFF',
		borderRadius: '24px',
		p: 2,
		cursor: 'pointer'
	},
	topicButtonSelected: {
		borderColor: '#CC1E1C',
		bgcolor: '#FFDAD5'
	},
	radio: {
		color: '#A5000A',
		alignSelf: 'start'
	},
	topicChip: {
		bgcolor: '#646D78',
		color: '#FFFFFF',
		fontWeight: 700,
		mb: 1
	},
	topicName: {
		fontSize: 18,
		lineHeight: '26px',
		fontWeight: 750
	},
	topicText: {
		color: '#4C555F',
		fontSize: 14,
		lineHeight: '20px',
		mt: 0.5
	},
	zipcodeBand: {
		display: 'grid',
		gridTemplateColumns: { xs: '56px 1fr', md: '64px 1fr 220px' },
		gap: 2,
		alignItems: 'center',
		bgcolor: '#F6F3F3',
		borderRadius: '28px',
		p: 3,
		border: '1px solid rgba(29, 27, 32, 0.08)'
	},
	iconCircle: {
		width: 56,
		height: 56,
		borderRadius: '50%',
		display: 'grid',
		placeItems: 'center',
		bgcolor: '#FFDAD5',
		color: '#A5000A'
	},
	zipcodeField: {
		gridColumn: { xs: '1 / -1', md: 'auto' }
	},
	agencySection: {
		bgcolor: '#F6F3F3',
		borderRadius: '28px',
		p: 3,
		border: '1px solid rgba(29, 27, 32, 0.08)'
	},
	agencyGrid: {
		display: 'grid',
		gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
		gap: 2,
		mt: 2
	},
	agencyCard: {
		width: '100%',
		textAlign: 'left',
		border: '1px solid #E4E2E2',
		bgcolor: '#FFFFFF',
		borderRadius: '24px',
		p: 2.25,
		cursor: 'pointer'
	},
	agencyCardSelected: {
		borderColor: '#CC1E1C',
		boxShadow: '0 0 0 1px #CC1E1C'
	},
	agencyCardTop: {
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'space-between',
		gap: 2
	},
	agencyName: {
		fontWeight: 750,
		fontSize: 18,
		lineHeight: '26px'
	},
	checkIcon: {
		color: '#A5000A'
	},
	agencyMeta: {
		color: '#4C555F',
		mt: 1
	},
	agencyAvailability: {
		color: '#A5000A',
		mt: 1.5,
		fontWeight: 700
	},
	accountPanel: {
		display: 'grid',
		gridTemplateColumns: { xs: '1fr', md: '1fr 360px' },
		gap: 3,
		bgcolor: '#F6F3F3',
		borderRadius: '28px',
		p: 3,
		border: '1px solid rgba(29, 27, 32, 0.08)'
	},
	accountFields: {
		display: 'grid',
		gap: 1.5
	},
	checkbox: {
		color: '#4C555F'
	},
	actions: {
		display: 'flex',
		justifyContent: 'flex-end',
		gap: 2,
		mt: 3
	}
};
