import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box, Button, Typography, useMediaQuery } from '@mui/material';
import { Switch } from '../Switch';
import { AccountData } from '../registration/accountData/AccountData';
import { RegistrationFooter } from '../registrationFooter/RegistrationFooter';
import { RegistrationContext } from '../../globalState/provider/RegistrationProvider';
import {
	LegalLinksContext,
	TProvidedLegalLink
} from '../../globalState/provider/LegalLinksProvider';
import {
	AgencyDataInterface,
	TopicsDataInterface
} from '../../globalState/interfaces';
import { WaitingAreaCountdown } from './waitingClock/WaitingAreaCountdown';
import { WaitingAreaRules } from './WaitingAreaRules';
import { registrationMd3 } from '../registration/registrationDesign/registrationDesign';
import { StageLayout } from '../stageLayout/StageLayout';
import { Stage } from '../stage/stage';
import { AgencySpecificContext } from '../../globalState';
import { phone375Globals } from '../message/messageStoryShell';

/**
 * The self-help group entry room — every view a person passes through between
 * "I clicked the invitation" and "I am in the group".
 *
 * Frank, 2026-09-04: the clocks exist and are good, they are already in the
 * chat, and they belong here too. Seeing all the views next to each other is
 * what tells us which texts we actually need and whether a modal is required
 * mid-flow.
 *
 * What is deliberately reused, not rebuilt: `WaitingAreaCountdown` (design 4a/4b)
 * and `WaitingAreaRules` are the components `JoinGroupChatView` already renders.
 * Nothing here invents a second waiting room.
 *
 * The open product question these views are meant to settle: someone who joined
 * temporarily probably should not get the full waiting area with menus and
 * calendar export — they have no account to export to. The "plain" stories below
 * are the proposal for that; the "full" ones are what an account holder sees.
 */
const meta: Meta = {
	title: 'Group chat/Self-help entry room',
	parameters: {
		docs: {
			description: {
				component:
					'Alle Ansichten des Eintrittsraums für Selbsthilfegruppen, mit der vorhandenen Warteuhr. Abnahmefläche zu ORISO-Frontend#921 und #1293. Nichts davon ist verdrahtet.'
			}
		}
	}
};

export default meta;

const RULES = [
	'Was hier gesagt wird, bleibt hier.',
	'Jede Person spricht für sich selbst.',
	'Niemand muss etwas sagen.',
	'Wir lassen einander ausreden.'
];

const WELCOME =
	'Schön, dass Sie da sind. Ich bin Carimat und begleite die Gruppe heute.';

/* A fixed "now" so the story is stable: the countdown ticks live in the app but
   a moving clock makes a screenshot review impossible. */
const NOW = Date.UTC(2026, 8, 4, 14, 0, 0);
const IN_THREE_DAYS = new Date(NOW + 3 * 24 * 3600e3 + 5 * 3600e3 + 12 * 60e3);
const IN_TWELVE_MINUTES = new Date(NOW + 12 * 60e3);
const OVERDUE = new Date(NOW - 7 * 60e3);

/**
 * The waiting views on the split stage — Frank, 2026-09-04: "diese musst du jetzt
 * quasi in diesen halbierten Wartebildschirm einbauen auf Desktop".
 *
 * The same stage the entry screen stands on, so the person who just gave a name
 * does not land on a different-looking page one step later. Below the stage
 * breakpoint it collapses to the red brand bar, which is the mobile variant —
 * the one someone sees right after logging in, temporarily or permanently.
 *
 * `showLoginLink` is off here, unlike on the entry screen: at this point the
 * person is already in.
 */
const StagedRoom = ({ children }: { children: React.ReactNode }) => (
	<Box sx={{ minHeight: '100vh' }}>
		<AgencySpecificContext.Provider
			value={{ specificAgency: null, setSpecificAgency: () => undefined }}
		>
			<StageLayout
				className="stageLayout--registration"
				showLegalLinks={true}
				showLoginLink={false}
				showRegistrationLink={false}
				stage={<Stage hasAnimation={false} />}
				mobileHero="bar"
			>
				{/* Same flex trap as the entry screen: without `minWidth: 0` the
				    clock's four digit groups refuse to shrink and the column
				    overflows the phone. */}
				<Box
					sx={{
						width: '100%',
						minWidth: 0,
						maxWidth: '100%',
						px: { xs: 2, sm: 4 },
						py: { xs: 3, sm: 5 }
					}}
				>
					{children}
				</Box>
			</StageLayout>
		</AgencySpecificContext.Provider>
	</Box>
);

