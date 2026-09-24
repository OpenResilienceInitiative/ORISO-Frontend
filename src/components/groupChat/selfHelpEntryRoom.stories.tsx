import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box } from '@mui/material';
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
import { StageLayout } from '../stageLayout/StageLayout';
import { GroupWaitingRoom } from './entryRoom/GroupWaitingRoom';
import { Stage } from '../stage/stage';
import { AgencySpecificContext } from '../../globalState';
import {
	desktop1440Globals,
	phone390Globals,
	phone375Globals
} from '../message/messageStoryShell';
import {
	expectCaptionClear,
	expectOverdueClockOnOneRow
} from './waitingClock/waitingClockStoryChecks';

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
					'Alle Ansichten des Eintrittsraums für Selbsthilfegruppen, mit der vorhandenen Warteuhr. Abnahmefläche zu ORISO-Frontend#921 und #1293. Die Wartebereiche sind die App-Ansicht (`entryRoom/GroupWaitingRoom`), der Eintritt zeigt die Registrierung mit dem Gruppen-Link.'
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
/* Bug A in #1499: a group two hours and twenty minutes past its start. Any
   group created on Dev reaches this within minutes because UserService stores
   the start two hours early, so this is the state a client most often sees. */
const OVERDUE_3_DIGITS = new Date(NOW - (140 * 60 + 7) * 1000);

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
	/* No em dash inside a fixture that stands for API data: the screen shows
	   topic and agency on their own lines and must never look as if it glued
	   them together (Frank, 2026-09-07). A comma is what a real agency name
	   carries. */
	name: 'Caritas Berlin, Selbsthilfegruppe Trauer',
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

/* ---------------------------------------------------------------------------
   1–3 — The waiting room as the app renders it: `GroupWaitingRoom` is the
   view `GroupEntryRoom` mounts on `/groups/:chatId/entry` after the link's
   assignment. Here it gets fixtures instead of the chat; nothing else differs.
   --------------------------------------------------------------------------- */

const Room = ({ start = IN_THREE_DAYS }: { start?: Date }) => (
	<LegalLinksContext.Provider value={legalLinks}>
		<AgencySpecificContext.Provider
			value={{
				specificAgency: null,
				setSpecificAgency: () => undefined
			}}
		>
			<GroupWaitingRoom
				topicName={groupTopic.name}
				agencyName={agency.name}
				plannedStart={start}
				durationMinutes={90}
				eventId={15}
				welcomeText={WELCOME}
				rules={RULES}
				active={start.getTime() <= NOW}
				onJoin={() => undefined}
				nowMs={NOW}
				showLoginLink
			/>
		</AgencySpecificContext.Provider>
	</LegalLinksContext.Provider>
);

export const WaitingArea: StoryObj = {
	name: '1 — Wartebereich',
	render: () => <Room />,
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
	render: () => <Room start={OVERDUE} />,
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				story: 'Der Termin ist vorbei: „Beitreten" im Fuß ist jetzt frei, sonst ändert sich an der Leiste nichts. Ob vor dem Eintritt noch ein Dialog fragt, ist weiter offen.'
			}
		}
	}
};

/**
 * #1499 bug A — the overdue clock at 1440 on the page a client lands on from
 * the invite link. This is the exact state of Frank's screenshot of 22.09.2026:
 * 140 minutes past the start. The two digit groups used to be allowed to wrap,
 * and the seconds group dropped onto a second row and painted over the "Das
 * Warten wird langsam etwas unangenehm …" caption. The minutes group now draws
 * three digits and the row stays one row — the mini-clocks shrink instead.
 */
export const WaitingAreaOverdue3Digits: StoryObj = {
	name: '2a — Läuft schon, über 99 Minuten (1440)',
	globals: desktop1440Globals,
	render: () => <Room start={OVERDUE_3_DIGITS} />,
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				story: 'Zwei Stunden und zwanzig Minuten nach dem geplanten Start. Minuten und Sekunden stehen nebeneinander, die Uhr wird dafür eine Stufe kleiner, und der Satz darunter bleibt frei. Die Minuten zeigen 140 — früher stand dort 99, während die Vorlesehilfe 140 sagte.'
			}
		}
	},
	play: async ({ canvasElement }) => {
		await expectOverdueClockOnOneRow(canvasElement, 3);
		await expectCaptionClear(canvasElement);
	}
};

export const WaitingAreaOverdue3DigitsMobile: StoryObj = {
	name: '2b — Läuft schon, über 99 Minuten (390)',
	globals: phone390Globals,
	render: () => <Room start={OVERDUE_3_DIGITS} />,
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				story: 'Derselbe Fall auf 390 pt. Auch hier eine Reihe; die Miniaturuhren werden kleiner, nicht die Reihe zweizeilig.'
			}
		}
	},
	play: async ({ canvasElement }) => {
		await expectOverdueClockOnOneRow(canvasElement, 3);
		await expectCaptionClear(canvasElement);
	}
};

export const WaitingAreaMobile: StoryObj = {
	name: '3 — Wartebereich, mobil',
	globals: phone375Globals,
	render: () => <Room />,
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				story: 'Derselbe Block auf 375 pt — ohne eigene Zahl. Die Uhr misst die Breite und schrumpft die Miniaturen, bis das Quadrat hineinpasst; nichts wird abgeschnitten, nichts wird zur Spalte. Das ist der Fehler, den Frank im Screenshot gesehen hat: eine Uhr mit fester Größe auf einem Bildschirm, für den sie nicht gerechnet war.'
			}
		}
	}
};
