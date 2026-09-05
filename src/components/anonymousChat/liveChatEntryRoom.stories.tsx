import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { AccountData } from '../registration/accountData/AccountData';
import { RegistrationFooter } from '../registrationFooter/RegistrationFooter';
import { WaitingQueueActionBar } from '../pseudonym/WaitingQueueActionBar';
import { RegistrationHandover } from '../app/registrationLoader/RegistrationHandover';
import { HandoverStep } from '../app/registrationLoader/HandoverCarousel';
import { HandoverGateState } from '../app/registrationLoader/handoverGate';
import { processArtwork } from '../../resources/img/registration-md3/registrationArtwork';
import { registrationMd3 } from '../registration/registrationDesign/registrationDesign';
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
import { formatOpeningHours } from '../../utils/openingHours';
import type { Pseudonym } from '../../utils/pseudonymGenerator';
import { PseudonymCard } from '../pseudonym/PseudonymCard';
import { PrivacyMessageCard } from '../pseudonym/PrivacyMessageCard';
import { HandoverGateButton } from '../app/registrationLoader/HandoverGateButton';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';
import { phone375Globals } from '../message/messageStoryShell';

/**
 * The **live chat** entry room — the same module as the self-help group's,
 * with the live chat's own words.
 *
 * Someone opens an external-inbound link and wants to talk now. What makes
 * this way different: there is no appointment, so no clock — the wait is a
 * queue position measured in minutes, and before anyone waits, the room
 * explains in three pictures what happens and that a short human-or-bot
 * check runs on the way in (Frank, 2026-09-05: "es gibt da halt auch
 * Infotexte, was zu tun ist beim Roboter, dass die auch ordentlich drin
 * sind").
 *
 * Every part is an existing component: `AccountData` for the entry,
 * `RegistrationHandover` for the three cards and the gate (now taking its
 * copy from the caller), `WaitingQueueActionBar` for the queue,
 * `RegistrationFooter` for the bar, `StageLayout` with its header slot for
 * the agency.
 */
const meta: Meta = {
	title: 'Live chat/Entry room',
	parameters: {
		docs: {
			description: {
				component:
					'Der vollständige Weg in den anonymen Live-Chat: Link öffnen, Namen bekommen, in drei Bildern lesen, was passiert (samt Prüfung Mensch oder Bot), warten, reden — oder, wenn geschlossen ist, zur Mail-Beratung. Abnahmefläche zu ORISO-Frontend#1052 und #1288. Nichts davon ist verdrahtet.'
			}
		}
	}
};

export default meta;

const agency = {
	id: 42,
	name: 'Caritas Berlin — Schuldenberatung',
	postcode: '00000',
	city: 'Berlin',
	description: '',
	teamAgency: false,
	consultingType: 1,
	external: false
} as unknown as AgencyDataInterface;