const Room = ({ children }: { children: React.ReactNode }) => (
	<Box
		sx={{
			minHeight: '100vh',
			bgcolor: registrationMd3.surface,
			display: 'flex',
			justifyContent: 'center',
			px: { xs: 2, sm: 4 },
			py: { xs: 3, sm: 5 }
		}}
	>
		<Box sx={{ width: '100%', maxWidth: 720 }}>{children}</Box>
	</Box>
);

const Caption = ({ children }: { children: React.ReactNode }) => (
	<Typography
		sx={{
			fontSize: 12,
			letterSpacing: '.08em',
			textTransform: 'uppercase',
			color: registrationMd3.onSurfaceVariant,
			mb: 1.5
		}}
	>
		{children}
	</Typography>
);

export const FarFuture: StoryObj = {
	name: '1 — Termin in drei Tagen',
	render: () => (
		<Room>
			<Caption>Eingeladen · Gruppe startet in drei Tagen</Caption>
			<WaitingAreaCountdown
				plannedStart={IN_THREE_DAYS}
				welcomeText={WELCOME}
				rules={RULES}
				nowMs={NOW}
			/>
		</Room>
	),
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				story: 'Der häufigste Fall: Der Link kommt Tage vorher. Die Uhr ist hier kein Countdown-Druck, sondern eine Zusage — der Termin steht, der Platz ist da. Die Karten lassen sich umdrehen: hinter den Zahlen stehen Begrüßung und Netiquette. Das ist der Ort für die Texte, die wir noch schreiben müssen.'
			}
		}
	}
};

export const MinutesAway: StoryObj = {
	name: '2 — Gleich geht es los',
	render: () => (
		<Room>
			<Caption>Eingeladen · Gruppe startet in wenigen Minuten</Caption>
			<WaitingAreaCountdown
				plannedStart={IN_TWELVE_MINUTES}
				welcomeText={WELCOME}
				rules={RULES}
				nowMs={NOW}
			/>
		</Room>
	),
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				story: 'Kurz davor. Hier entscheidet sich, ob die Uhr beruhigt oder drängt — dieselbe Anzeige, ganz andere Wirkung als in Ansicht 1. Wenn sie drängt, brauchen wir für diesen Bereich einen eigenen Text.'
			}
		}
	}
};

export const Overdue: StoryObj = {
	name: '3 — Läuft schon',
	render: () => (
		<Room>
			<Caption>Eingeladen · Gruppe läuft bereits</Caption>
			<WaitingAreaCountdown
				plannedStart={OVERDUE}
				welcomeText={WELCOME}
				rules={RULES}
				nowMs={NOW}
			/>
		</Room>
	),
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				story: 'Der Mensch kommt zu spät — oder klickt den Link, während die Gruppe schon spricht. Genau hier ist Franks offene Frage: braucht es an dieser Stelle ein Modal, das fragt „jetzt dazukommen?", statt ihn stumm hineinzuschieben? Die Uhr zählt heute einfach hoch.'
			}
		}
	}
};

export const PlainForTemporaryGuest: StoryObj = {
	name: '4 — Schlichte Ansicht (ohne Konto)',
	render: () => (
		<Room>
			<Caption>Ohne Konto beigetreten</Caption>
			<Box
				sx={{
					p: 3,
					borderRadius: '20px',
					border: `1px solid ${registrationMd3.outlineVariant}`,
					bgcolor: registrationMd3.surfaceContainerLowest
				}}
			>
				<Typography sx={{ fontSize: 22, fontWeight: 700, mb: '6px' }}>
					Sie sind angemeldet
				</Typography>
				<Typography
					sx={{
						fontSize: 15,
						color: registrationMd3.onSurfaceVariant,
						mb: '20px'
					}}
				>
					Die Gruppe beginnt in 12 Minuten. Noch ist niemand da — das
					ist normal.
				</Typography>
				<WaitingAreaRules rules={RULES} />
			</Box>
		</Room>
	),
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				story: 'Der Vorschlag für jemanden ohne Konto: dieselbe Information, ohne Kalender-Export und ohne Menüs, die ins Leere führen. „Noch ist niemand da — das ist normal" ist der wichtigste Satz auf diesem Bildschirm: ein leerer Raum kurz vor dem Start fühlt sich sonst nach einem Fehler an.'
			}
		}
	}
};

