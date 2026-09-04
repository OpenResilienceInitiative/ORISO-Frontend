import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box, Button, Dialog, Typography } from '@mui/material';
import { AccountData } from './accountData/AccountData';
import { registrationMd3 } from './registrationDesign/registrationDesign';
import { StageLayout } from '../stageLayout/StageLayout';
import { Stage } from '../stage/stage';
import { AgencySpecificContext } from '../../globalState';
import { phone375Globals } from '../message/messageStoryShell';

/**
 * Approval surface for the **link variant** of "Anmeldedaten erfassen".
 *
 * Nothing here is wired into the live flow. This is the shape that
 * ORISO-Frontend#1288 asks to be judged before #1289 implements it.
 *
 * What a link entry is, and why this screen differs from registration step 4:
 * an invitation already carries topic and agency, so the four-step stepper and
 * the selection chips would both describe steps the person never walked. What
 * is still missing is only who they are — and, if they want to come back, a
 * password.
 */
const meta: Meta = {
	title: 'Registration/Entry room — link variant',
	parameters: {
		docs: {
			description: {
				component:
					'Der Bildschirm, den jemand sieht, der über einen Link kommt — Live-Chat, Selbsthilfegruppe, Call oder Terminbuchung. Nichts davon ist verdrahtet; das ist die Abnahmefläche zu ORISO-Frontend#1288.'
			}
		}
	}
};

export default meta;

/**
 * The stage the link variant stands on.
 *
 * `showLoginLink` is **on** here, and that is deliberate: someone arriving by
 * link may well already have an account, and offering them the login on this
 * screen is point (d) of the entry composition. That is the opposite of the
 * handover screen after registration, where the same button is wrong because
 * the person is already signed in (ORISO-Frontend#1291).
 */
const EntryStage = ({ children }: { children: React.ReactNode }) => (
	<Box sx={{ minHeight: '100vh' }}>
		<AgencySpecificContext.Provider
			value={{ specificAgency: null, setSpecificAgency: () => undefined }}
		>
			<StageLayout
				className="stageLayout--registration"
				showLegalLinks={true}
				showLoginLink={true}
				showRegistrationLink={false}
				stage={<Stage hasAnimation={false} />}
				mobileHero="bar"
			>
				<Box sx={{ px: { xs: 2.5, sm: 5 }, pt: { xs: 3, sm: 4 } }}>
					{children}
				</Box>
			</StageLayout>
		</AgencySpecificContext.Provider>
	</Box>
);

/**
 * The footer of the link variant.
 *
 * Two things are gone against registration step 4: the selection chips
 * ("Hospiz- und Palliativb… ✕", "77777 ✕"), because nothing was selected here,
 * and the four-step progress rail above the form.
 *
 * One thing is new: the temporary-join control. Frank put it in the footer, so
 * it sits next to the decision it changes — the primary button relabels from
 * "Registrieren" to "Beitreten" the moment it is on.
 */
const EntryFooter = ({
	temporary,
	onToggleTemporary
}: {
	temporary: boolean;
	onToggleTemporary: () => void;
}) => (
	<Box
		sx={{
			position: 'sticky',
			bottom: 0,
			mt: 3,
			bgcolor: '#fff',
			borderTop: `1px solid ${registrationMd3.outlineVariant}`,
			px: { xs: 2, sm: 5 },
			py: 2,
			display: 'flex',
			flexWrap: 'wrap',
			gap: 1.5,
			alignItems: 'center',
			justifyContent: 'space-between'
		}}
	>
		<Button
			onClick={onToggleTemporary}
			sx={{ textTransform: 'none', color: registrationMd3.onSurface }}
		>
			{temporary ? 'Doch ein Konto anlegen' : 'Ohne Konto beitreten'}
		</Button>
		<Button
			variant="contained"
			sx={{
				textTransform: 'none',
				bgcolor: registrationMd3.primary,
				px: 3
			}}
		>
			{temporary ? 'Beitreten' : 'Registrieren'}
		</Button>
	</Box>
);