const mainTopic = {
	id: 7,
	name: 'Schulden',
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

/** What the admin panel stores for this agency's live chat. */
const OPENING_HOURS = JSON.stringify({
	version: 1,
	openingHours: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY']
		.map((day) => ({
			fromDay: day,
			from: '10:00',
			untilDay: day,
			until: '17:00'
		}))
		.concat([
			{
				fromDay: 'FRIDAY',
				from: '10:00',
				untilDay: 'FRIDAY',
				until: '13:00'
			}
		])
});
const PSEUDONYM: Pseudonym = {
	displayName: 'geschmeidiges Kätzchen Lou',
	animalLabel: 'Katze',
	name: 'Lou',
	avatar: { file: 'cat.svg', bg: '#FFD8E4', iconColor: '#1D1B20' }
};

const ABSENCE_MESSAGE =
	'Gerade ist niemand im Live-Chat. Schreiben Sie uns — wir antworten innerhalb von zwei Arbeitstagen.';

/**
 * The three cards, in the live chat's words. The pictures are the
 * registration's three motifs — writing, a counsellor, a reply — because
 * that is exactly what happens here too, only faster.
 */
const LIVE_CHAT_STEPS: HandoverStep[] = [
	{
		key: 'liveWrite',
		artwork: processArtwork.write,
		titleKey: 'liveChat.entry.steps.write.title',
		textKey: 'liveChat.entry.steps.write.text',
		titleFallback: 'Sie schreiben, was los ist',
		textFallback:
			'Ein paar Sätze genügen. Sie bleiben anonym — wir sehen nur Ihren gewählten Namen.'
	},
	{
		key: 'liveCheck',
		artwork: processArtwork.counsellor,
		titleKey: 'liveChat.entry.steps.check.title',
		textKey: 'liveChat.entry.steps.check.text',
		titleFallback: 'Kurze Prüfung, dann ein Mensch',
		textFallback:
			'Ein Klick bestätigt, dass Sie kein Programm sind. Dann holt sich eine Beraterin Ihr Gespräch.'
	},
	{
		key: 'liveReply',
		artwork: processArtwork.reply,
		titleKey: 'liveChat.entry.steps.reply.title',
		textKey: 'liveChat.entry.steps.reply.text',
		titleFallback: 'Antwort in wenigen Minuten',
		textFallback:
			'Sie sehen, wie viele vor Ihnen dran sind. Sobald jemand frei ist, geht es los.'
	}
];

const WithContext = ({ children }: { children: React.ReactNode }) => (
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

/** Which agency this is — in the header on a desktop, in the column on a phone. */
const AgencyHeading = () => (
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
			Live-Chat · {mainTopic.name}
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

const Staged = ({
	children,
	showLogin = false,
	padded = true
}: {
	children: React.ReactNode;
	showLogin?: boolean;
	/** Off for the handover, which owns its own column padding and bar. */
	padded?: boolean;
}) => (
	<Box sx={{ minHeight: '100vh' }}>
		<AgencySpecificContext.Provider
			value={{ specificAgency: null, setSpecificAgency: () => undefined }}
		>
			<StageLayout
				className="stageLayout--registration"
				showLegalLinks={true}
				showLoginLink={showLogin}
				showRegistrationLink={false}
				stage={<Stage hasAnimation={false} />}
				mobileHero="bar"
				headerStart={<AgencyHeading />}
			>
				<Box
					sx={{
						width: '100%',
						minWidth: 0,
						maxWidth: '100%',
						minHeight: {
							xs: 'calc(100vh - 96px)',
							lg: 'calc(100vh - 128px)'
						},
						display: 'flex',
						flexDirection: 'column',
						...(padded
							? {
									px: { xs: 2.5, sm: 5 },
									pt: { xs: 3, sm: 4 },
									pb: { xs: '128px', sm: '136px' }
								}
							: {})
					}}
				>
					<Box
						sx={{
							display: { xs: 'block', lg: 'none' },
							mb: 2,
							px: padded ? 0 : 2.5,
							pt: padded ? 0 : 3
						}}
					>
						<AgencyHeading />
					</Box>
					{children}
				</Box>
			</StageLayout>
		</AgencySpecificContext.Provider>
	</Box>
);

/* ---------------------------------------------------------------------------
   1 — The door: Carimat hands over a name (Figma CAR02 2183-14985).
   --------------------------------------------------------------------------- */

const EntryScreen = () => (
	<WithContext>
		<Staged showLogin>
			<Box sx={{ maxWidth: 560, width: '100%' }}>
				<PseudonymCard pseudonym={PSEUDONYM} skipTyping />
			</Box>
			{/* Figma 2183-14985 has Sprache · Bestätigen · Name ändern in
			    the bar. Language already sits in the stage header, so the
			    bar carries the two decisions — as the theme's own buttons,
			    the same bar every other entry uses. `PseudonymActionBar`
			    (the chat-composer variant with the dice) does not fit a
			    375 pt bar beside a second label; it stays where it is, in
			    the chat. */}
			<RegistrationFooter
				secondary={{ label: 'Name ändern' }}
				primary={{ label: 'Bestätigen' }}
			/>
		</Staged>
	</WithContext>
);

export const Step1Entry: StoryObj = {
	name: '1 — Link geöffnet, Name bekommen',
	render: () => <EntryScreen />,
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				story: 'Franks Figma-Screen 1: Carimat spricht, das Tier-Pseudonym steht im Bild, unten Sprache · Bestätigen · Name ändern. Das sind die vorhandenen Bauteile `PseudonymCard` und `PseudonymActionBar` — nur auf der Bühne statt im App-Rahmen. Kein Passwortfeld: der Name ist der Zugang; wer wiederkommen will, wählt 1b.'
			}
		}
	}
};

const AccountEntry = () => {
	const [temporary, setTemporary] = useState(false);
	return (
		<WithContext>
			<Staged showLogin>
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
						label: temporary ? 'Chat starten' : 'Registrieren'
					}}
				/>
			</Staged>
		</WithContext>
	);
};