export const MobileFarFuture: StoryObj = {
	name: '5 — Mobil, Termin in drei Tagen',
	globals: phone375Globals,
	render: () => (
		<Room>
			<Caption>Mobil · in drei Tagen</Caption>
			<WaitingAreaCountdown
				plannedStart={IN_THREE_DAYS}
				welcomeText={WELCOME}
				rules={RULES}
				nowMs={NOW}
			/>
		</Room>
	),
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				story: 'Die Uhr auf 375 pt. Vier Zifferngruppen nebeneinander sind hier die Belastungsprobe — hier zeigt sich, ob sie umbrechen müssen.'
			}
		}
	}
};

export const MobileOverdue: StoryObj = {
	name: '6 — Mobil, läuft schon',
	globals: phone375Globals,
	render: () => (
		<Room>
			<Caption>Mobil · läuft bereits</Caption>
			<WaitingAreaCountdown
				plannedStart={OVERDUE}
				welcomeText={WELCOME}
				rules={RULES}
				nowMs={NOW}
			/>
		</Room>
	),
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				story: 'Der Überzieh-Zustand mobil. Achtung, bekannter Fehler: ab 100 überfälligen Minuten zeigt die Ziffernanzeige „00", während die Vorlesehilfe „100" ansagt — dokumentiert in ORISO-Frontend#1293.'
			}
		}
	}
};

export const ReducedMotion: StoryObj = {
	name: '7 — Ohne Bewegung',
	render: () => (
		<Room>
			<Caption>Bewegung abgeschaltet</Caption>
			<WaitingAreaCountdown
				plannedStart={IN_THREE_DAYS}
				welcomeText={WELCOME}
				rules={RULES}
				nowMs={NOW}
				reducedMotion
			/>
		</Room>
	),
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				story: 'Dieselbe Uhr für Menschen, die Bewegung nicht vertragen. Gehört in jede Abnahme: eine Warteansicht, die sich ständig bewegt, ist für manche unbenutzbar.'
			}
		}
	}
};

/* ---------------------------------------------------------------------------
   On the stage — the shape Frank asked to see: the halved desktop screen, and
   the same thing on a phone.
   --------------------------------------------------------------------------- */

export const StagedFarFuture: StoryObj = {
	name: '8 — Auf der Bühne, in drei Tagen',
	render: () => (
		<StagedRoom>
			<WaitingAreaCountdown
				plannedStart={IN_THREE_DAYS}
				welcomeText={WELCOME}
				rules={RULES}
				nowMs={NOW}
			/>
		</StagedRoom>
	),
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				story: 'Die Warteansicht auf derselben geteilten Bühne wie der Eintritts-Bildschirm: rote Markenseite links, Inhalt rechts. Wer gerade seinen Namen gegeben hat, landet einen Schritt später nicht auf einer fremd wirkenden Seite. Der „Einloggen"-Knopf fehlt hier absichtlich — an dieser Stelle ist der Mensch schon drin.'
			}
		}
	}
};

export const StagedMinutesAway: StoryObj = {
	name: '9 — Auf der Bühne, gleich geht es los',
	render: () => (
		<StagedRoom>
			<WaitingAreaCountdown
				plannedStart={IN_TWELVE_MINUTES}
				welcomeText={WELCOME}
				rules={RULES}
				nowMs={NOW}
			/>
		</StagedRoom>
	),
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				story: 'Kurz vor dem Start, auf der Bühne. Hier lohnt der Vergleich mit Ansicht 8: dieselbe Uhr, aber die Zahlen sind klein und die Fläche ist groß — auf Desktop wirkt das ruhiger als in der schmalen Spalte.'
			}
		}
	}
};

