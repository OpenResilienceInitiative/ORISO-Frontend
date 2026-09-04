import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box, Button, SvgIcon } from '@mui/material';
import { AccountData } from './accountData/AccountData';
import { M3Dialog } from '../m3Dialog/M3Dialog';
import { ReactComponent as DoorOpenIcon } from '../../resources/img/icons/navigation/door_open_400.svg';
import { RegistrationStepNav } from './registrationStepNav/RegistrationStepNav';
import { registrationMd3 } from './registrationDesign/registrationDesign';
import { StageLayout } from '../stageLayout/StageLayout';
import { Stage } from '../stage/stage';
import { AgencySpecificContext } from '../../globalState';
import { RegistrationContext } from '../../globalState/provider/RegistrationProvider';
import {
	LegalLinksContext,
	TProvidedLegalLink
} from '../../globalState/provider/LegalLinksProvider';
import {
	AgencyDataInterface,
	TopicsDataInterface
} from '../../globalState/interfaces';
import { phone375Globals } from '../message/messageStoryShell';

/**
 * Approval surface for the **link variant** of "Anmeldedaten erfassen".
 *
 * Nothing here is wired into the live flow. This is the shape that
 * ORISO-Frontend#1288 asks to be judged before #1289 implements it.
 *
 * Why this screen differs from registration step 4: an invitation already
 * carries topic and agency, so the four-step progress rail and the selection
 * chips would both describe steps the person never walked. What is still
 * missing is only who they are — and, if they want to come back, a password.
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

/* The consent sentence is not decoration and not optional. It is resolved from
   the Fachbereich (Beratungsstelle x Thema) — a Träger with its own published
   policy replaces the platform wording, everything else falls back to the
   static sentence (ADR-021). `AccountData` reads both out of
   `RegistrationContext`; without them the checkbox renders bare, which is
   exactly what the first draft of this story got wrong.

   A link entry has no selection steps, but it does have a Fachbereich — the
   invitation carries it. So the context is provided here the same way the real
   registration provides it, and nothing about the consent path changes. */
const agency = {
	id: 1,
	name: 'Caritas Berlin — Hospiz- und Palliativberatung',
	postcode: '10117',
	city: 'Berlin',
	description: '',
	teamAgency: false,
	consultingType: 1,
	external: false
} as unknown as AgencyDataInterface;

const mainTopic = {
	id: 5,
	name: 'Hospiz- und Palliativberatung',
	description: '',
	status: 'ACTIVE'
} as unknown as TopicsDataInterface;

const legalLinks: TProvidedLegalLink[] = [
	{
		label: 'login.legal.infoText.dataprotection',
		registration: true,
		getUrl: () => 'https://oriso.example/datenschutz'
	} as TProvidedLegalLink,
	{
		label: 'login.legal.infoText.impressum',
		registration: true,
		getUrl: () => 'https://oriso.example/impressum'
	} as TProvidedLegalLink
];

const WithRegistrationContext = ({
	children
}: {
	children: React.ReactNode;
}) => (
	<LegalLinksContext.Provider value={legalLinks}>
		<RegistrationContext.Provider
			value={{
				registrationData: { agency, mainTopic } as never,
				setDisabledNextButton: () => undefined
			}}
		>
			{children}
		</RegistrationContext.Provider>
	</LegalLinksContext.Provider>
);

/**
 * The stage the link variant stands on.
 *
 * `showLoginLink` is **on** here, deliberately: someone arriving by link may
 * already have an account, and offering them the login on this screen is point
 * (d) of the entry composition. That is the opposite of the post-registration
 * handover, where the same button is wrong because the person is already
 * signed in (ORISO-Frontend#1291).
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
				{/* The footer is fixed, so the column has to reserve its height
				    or the consent checkbox disappears behind it. */}
				<Box
					sx={{
						px: { xs: 2.5, sm: 5 },
						pt: { xs: 3, sm: 4 },
						pb: { xs: '128px', sm: '136px' }
					}}
				>
					{children}
				</Box>
			</StageLayout>
		</AgencySpecificContext.Provider>
	</Box>
);