export const Step1WithAccount: StoryObj = {
	name: '1b — Doch mit Konto',
	render: () => <AccountEntry />,
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				story: 'Derselbe Bildschirm für jemanden, der wiederkommen will. Heute im Live-Chat nicht möglich — der Weg vergibt ein Passwort, zeigt es nie, und der Mensch verliert seine Beratung, sobald er das Fenster schließt.'
			}
		}
	}
};

/* ---------------------------------------------------------------------------
   2 — Three pictures: what happens now, including the human-or-bot check.
   --------------------------------------------------------------------------- */

const Handover = ({ state }: { state?: HandoverGateState }) => {
	const { t } = useTranslation();
	return (
		<WithContext>
			<Staged padded={false}>
				<RegistrationHandover
					ready={state === undefined}
					forcedState={state}
					onEnter={() => undefined}
					variant="inline"
					copy={{
						badge: t('liveChat.entry.badge', 'Angemeldet'),
						headline: t(
							'liveChat.entry.headline',
							'Gleich geht es los.'
						),
						subline: t(
							'liveChat.entry.subline',
							'So läuft der Live-Chat:'
						),
						cta: t('liveChat.entry.cta', 'Chat starten'),
						encryption: t(
							'liveChat.entry.encryption',
							'Verschlüsselt: Außer Ihnen liest nur Ihre Beraterin mit.'
						),
						steps: LIVE_CHAT_STEPS
					}}
				/>
			</Staged>
		</WithContext>
	);
};

export const Step2Handover: StoryObj = {
	name: '2 — So läuft es: drei Bilder',
	render: () => <Handover />,
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				story: 'Dieselben drei Karten wie nach der Registrierung — Franks „horizontale drei Bilder" —, nur mit den Worten des Live-Chats: schreiben, kurze Prüfung und dann ein Mensch, Antwort in Minuten. Die Karte in der Mitte ist der Infotext zum Roboter, den Frank vermisst hat. Der Knopf unten ist das Tor: er öffnet erst, wenn alles dahinter geladen ist. Das Bauteil ist das der Registrierung; es nimmt jetzt Worte und Bilder vom Aufrufer, statt sie fest zu haben.'
			}
		}
	}
};

export const Step2Verifying: StoryObj = {
	name: '2b — Prüfung: Mensch oder Bot',
	render: () => <Handover state="verifying" />,
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				story: 'Der Zustand, in dem Altcha läuft. Der Knopf selbst sagt es — „Prüfung: Mensch oder Bot …" — und bleibt zu, bis die Prüfung durch ist. Der Text war im Tor-Bauteil schon vorgesehen (`handoverGate.ts`, Zustand `verifying`); hier ist er zum ersten Mal zu sehen.'
			}
		}
	}
};

export const Step2Mobile: StoryObj = {
	name: '2c — Drei Bilder, mobil',
	globals: phone375Globals,
	render: () => <Handover />,
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				story: 'Auf dem Telefon werden die drei Bilder zum Wischen; der Punkt darunter zeigt, wo man ist.'
			}
		}
	}
};

/* ---------------------------------------------------------------------------
   3 — The waiting room (Figma CAR02 2183-16506), and the moment a counsellor
   accepts (2183-14761).
   --------------------------------------------------------------------------- */