export const StagedMobile: StoryObj = {
	name: '10 — Auf der Bühne, mobil',
	globals: phone375Globals,
	render: () => (
		<StagedRoom>
			<WaitingAreaCountdown
				plannedStart={IN_THREE_DAYS}
				welcomeText={WELCOME}
				rules={RULES}
				nowMs={NOW}
			/>
		</StagedRoom>
	),
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				story: 'Dieselbe Bühne auf dem Telefon: aus der roten Fläche wird die schmale Markenleiste oben. Das ist die Ansicht direkt nach dem Anmelden — temporär oder mit Konto, der Bildschirm unterscheidet die beiden hier nicht.'
			}
		}
	}
};

export const StagedPlainGuest: StoryObj = {
	name: '11 — Auf der Bühne, ohne Konto',
	render: () => (
		<StagedRoom>
			<Box
				sx={{
					p: 3,
					borderRadius: '20px',
					border: `1px solid ${registrationMd3.outlineVariant}`,
					bgcolor: registrationMd3.surfaceContainerLowest,
					maxWidth: 560
				}}
			>
				<Typography sx={{ fontSize: 22, fontWeight: 700, mb: '6px' }}>
					Sie sind angemeldet
				</Typography>
				<Typography
					sx={{
						fontSize: 15,
						color: registrationMd3.onSurfaceVariant,
						mb: '20px'
					}}
				>
					Die Gruppe beginnt in 12 Minuten. Noch ist niemand da — das
					ist normal.
				</Typography>
				<WaitingAreaRules rules={RULES} />
			</Box>
		</StagedRoom>
	),
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				story: 'Die schlichte Ansicht auf der Bühne. Offene Produktentscheidung dahinter (Frank, 2026-09-04): wer die Gruppe anlegt, soll bestimmen können, ob nur temporäre Gäste hinein dürfen, ob beides erlaubt ist, oder ob ein Konto Pflicht ist. Diese Ansicht ist der Fall „temporär erlaubt".'
			}
		}
	}
};

/* ---------------------------------------------------------------------------
   Step 0 — the screen before the clock.
   The waiting views above are what someone sees once they are in. This is how
   they get there: the same entry composition as every other link, with the
   self-help group's own wording. Shown last in the file, first in the flow.
   --------------------------------------------------------------------------- */

const agency = {
	id: 88,
	name: 'Caritas Berlin — Selbsthilfegruppe Trauer',
	postcode: '10117',
	city: 'Berlin',
	description: '',
	teamAgency: false,
	consultingType: 1,
	external: false
} as unknown as AgencyDataInterface;

const groupTopic = {
	id: 9,
	name: 'Trauerbegleitung',
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

const GroupEntry = ({
	temporaryStart = true
}: {
	temporaryStart?: boolean;
}) => {
	const [temporary, setTemporary] = React.useState(temporaryStart);
	return (
		<LegalLinksContext.Provider value={legalLinks}>
			<RegistrationContext.Provider
				value={{
					registrationData: {
						agency,
						mainTopic: groupTopic
					} as never,
					setDisabledNextButton: () => undefined
				}}
			>
				<Box sx={{ minHeight: '100vh' }}>
					<AgencySpecificContext.Provider
						value={{
							specificAgency: null,
							setSpecificAgency: () => undefined
						}}
					>
						<StageLayout
							className="stageLayout--registration"
							showLegalLinks={true}
							showLoginLink={true}
							showRegistrationLink={false}
							stage={<Stage hasAnimation={false} />}
							mobileHero="bar"
						>
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
								<AccountData
									onChange={() => undefined}
									entry="link"
									temporary={temporary}
								/>
								<RegistrationFooter
									secondary={{
										label: temporary
											? 'Konto anlegen'
											: 'Ohne Konto beitreten',
										onClick: () => setTemporary((v) => !v)
									}}
									primary={{
										label: temporary
											? 'Der Gruppe beitreten'
											: 'Registrieren'
									}}
								/>
							</Box>
						</StageLayout>
					</AgencySpecificContext.Provider>
				</Box>
			</RegistrationContext.Provider>
		</LegalLinksContext.Provider>
	);
};

export const EntryScreenTemporary: StoryObj = {
	name: '0a — Eintritt: ohne Konto',
	render: () => <GroupEntry />,
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				story: 'Der Schritt vor der Uhr. Heute führt der Gruppen-Link auf die Anmeldeseite, und wer kein Konto hat, muss Thema, Postleitzahl und Beratungsstelle angeben — alles drei bringt der Link längst mit. Hier fehlt nur noch der Name. Die Hauptaktion heißt „Der Gruppe beitreten", nicht „Registrieren": das ist, was der Mensch vorhat.'
			}
		}
	}
};