const EntryScreen = ({
	startTemporary = false
}: {
	startTemporary?: boolean;
}) => {
	const [temporary, setTemporary] = useState(startTemporary);
	return (
		<EntryStage>
			<AccountData
				onChange={() => undefined}
				entry="link"
				temporary={temporary}
			/>
			<EntryFooter
				temporary={temporary}
				onToggleTemporary={() => setTemporary((v) => !v)}
			/>
		</EntryStage>
	);
};

export const FreshlyLoaded: StoryObj = {
	name: '1 — Frisch geladen',
	render: () => <EntryScreen />,
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				story: 'Ein Name steht schon da, das Passwort ist leer. Kein Fortschrittsbalken, keine Auswahl-Chips — beides beschriebe Schritte, die es hier nie gab. Oben rechts bleibt „Einloggen", weil jemand mit Konto genau hier abbiegen können muss.'
			}
		}
	}
};

export const TemporaryJoin: StoryObj = {
	name: '2 — Temporär beitreten',
	render: () => <EntryScreen startTemporary />,
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				story: 'Das Passwort wird erzeugt und nicht gezeigt — als wäre der Vorschlagsknopf einmal unsichtbar gedrückt worden. Aus „Registrieren" wird „Beitreten". Statt der Passwortfelder steht dort der Satz, der heute im Live-Chat fehlt: dass dieses Gespräch mit dem Fenster endet. Die Datenschutz-Zustimmung bleibt Pflicht.'
			}
		}
	}
};

export const FullRegistration: StoryObj = {
	name: '3 — Volle Registrierung',
	render: () => <EntryScreen />,
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				story: 'Derselbe Bildschirm, wenn der Mensch ein Konto will: eigenes Passwort, „Registrieren", und er kann später zurückkehren. Der Unterschied zu Zustand 1 ist nur, was er tut — nicht, was er sieht.'
			}
		}
	}
};

export const Mobile: StoryObj = {
	name: '4 — Mobil (390 pt)',
	globals: phone375Globals,
	render: () => <EntryScreen />,
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				story: 'Dieselbe Zusammenstellung auf dem Telefon. Der Fuß bleibt klebend, damit die Entscheidung „temporär oder Konto" nicht unter der Tastatur verschwindet.'
			}
		}
	}
};

/**
 * The same content as a dialog.
 *
 * Frank, 2026-09-04: booking an appointment from inside a chat should not throw
 * the person out of the conversation. Same fields, same rules, different
 * container — put side by side so it can be decided whether one component can
 * serve both, or whether the dialog needs its own.
 */
export const AsDialog: StoryObj = {
	name: '5 — Als Dialog statt Bildschirm',
	render: () => (
		<Box sx={{ minHeight: '100vh', bgcolor: registrationMd3.surface }}>
			<Dialog open fullWidth maxWidth="sm" onClose={() => undefined}>
				<Box sx={{ p: 3 }}>
					<Typography
						sx={{
							fontSize: 13,
							letterSpacing: '.08em',
							textTransform: 'uppercase',
							color: registrationMd3.onSurfaceVariant,
							mb: 1
						}}
					>
						Termin buchen
					</Typography>
					<AccountData
						onChange={() => undefined}
						entry="link"
						temporary
					/>
					<Box
						sx={{
							mt: 3,
							display: 'flex',
							justifyContent: 'flex-end',
							gap: 1
						}}
					>
						<Button sx={{ textTransform: 'none' }}>
							Abbrechen
						</Button>
						<Button
							variant="contained"
							sx={{
								textTransform: 'none',
								bgcolor: registrationMd3.primary
							}}
						>
							Beitreten
						</Button>
					</Box>
				</Box>
			</Dialog>
		</Box>
	),
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				story: 'Gleicher Inhalt, anderer Behälter. Für „aus dem Chat heraus einen Termin buchen" ist der Dialog die bessere Form — der Mensch verliert das Gespräch nicht aus dem Blick.'
			}
		}
	}
};