const WaitingRoom = ({ accepted = false }: { accepted?: boolean }) => (
	<WithContext>
		<Staged>
			<Box
				sx={{
					maxWidth: 560,
					width: '100%',
					display: 'flex',
					flexDirection: 'column',
					gap: 3
				}}
			>
				<PrivacyMessageCard skipTyping />
				{accepted ? (
					/* Only now does the person learn who will counsel them and
					   whose privacy terms they are agreeing to — unlike every
					   other way in, where the agency is known before the door.
					   So the agency arrives as a success element, and the
					   button below changes its job (Frank, 2026-09-05). */
					<Box
						data-cy="live-chat-accepted"
						sx={{
							display: 'flex',
							gap: 2,
							p: 2.5,
							borderRadius: '20px',
							bgcolor: registrationMd3.surfaceContainer,
							border: `1px solid ${registrationMd3.outlineVariant}`
						}}
					>
						<Box
							aria-hidden
							sx={{
								'width': 40,
								'height': 40,
								'flexShrink': 0,
								'borderRadius': '50%',
								'bgcolor': registrationMd3.primary,
								'color': registrationMd3.onPrimary,
								'display': 'flex',
								'alignItems': 'center',
								'justifyContent': 'center',
								'& svg': { fontSize: 22 }
							}}
						>
							<CheckRoundedIcon />
						</Box>
						<Box sx={{ minWidth: 0 }}>
							<Typography
								sx={{
									fontSize: 11,
									fontWeight: 600,
									letterSpacing: '.12em',
									textTransform: 'uppercase',
									color: registrationMd3.primary
								}}
							>
								Eine Beraterin ist da
							</Typography>
							<Typography
								sx={{ fontSize: 18, fontWeight: 700, mt: 0.25 }}
							>
								{agency.name}
							</Typography>
							<Typography
								sx={{
									fontSize: 14,
									color: registrationMd3.onSurfaceVariant,
									mt: 1
								}}
							>
								Bitte bestätigen Sie die Datenschutzbestimmungen
								dieser Beratungsstelle. Erst danach darf Ihre
								Beraterin den Chat mit Ihnen starten.
							</Typography>
							<Typography
								sx={{
									fontSize: 13,
									color: registrationMd3.onSurfaceVariant,
									mt: 1
								}}
							>
								Ich habe die{' '}
								<Box
									component="a"
									href="https://oriso.example/datenschutz"
									sx={{ color: 'inherit', fontWeight: 600 }}
								>
									Datenschutzbestimmung
								</Box>{' '}
								zur Kenntnis genommen. Für Authentifizierung und
								Navigation verwendet diese Website Cookies.
							</Typography>
						</Box>
					</Box>
				) : null}
			</Box>
			{!accepted && (
				/* The queue bar's desktop layout is a fixed-pixel Figma copy
				   (227 + 114 + 400 px) and folds letter by letter in a 560 px
				   box — it needs the whole column. */
				<Box sx={{ width: '100%', mt: 3 }}>
					<WaitingQueueActionBar
						queuePosition={23}
						onOpenCalmCompanion={() => undefined}
						onRequestLocalCounselor={() => undefined}
						onLeaveQueue={() => undefined}
					/>
				</Box>
			)}
			{/* The bar's button is the waiting animation (Frank, 2026-09-05:
			    "eine coole Warteraum-Animation … könnte ja unten der
			    Footer-Button sein"): the same gate as after the registration,
			    filling while the queue moves, open the moment a counsellor
			    accepts — and then it says what the click now means. */}
			<RegistrationFooter>
				<Box sx={{ width: '100%' }}>
					<HandoverGateButton
						state={accepted ? 'ready' : 'queued'}
						onEnter={() => undefined}
						label={
							accepted
								? 'Datenschutz zustimmen und Live-Chat beitreten'
								: 'Warteraum'
						}
					/>
				</Box>
			</RegistrationFooter>
		</Staged>
	</WithContext>
);

export const Step3Queue: StoryObj = {
	name: '3 — Warteraum',
	render: () => <WaitingRoom />,
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				story: 'Franks Figma-Warteraum: Carimat erklärt die Verschlüsselung, die Pille zählt, wer noch vor einem ist, daneben die ruhige Begleitung und „Statt zu warten" der Weg zur Mail-Beratung — alles vorhandene Bauteile. Neu ist der Fuß: das Tor der Registrierung als Warteanimation, gefüllt im Takt der Schlange, mit „Gleich sind Sie an der Reihe …" als Statuszeile.'
			}
		}
	}
};

export const Step3Accepted: StoryObj = {
	name: '3b — Beraterin nimmt an',
	render: () => <WaitingRoom accepted />,
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				story: 'Der Kern von Franks Anmerkung: Erst jetzt weiß der Mensch, wer ihn berät und wessen Datenschutz er zustimmt. Die Beratungsstelle fährt als Erfolgs-Element in den Warteraum, mit dem Willkommen-Text aus Figma 2183-14761, und der Knopf unten wechselt von „Warteraum" zu „Datenschutz zustimmen und Live-Chat beitreten". Ein Klick, zwei Dinge — und beide stehen drauf.'
			}
		}
	}
};

export const Step3Mobile: StoryObj = {
	name: '3c — Beraterin nimmt an, mobil',
	globals: phone375Globals,
	render: () => <WaitingRoom accepted />,
	parameters: { layout: 'fullscreen' }
};

/* ---------------------------------------------------------------------------
   4 — Closed: the honest door with the way to mail counselling.
   --------------------------------------------------------------------------- */

