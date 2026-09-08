import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box, SvgIcon } from '@mui/material';
import { AccountData } from './accountData/AccountData';
import { M3Dialog } from '../m3Dialog/M3Dialog';
import { RegistrationFooter } from '../registrationFooter/RegistrationFooter';
import { ReactComponent as DoorOpenIcon } from '../../resources/img/icons/navigation/door_open_400.svg';
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
import {
	desktop1440Globals,
	phone390Globals
} from '../message/messageStoryShell';

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
				{/* `minWidth: 0` is load-bearing: `.stageLayout__content` is a flex
				    container, and a flex item defaults to `min-width: auto`, so
				    without it this box refuses to shrink below the 540 px form
				    plus padding — 580 px inside a 375 px phone, clipped on both
				    sides (Frank, 2026-09-04). */}
				<Box
					sx={{
						width: '100%',
						minWidth: 0,
						maxWidth: '100%',
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
 * **Why `RegistrationStepNav` is not used here**, although it is the footer of
 * the four registration steps: it is built for exactly one action. Its primary
 * is a stretched bar with the arrow in its own disc, sized to fill the footer
 * alone. Put a second button next to it and the two read as different species —
 * Frank, 2026-09-04: "der Button links und der Button rechts, sie sind einfach
 * unterschiedlich, das sieht nicht gut aus."
 *
 * A link entry has two equal choices, so it gets two buttons of one geometry:
 * same height, same radius, same padding, same elevation — only the role
 * differs. Secondary is the way out, primary is the way on.
 *
 * That leaves a real gap for #1289: either `RegistrationStepNav` learns a
 * two-action shape, or a link entry keeps its own footer. This story is the
 * argument for deciding it rather than a decision made in passing.
 */
const EntryFooter = ({
	temporary,
	onToggleTemporary
}: {
	temporary: boolean;
	onToggleTemporary: () => void;
}) => (
	<RegistrationFooter
		secondary={{
			label: temporary ? 'Konto anlegen' : 'Ohne Konto beitreten',
			onClick: onToggleTemporary
		}}
		primary={{ label: temporary ? 'Beitreten' : 'Registrieren' }}
	/>
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

/*
 * Every story pins its viewport, and every state is shown at both of them.
 *
 * ORISO-Frontend#1288 asks for the five states at 1440x900 and at 390x844, so
 * `globals` is set explicitly on all of them: a story that inherits whatever
 * width the preview pane happens to have proves nothing, and `desktop1440` is
 * the evidence viewport the ORISO Storybook gate reads.
 *
 * The pairs are not duplication. State 4 is the clearest case — the login
 * affordance is a labelled button from `lg` up and the door icon in the mobile
 * hero below it, so one state has two controls to judge, not one.
 *
 * States 2 and 3 are the two positions of one toggle rather than two screens:
 * `EntryScreen` holds `temporary` and the footer's secondary button flips it,
 * so the fields can be walked from one state into the other inside a single
 * story. That is the "toggleable, not two screens" requirement of #1288, and
 * the wrapper already satisfies it — nothing in `AccountData` has to change
 * for it, which is #1289's business anyway.
 */

export const FreshlyLoadedDesktop: StoryObj = {
	name: '1 — Frisch geladen, Desktop',
	globals: desktop1440Globals,
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

export const FreshlyLoadedMobile: StoryObj = {
	name: '1 — Frisch geladen, mobil',
	globals: phone390Globals,
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

export const TemporaryJoinDesktop: StoryObj = {
	name: '2 — Temporär beitreten, Desktop',
	globals: desktop1440Globals,
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

export const TemporaryJoinMobile: StoryObj = {
	name: '2 — Temporär beitreten, mobil',
	globals: phone390Globals,
	render: () => <EntryScreen startTemporary />,
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				story: 'Der temporäre Zustand auf dem Telefon. Ohne die beiden Passwortfelder bleibt wenig übrig — der Satz, dass dieses Gespräch mit dem Fenster endet, steht damit unübersehbar über dem Fuß statt wie am Desktop im leeren Raum daneben.'
			}
		}
	}
};

export const FullRegistrationDesktop: StoryObj = {
	name: '3 — Volle Registrierung, Desktop',
	globals: desktop1440Globals,
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

export const FullRegistrationMobile: StoryObj = {
	name: '3 — Volle Registrierung, mobil',
	globals: phone390Globals,
	render: () => <EntryScreen />,
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				story: 'Die volle Registrierung auf dem Telefon — die längste Fassung dieses Bildschirms. Hier ist zu sehen, ob die Spalte zwei Passwortfelder, Zustimmung und Fuß trägt, ohne dass die Zustimmung hinter dem Fuß verschwindet.'
			}
		}
	}
};

export const ExistingAccountDesktop: StoryObj = {
	name: '4 — Konto vorhanden, Desktop',
	globals: desktop1440Globals,
	render: () => <EntryScreen />,
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				story: 'Für jemanden, der schon ein Konto hat: oben rechts steht „Einloggen". Ohne diese Abzweigung bliebe nur, sich ein zweites Mal anzulegen — und die Einladung trägt Thema und Beratungsstelle ohnehin mit sich, die Anmeldung verliert also nichts davon. Zu beurteilen ist, ob der Weg sichtbar genug ist, ohne den Bildschirm gegen die Registrierung auszuspielen.'
			}
		}
	}
};

export const ExistingAccountMobile: StoryObj = {
	name: '4 — Konto vorhanden, mobil',
	globals: phone390Globals,
	render: () => <EntryScreen />,
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				story: 'Dieselbe Abzweigung auf dem Telefon, aber als anderes Bedienelement: den beschrifteten Button gibt es erst ab „lg", darunter übernimmt das Türsymbol in der Kopfleiste. Zu beurteilen ist, ob „Einloggen" ohne seine Beschriftung noch gefunden wird.'
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

export const AsDialogDesktop: StoryObj = {
	name: '5 — Als Dialog (mit Konto), Desktop',
	globals: desktop1440Globals,
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

export const AsDialogMobile: StoryObj = {
	name: '5 — Als Dialog (mit Konto), mobil',
	globals: phone390Globals,
	render: () => <EntryDialog />,
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				story: 'Der Dialog auf dem Telefon. Er soll das Gespräch dahinter überdecken und nicht ersetzen — zu beurteilen ist, wie viel Rand ihm bei 390 pt dafür bleibt und ob die zwei Aktionen nebeneinander noch Platz finden.'
			}
		}
	}
};

export const AsDialogTemporaryDesktop: StoryObj = {
	name: '6 — Als Dialog (temporär), Desktop',
	globals: desktop1440Globals,
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

export const AsDialogTemporaryMobile: StoryObj = {
	name: '6 — Als Dialog (temporär), mobil',
	globals: phone390Globals,
	render: () => <EntryDialog startTemporary />,
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				story: 'Der temporäre Dialog auf dem Telefon: die kürzeste Fassung überhaupt, weil die Passwortfelder fehlen. Der Hinweis, dass es keinen Weg zurück gibt, muss trotzdem vor den Aktionen stehen.'
			}
		}
	}
};
