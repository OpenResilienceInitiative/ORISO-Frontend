import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box, Button, Typography, useMediaQuery } from '@mui/material';
import { Switch } from '../Switch';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
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
		// (64 on a phone) and keeps 32 px under the column; the bar 96 plus
		// 16 below it; the column 24 above; the headline block and its gap
		// (66 + 26); the switch row at the foot (16 + 40); 24 px so a
		// rounding error never shows as a scrollbar.
		// Column: 8 above, bar 96 + 4 below; the group block (34 + 8) only on
		// a phone, on the desktop it is in the header; headline block 60 +
		// 12; switch row 8 + 40; 28 slack.
		const reserved =
			(mobile ? 64 + 42 : 96) + 32 + 8 + 100 + 60 + 12 + 8 + 40 + 28;
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
	/* Which group this is. Frank, 2026-09-05: "mir fehlt im Header das
	   Thema der Gruppe, sowie … einen Namen." Topic and name from the same
	   fixtures the entry screen uses — someone who followed a link should
	   see at once that they are in the right room. On the desktop it lives
	   in the stage header, opposite language and login, so the clock keeps
	   the column. */
	const groupHeading = (
		<Box sx={{ textAlign: { xs: 'center', lg: 'left' } }}>
			<Typography
				sx={{
					fontSize: 11,
					fontWeight: 600,
					letterSpacing: '.12em',
					textTransform: 'uppercase',
					color: registrationMd3.onSurfaceVariant
				}}
			>
				{groupTopic.name}
			</Typography>
			<Typography
				sx={{
					fontSize: 14,
					fontWeight: 600,
					color: registrationMd3.onSurface
				}}
			>
				{agency.name}
			</Typography>
		</Box>
	);
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
					headerStart={groupHeading}
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
							/* Tight on every side: the clock is the point of
							   this screen and takes what the chrome leaves. */
							px: 2,
							pt: 1,
							pb: '100px'
						}}
					>
						{/* Everything above the switch row is one block that
						    centres itself in the space left over (Frank,
						    2026-09-05: "muss vertikal zentriert sein"). The
						    row below takes none of that slack any more. */}
						<Box
							sx={{
								flex: 1,
								display: 'flex',
								flexDirection: 'column',
								justifyContent: 'center',
								gap: 1
							}}
						>
							{/* On a phone the header row does not exist, so the
							    group block stands in the column. */}
							<Box sx={{ display: { xs: 'block', lg: 'none' } }}>
								{groupHeading}
							</Box>
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
								gap={12}
							/>
						</Box>
						{/* The animation switch — the design system's own M3
						    `Switch`, the one the profile uses — and "Mehr
						    erfahren" sit at the foot of the column, directly
						    above the bar but not on it (Frank, 2026-09-05:
						    "unten, aber nicht Teil des Footers"). `mt: auto`
						    pushes the row down; whatever the clock does above,
						    the row stays put. "Mehr erfahren" is the theme's
						    outlined button with the arrow_forward icon from the
						    icon set, the same pair the registration's step
						    button uses. */}
						<Box
							sx={{
								mt: 'auto',
								pt: 1,
								display: 'flex',
								justifyContent: 'space-between',
								alignItems: 'center',
								gap: 2
							}}
						>
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
									onChange={(next) => setMotionOff(next)}
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
								variant="outlined"
								size="small"
								endIcon={<ArrowForwardRoundedIcon />}
								sx={{ whiteSpace: 'nowrap' }}
							>
								Mehr erfahren
							</Button>
						</Box>
						{/* Desktop, as drawn: calendar beside a visible but shut
						    "Beitreten". On a phone two buttons is one too many
						    for the bar, so there the calendar has it alone and
						    "Beitreten" moves in once the time has passed —
						    Frank's own suggestion ("das Beitreten später
						    reinfahren"). */}
						<RegistrationFooter
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

export const WaitingArea: StoryObj = {
	name: '1 — Wartebereich',
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

export const WaitingAreaOverdue: StoryObj = {
	name: '2 — Läuft schon',
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

export const WaitingAreaMobile: StoryObj = {
	name: '3 — Wartebereich, mobil',
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