const Closed = () => {
	const { t } = useTranslation();
	const [hoursOpen, setHoursOpen] = useState(false);
	return (
		<WithContext>
			<Staged showLogin>
				<Box sx={{ maxWidth: 560 }}>
					<Box
						sx={{
							display: 'flex',
							gap: 2,
							alignItems: 'center',
							mb: 2
						}}
					>
						<Box
							aria-hidden
							sx={{
								'width': 56,
								'height': 56,
								'flexShrink': 0,
								'borderRadius': '50%',
								'bgcolor': registrationMd3.surfaceContainer,
								'display': 'flex',
								'alignItems': 'center',
								'justifyContent': 'center',
								'& svg': { fontSize: 30 }
							}}
						>
							<ScheduleOutlinedIcon />
						</Box>
						<Typography sx={{ fontSize: 22, fontWeight: 700 }}>
							{t(
								'anonymousChat.noAvailability.title',
								'Live-Chat ist zurzeit leider geschlossen'
							)}
						</Typography>
					</Box>
					{/* The agency's own absence text from the admin panel. */}
					<Typography
						sx={{
							fontSize: 15,
							color: registrationMd3.onSurfaceVariant,
							mb: 2
						}}
					>
						{ABSENCE_MESSAGE}
					</Typography>
					<Box
						component="button"
						type="button"
						onClick={() => setHoursOpen((v) => !v)}
						aria-expanded={hoursOpen}
						sx={{
							width: '100%',
							textAlign: 'left',
							font: 'inherit',
							fontSize: 14,
							color: registrationMd3.onSurfaceVariant,
							bgcolor: 'transparent',
							border: `1px solid ${registrationMd3.outlineVariant}`,
							borderRadius: '12px',
							p: '12px 16px',
							mb: 2,
							cursor: 'pointer'
						}}
					>
						{t(
							'anonymousChat.noAvailability.openingHours',
							'Reguläre Öffnungszeiten anzeigen'
						)}
						{hoursOpen && (
							<Typography
								sx={{
									fontSize: 15,
									color: registrationMd3.onSurface,
									mt: 1
								}}
							>
								{formatOpeningHours(OPENING_HOURS, t)}
							</Typography>
						)}
					</Box>
					<Typography sx={{ fontSize: 15, mb: 2 }}>
						{t(
							'anonymousChat.noAvailability.mailHint',
							'Oder starten Sie jederzeit die anonyme Mail-Beratung: Mit Ihrer Postleitzahl finden Sie eine Beratungsstelle in Ihrer Nähe und schreiben Ihre Anfrage.'
						)}
					</Typography>
					<Typography
						sx={{
							fontSize: 13,
							color: registrationMd3.onSurfaceVariant,
							mb: 2
						}}
					>
						{t(
							'anonymousChat.noAvailability.tip',
							'Tipp: Nutzen Sie eine E-Mail-Adresse, auf die nur Sie Zugriff haben.'
						)}
					</Typography>
					<Typography
						sx={{
							fontSize: 13,
							fontWeight: 600,
							color: registrationMd3.onSurfaceVariant
						}}
					>
						{t(
							'anonymousChat.noAvailability.responseTime',
							'Antwort innerhalb von 2 Werktagen'
						)}
					</Typography>
				</Box>
				<RegistrationFooter
					secondary={{
						label: t('anonymousChat.noAvailability.later', 'Später')
					}}
					primary={{
						label: t(
							'anonymousChat.noAvailability.startMailCounseling',
							'Mail-Beratung starten'
						)
					}}
				/>
			</Staged>
		</WithContext>
	);
};

export const Step4Closed: StoryObj = {
	name: '4 — Geschlossen',
	render: () => <Closed />,
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				story: 'Figma CAR02 2183-15874, mit den Texten, die es unter `anonymousChat.noAvailability.*` schon in sieben Sprachen gibt — nichts neu geschrieben. Auf dev erfährt der Gast erst NACH Einwilligung und 30 bis 40 Sekunden Pseudonym-Animation, dass geschlossen ist. Diese Ansicht gehört vor den Eintritt. Öffnungszeiten und Abwesenheitstext kommen aus den Live-Chat-Einstellungen im Admin (`formatOpeningHours`, `absenceMessage`). Der Ausweg ist ein echter Wechsel: „Zur Mail-Beratung" führt in die Registrierung mit Beratungsstelle und Thema vorbelegt — die Postleitzahl bleibt Pflicht und wird nur vorbelegt, nie übersprungen. Kein „Nachricht schreiben" im Live-Chat, der gerade niemand liest.'
			}
		}
	}
};