export const EntryScreenWithAccount: StoryObj = {
	name: '0b — Eintritt: mit Konto',
	render: () => <GroupEntry temporaryStart={false} />,
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				story: 'Für jemanden, der wiederkommen will — bei einer Gruppe, die sich wöchentlich trifft, ist das der Normalfall und nicht die Ausnahme. Oben rechts steht „Einloggen" für die, die schon ein Konto haben; der Link muss die Anmeldung überleben, sonst landen sie in ihrer Sitzungsliste statt in der Gruppe.'
			}
		}
	}
};

/* ---------------------------------------------------------------------------
   12–14 — The block Frank drew (Figma, 2026-09-04): the clock fills the white
   column as one lattice, labels on the outer edges, the footer carries the
   three actions and the header carries the login.
   --------------------------------------------------------------------------- */

/**
 * Height the clock may take: the viewport minus what else has to fit — column
 * padding, the headline block under the clock, the footer bar, and on a phone
 * the red hero bar. The component only knows its width; the screen knows
 * this.
 */
const useClockHeight = () => {
	const measure = () => {
		const mobile = window.innerWidth < 1200;
		// Measured on the 1440 × 950 story: the stage header takes 96 px
		// (64 on a phone) and keeps 32 px under the column; the bar with its
		// aside row measures 105, plus 16 below it; the column 24 above; the
		// headline block and its gap (66 + 26); 24 px so a rounding error
		// never shows as a scrollbar.
		const reserved = (mobile ? 64 : 96) + 32 + 105 + 16 + 24 + 66 + 26 + 24;
		return Math.max(160, window.innerHeight - reserved);
	};
	const [height, setHeight] = React.useState(measure);
	React.useEffect(() => {
		const onResize = () => setHeight(measure());
		window.addEventListener('resize', onResize);
		return () => window.removeEventListener('resize', onResize);
	}, []);
	return height;
};

const BlockRoom = ({
	overdue = false,
	spacing = 'tight'
}: {
	overdue?: boolean;
	spacing?: 'tight' | 'airy';
}) => {
	const [motionOff, setMotionOff] = React.useState(false);
	const clockHeight = useClockHeight();
	const narrow = useMediaQuery('(max-width:1199px)');
	return (
		<Box sx={{ minHeight: '100vh' }}>
			<AgencySpecificContext.Provider
				value={{
					specificAgency: null,
					setSpecificAgency: () => undefined
				}}
			>
				<StageLayout
					className="stageLayout--registration"
					showLegalLinks={true}
					/* Frank's Figma forgot the login and he said so: someone
					   with an account logs in here and lands in the room. The
					   header link is where the registration already puts it. */
					showLoginLink={true}
					showRegistrationLink={false}
					stage={<Stage hasAnimation={false} />}
					mobileHero="bar"
				>
					<Box
						sx={{
							width: '100%',
							minWidth: 0,
							maxWidth: '100%',
							/* The stage header sits above this column and the
							   stage keeps 32 px under it, so a full 100vh here
							   always overflowed by exactly that (measured:
							   1078 px of page for a 950 px window). */
							minHeight: {
								xs: 'calc(100vh - 96px)',
								lg: 'calc(100vh - 128px)'
							},
							display: 'flex',
							flexDirection: 'column',
							justifyContent: 'center',
							px: { xs: 2, sm: 4 },
							pt: 3,
							/* Footer bar with its aside row (measured 105) plus
							   16 px — every pixel here is one the clock cannot
							   have. */
							pb: '121px'
						}}
					>
						<WaitingAreaCountdown
							plannedStart={overdue ? OVERDUE : IN_THREE_DAYS}
							welcomeText={WELCOME}
							rules={RULES}
							nowMs={NOW}
							/* Headline back on top: Frank, 2026-09-04, "das war
							   eigentlich gar nicht so schlecht, weil es da oben
							   war". The block below it runs down to the bar. */
							clockSize="fit"
							fitHeight={clockHeight}
							spacing={spacing}
							labelsOutside
							reducedMotion={motionOff}
							hideMotionToggle
						/>
						{/* The animation switch — the design system's own M3
						    `Switch`, the one the profile uses — and "Mehr
						    erfahren" ride on the bar, not in the page (Frank,
						    2026-09-04: "nicht frei schweben … am Footer
						    angeheftet"). That also hands the clock the rows
						    they used to take. */}
						{/* Desktop, as drawn: calendar beside a visible but shut
						    "Beitreten". On a phone two buttons is one too many
						    for the bar, so there the calendar has it alone and
						    "Beitreten" moves in once the time has passed —
						    Frank's own suggestion ("das Beitreten später
						    reinfahren"). */}
						<RegistrationFooter
							aside={
								<>
									<Box
										component="label"
										sx={{
											display: 'flex',
											alignItems: 'center',
											gap: 1.5,
											cursor: 'pointer'
										}}
									>
										<Switch
											checked={motionOff}
											onChange={(next) =>
												setMotionOff(next)
											}
											aria-label="Animation abschalten"
										/>
										<Typography
											sx={{
												fontSize: 13,
												whiteSpace: 'nowrap',
												color: registrationMd3.onSurfaceVariant
											}}
										>
											Animation abschalten
										</Typography>
									</Box>
									<Button
										variant="text"
										size="small"
										sx={{
											textTransform: 'none',
											whiteSpace: 'nowrap'
										}}
									>
										Mehr erfahren →
									</Button>
								</>
							}
							secondary={
								narrow
									? undefined
									: { label: 'Zum Kalender hinzufügen' }
							}
							primary={
								narrow
									? overdue
										? { label: 'Beitreten' }
										: { label: 'Zum Kalender hinzufügen' }
									: { label: 'Beitreten', disabled: !overdue }
							}
						/>
					</Box>
				</StageLayout>
			</AgencySpecificContext.Provider>
		</Box>
	);
};