/**
 * The footer, positioned exactly like the real registration footer
 * (`Registration.tsx:730-750`): fixed to the bottom right, full width on mobile
 * and `60vw` from `lg` up so it spans the content column and stops at the red
 * panel. That is also why the stage's legal links stay readable — a footer that
 * merely sticks inside the content column, as the first draft did, lands on top
 * of them.
 *
 * The hairline is `outlineVariant`, the same token the real footer uses. The
 * darker rule in the first draft was not a design choice, it was a mistake.
 *
 * Two open points this story deliberately makes visible rather than fakes away,
 * both belonging to #1289:
 *
 * 1. `RegistrationStepNav` always renders a back circle — the house rule says
 *    disable, never hide, which is right for step 1 of 4. A link entry has no
 *    previous step at all, so the circle is not "disabled", it is meaningless.
 *    Frank, 2026-09-04, marked it for removal. It is suppressed here with a
 *    single CSS rule so the target state can be judged; the component needs a
 *    way to express "there is no back" instead.
 * 2. The component has no slot for a second action. The temporary-join choice
 *    needs one, so it sits beside the component here.
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
			'position': 'fixed',
			'bottom': 0,
			'right': 0,
			'width': { xs: '100vw', lg: '60vw' },
			'minHeight': { sm: '96px' },
			'backgroundColor': 'rgba(255, 255, 255, 0.94)',
			'backdropFilter': 'blur(8px)',
			'borderTop': `1px solid ${registrationMd3.outlineVariant}`,
			'display': 'flex',
			'alignItems': 'center',
			'gap': 2,
			'pt': { xs: 1.5, sm: 0 },
			'pb': {
				xs: 'calc(12px + env(safe-area-inset-bottom))',
				sm: 0
			},
			'px': { xs: 2, sm: 3, lg: 4 },
			'zIndex': 65,
			/* See point 1 above: the back circle is the first child of
			   `RegistrationStepNav` and has nowhere to lead on a link entry. */
			'& .registration-entry-nav > * > *:first-of-type': {
				display: 'none'
			}
		}}
	>
		<Button
			variant="outlined"
			onClick={onToggleTemporary}
			sx={{
				'flex': '0 1 auto',
				'textTransform': 'none',
				'borderRadius': '28px',
				'minHeight': 56,
				'px': 3,
				'fontSize': 16,
				'fontWeight': 600,
				'whiteSpace': 'nowrap',
				'color': registrationMd3.onSurface,
				'borderColor': registrationMd3.outline,
				'backgroundColor': registrationMd3.surfaceContainerLow,
				/* Frank, 2026-09-04: "Button also needs footer shadow then."
				   The primary pill carries the footer's elevation; a flat
				   secondary next to it reads as a different layer. Same
				   shadow, so the two sit on one plane. */
				'boxShadow': '0 2px 8px rgba(0, 0, 0, 0.12)',
				'&:hover': {
					borderColor: registrationMd3.onSurface,
					backgroundColor: registrationMd3.surfaceContainer,
					boxShadow: '0 4px 12px rgba(0, 0, 0, 0.16)'
				}
			}}
		>
			{temporary ? 'Konto anlegen' : 'Ohne Konto beitreten'}
		</Button>
		<Box
			className="registration-entry-nav"
			sx={{ flex: '1 1 240px', minWidth: 0 }}
		>
			<RegistrationStepNav
				prevStepUrl={null}
				backLabel="Zurück"
				nextStepUrl={null}
				nextLabel={temporary ? 'Beitreten' : 'Registrieren'}
				registerLabel={temporary ? 'Beitreten' : 'Registrieren'}
				registeringLabel={
					temporary ? 'Wird beigetreten …' : 'Wird registriert …'
				}
			/>
		</Box>
	</Box>
);

const EntryScreen = ({
	startTemporary = false
}: {
	startTemporary?: boolean;
}) => {
	const [temporary, setTemporary] = useState(startTemporary);
	return (
		<WithRegistrationContext>
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
		</WithRegistrationContext>
	);
};

export const FreshlyLoaded: StoryObj = {
	name: '1 — Frisch geladen',
	render: () => <EntryScreen />,
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				story: 'Ein Name steht schon da, das Passwort ist leer. Kein Fortschrittsbalken, keine Auswahl-Chips — beides beschriebe Schritte, die es hier nie gab. Oben rechts bleibt „Einloggen", weil jemand mit Konto genau hier abbiegen können muss. Die Datenschutz-Zustimmung lädt wie in der Registrierung aus dem Fachbereich.'
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
				story: 'Das Passwort wird erzeugt und nicht gezeigt. Aus „Registrieren" wird „Beitreten". Statt der Passwortfelder steht der Satz, der heute im Live-Chat fehlt: dass dieses Gespräch mit dem Fenster endet. Die Zustimmung bleibt Pflicht — sie hängt am Fachbereich, nicht daran, ob ein Konto entsteht.'
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
 * The same content as a dialog — with the same two choices.
 *
 * Frank, 2026-09-04: booking an appointment from inside a chat should not throw
 * the person out of the conversation. The first draft of this story showed only
 * the temporary state, which read as a decision it never was: the dialog needs
 * both ways too, and the consent sentence just the same.
 */
const EntryDialog = ({
	startTemporary = false
}: {
	startTemporary?: boolean;
}) => {
	const [temporary, setTemporary] = useState(startTemporary);
	return (
		<WithRegistrationContext>
			<Box sx={{ minHeight: '100vh', bgcolor: registrationMd3.surface }}>
				<M3Dialog
					open
					icon={
						<SvgIcon
							component={DoorOpenIcon}
							inheritViewBox
							sx={{ fontSize: 32 }}
						/>
					}
					title="Termin buchen"
					description="Nur ein Name — alles Weitere bringt der Link mit."
					onClose={() => undefined}
					closeLabel="Schließen"
					actions={[
						{
							label: temporary
								? 'Konto anlegen'
								: 'Ohne Konto beitreten',
							onClick: () => setTemporary((v) => !v)
						},
						{
							label: temporary ? 'Beitreten' : 'Registrieren',
							onClick: () => undefined,
							primary: true
						}
					]}
				>
					<AccountData
						onChange={() => undefined}
						entry="link"
						temporary={temporary}
						compact
					/>
				</M3Dialog>
			</Box>
		</WithRegistrationContext>
	);
};

export const AsDialog: StoryObj = {
	name: '5 — Als Dialog (mit Konto)',
	render: () => <EntryDialog />,
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				story: 'Gleicher Inhalt, anderer Behälter — und dieselben zwei Wege. Für „aus dem Chat heraus einen Termin buchen" ist der Dialog die bessere Form: der Mensch verliert das Gespräch nicht aus dem Blick.'
			}
		}
	}
};

export const AsDialogTemporary: StoryObj = {
	name: '6 — Als Dialog (temporär)',
	render: () => <EntryDialog startTemporary />,
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				story: 'Der Dialog im temporären Zustand. Auch hier gilt die Zustimmung, auch hier steht der Hinweis, dass es keinen Weg zurück gibt.'
			}
		}
	}
};
