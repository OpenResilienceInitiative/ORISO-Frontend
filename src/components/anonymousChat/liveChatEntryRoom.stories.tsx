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
	openingHours: [
		{ day: 1, from: '10:00', to: '17:00' },
		{ day: 2, from: '10:00', to: '17:00' },
		{ day: 3, from: '10:00', to: '17:00' },
		{ day: 4, from: '10:00', to: '17:00' },
		{ day: 5, from: '10:00', to: '13:00' }
	]
});
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
   1 — The door: a name, and the choice between quick and lasting.
   --------------------------------------------------------------------------- */

const EntryScreen = ({
	temporaryStart = true
}: {
	temporaryStart?: boolean;
}) => {
	const [temporary, setTemporary] = useState(temporaryStart);
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

export const Step1Entry: StoryObj = {
	name: '1 — Link geöffnet, Name bekommen',
	render: () => <EntryScreen />,
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				story: 'Was der Gast heute sieht, ist weniger als das: der Link registriert ihn stumm und wirft ihn in die App. Hier bekommt er einen Namen, kann ihn ändern, und entscheidet selbst zwischen „schnell rein" und „Konto anlegen". Oben rechts „Einloggen" für die, die schon eins haben. Die Hauptaktion heißt „Chat starten" — es gibt keinen Raum, dem man beitritt, sondern ein Gespräch, das beginnt.'
			}
		}
	}
};

export const Step1WithAccount: StoryObj = {
	name: '1b — Doch mit Konto',
	render: () => <EntryScreen temporaryStart={false} />,
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
   3 — The queue.
   --------------------------------------------------------------------------- */

export const Step3Queue: StoryObj = {
	name: '3 — In der Warteschlange',
	render: () => (
		<WithContext>
			<Staged>
				<Box sx={{ maxWidth: 560 }}>
					<Typography
						sx={{ fontSize: 22, fontWeight: 700, mb: '6px' }}
					>
						Sie sind angemeldet
					</Typography>
					<Typography
						sx={{
							fontSize: 15,
							color: registrationMd3.onSurfaceVariant,
							mb: '24px'
						}}
					>
						Wir suchen eine freie Beraterin für Sie. Das dauert
						meist wenige Minuten.
					</Typography>
				</Box>
				<WaitingQueueActionBar
					queuePosition={2}
					onOpenCalmCompanion={() => undefined}
					onRequestLocalCounselor={() => undefined}
					onLeaveQueue={() => undefined}
				/>
			</Staged>
		</WithContext>
	),
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				story: 'Kein Countdown, sondern eine Position — der Unterschied zur Selbsthilfegruppe: dort steht ein Termin fest, hier wartet man auf einen Menschen. Auf dev misst dieselbe Anzeige heute im Desktop 114 px Breite und bricht in fünf Zeilen um; auf der Bühne hat sie den Platz, den sie braucht.'
			}
		}
	}
};

/* ---------------------------------------------------------------------------
   4 — Closed: the honest door with the way to mail counselling.
   --------------------------------------------------------------------------- */

const Closed = () => {
	const { t } = useTranslation();
	return (
		<WithContext>
			<Staged showLogin>
				<Box sx={{ maxWidth: 560 }}>
					<Typography
						sx={{ fontSize: 22, fontWeight: 700, mb: '6px' }}
					>
						Der Live-Chat ist gerade geschlossen
					</Typography>
					<Typography
						sx={{
							fontSize: 15,
							color: registrationMd3.onSurfaceVariant,
							mb: 3
						}}
					>
						{ABSENCE_MESSAGE}
					</Typography>
					<Box
						sx={{
							border: `1px solid ${registrationMd3.outlineVariant}`,
							borderRadius: '16px',
							p: 2,
							mb: 2
						}}
					>
						<Typography
							sx={{
								fontSize: 11,
								fontWeight: 600,
								letterSpacing: '.12em',
								textTransform: 'uppercase',
								color: registrationMd3.onSurfaceVariant,
								mb: 0.5
							}}
						>
							Live-Chat geöffnet
						</Typography>
						<Typography sx={{ fontSize: 15 }}>
							{formatOpeningHours(OPENING_HOURS, t)}
						</Typography>
					</Box>
					<Typography
						sx={{
							fontSize: 13,
							color: registrationMd3.onSurfaceVariant
						}}
					>
						Zur Mail-Beratung nehmen wir Beratungsstelle und Thema
						mit — nur die Postleitzahl fragen wir noch.
					</Typography>
				</Box>
				<RegistrationFooter
					secondary={{ label: 'Später wiederkommen' }}
					primary={{ label: 'Zur Mail-Beratung' }}
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
				story: 'Auf dev erfährt der Gast erst NACH Einwilligung und 30 bis 40 Sekunden Pseudonym-Animation, dass geschlossen ist. Diese Ansicht gehört vor den Eintritt. Öffnungszeiten und Abwesenheitstext kommen aus den Live-Chat-Einstellungen im Admin (`formatOpeningHours`, `absenceMessage`). Der Ausweg ist ein echter Wechsel: „Zur Mail-Beratung" führt in die Registrierung mit Beratungsstelle und Thema vorbelegt — die Postleitzahl bleibt Pflicht und wird nur vorbelegt, nie übersprungen. Kein „Nachricht schreiben" im Live-Chat, der gerade niemand liest.'
			}
		}
	}
};