export const BlockLayout: StoryObj = {
	name: '12 — Blockbild, eng verzahnt',
	render: () => <BlockRoom spacing="tight" />,
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				story: 'Franks Figma vom 4.9.: die Uhr als ein Gitter. Jeder Abstand — zwischen Zellen, zwischen den zwei Ziffern, zwischen den vier Gruppen — ist derselbe, deshalb liest sich das Ganze als ein Block und nicht als vier Bilder. Die Uhr misst ihre Spalte selbst und wird so groß, wie die weiße Fläche hergibt (vorher stand eine feste Zahl drin, die nur auf einer Bildschirmbreite stimmte). Die Beschriftungen der oberen Reihe stehen oben, die der unteren unten — zwischen den Reihen steht nichts. Der Titel wächst mit der Spalte bis 30 px. Im Fuß: Animation, Kalender, Beitreten — wie gezeichnet; „Beitreten" ist vor dem Termin sichtbar, aber gesperrt. Oben rechts „Einloggen" für die, die schon ein Konto haben.'
			}
		}
	}
};

export const BlockLayoutAiry: StoryObj = {
	name: '12b — Blockbild, mit etwas Luft',
	render: () => <BlockRoom spacing="airy" />,
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				story: 'Dieselbe Uhr, die zweite Variante aus Franks Nachricht: Ziffern und Gruppen bekommen ein wenig Abstand (35 % bzw. 55 % einer Zelle). Nur zum Vergleich neben 12 — die Entscheidung ist seine.'
			}
		}
	}
};

export const BlockLayoutOverdue: StoryObj = {
	name: '13 — Blockbild, läuft schon',
	render: () => <BlockRoom overdue />,
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				story: 'Der Termin ist vorbei: „Beitreten" im Fuß ist jetzt frei, sonst ändert sich an der Leiste nichts. Ob vor dem Eintritt noch ein Dialog fragt, ist weiter offen.'
			}
		}
	}
};

export const BlockLayoutMobile: StoryObj = {
	name: '14 — Blockbild, mobil',
	globals: phone375Globals,
	render: () => <BlockRoom />,
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				story: 'Derselbe Block auf 375 pt — ohne eigene Zahl. Die Uhr misst die Breite und schrumpft die Miniaturen, bis das Quadrat hineinpasst; nichts wird abgeschnitten, nichts wird zur Spalte. Das ist der Fehler, den Frank im Screenshot gesehen hat: eine Uhr mit fester Größe auf einem Bildschirm, für den sie nicht gerechnet war.'
			}
		}
	}
};
