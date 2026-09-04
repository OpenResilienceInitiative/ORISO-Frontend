import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box, Typography } from '@mui/material';
import { AccountData } from '../registration/accountData/AccountData';
import { RegistrationFooter } from '../registrationFooter/RegistrationFooter';
import { WaitingQueueActionBar } from '../pseudonym/WaitingQueueActionBar';
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
import { phone375Globals } from '../message/messageStoryShell';

/**
 * The **live chat** entry room — the whole path, in order.
 *
 * Someone opens an external-inbound link from the admin panel and wants to talk
 * now. Verified on `dev.oriso.org`: the link works, the guest is never shown a
 * password, and every additional click on the same link mints a new identity
 * and orphans the previous one.
 *
 * What makes this way different from the self-help group: there is no
 * appointment, so no clock — the wait is a queue position, and it is measured in
 * minutes rather than days. Any wording about "2 Arbeitstagen" is wrong here.
 *
 * The components are the ones already in the app: `AccountData` for the entry
 * screen, `RegistrationFooter` for the bar, `WaitingQueueActionBar` for the
 * queue. Nothing rebuilt.
 */
const meta: Meta = {
	title: 'Live chat/Entry room',
	parameters: {
		docs: {
			description: {
				component:
					'Der vollständige Weg in den anonymen Live-Chat: Link öffnen, Namen bekommen, warten. Abnahmefläche zu ORISO-Frontend#1052 und #1288. Nichts davon ist verdrahtet.'
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

const Staged = ({
	children,
	showLogin = false
}: {
	children: React.ReactNode;
	showLogin?: boolean;
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
					{children}
				</Box>
			</StageLayout>
		</AgencySpecificContext.Provider>
	</Box>
);

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
				story: 'Was der Gast heute sieht, ist weniger als das: der Link registriert ihn stumm und wirft ihn in die App. Hier bekommt er einen Namen, kann ihn ändern, und entscheidet selbst zwischen „schnell rein" und „Konto anlegen". Die Hauptaktion heißt hier „Chat starten" statt „Beitreten" — es gibt keinen Raum, dem man beitritt, sondern ein Gespräch, das beginnt.'
			}
		}
	}
};

export const Step1WithAccount: StoryObj = {
	name: '2 — Doch mit Konto',
	render: () => <EntryScreen temporaryStart={false} />,
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				story: 'Derselbe Bildschirm für jemanden, der wiederkommen will. Das ist heute im Live-Chat gar nicht möglich — der Weg vergibt ein Passwort, zeigt es nie, und der Mensch verliert seine Beratung, sobald er das Fenster schließt.'
			}
		}
	}
};

export const Step2Queue: StoryObj = {
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
				story: 'Die Warteschlange auf der Bühne — kein Countdown, sondern eine Position. Das ist der Unterschied zur Selbsthilfegruppe: dort steht ein Termin fest, hier wartet man auf einen Menschen. Auf dev misst dieselbe Anzeige heute im Desktop 114 px Breite und bricht in fünf Zeilen à zwei Wörter um; auf der Bühne hat sie den Platz, den sie braucht.'
			}
		}
	}
};

export const Step2QueueMobile: StoryObj = {
	name: '4 — Warteschlange, mobil',
	globals: phone375Globals,
	render: () => (
		<WithContext>
			<Staged>
				<Box>
					<Typography
						sx={{ fontSize: 20, fontWeight: 700, mb: '6px' }}
					>
						Sie sind angemeldet
					</Typography>
					<Typography
						sx={{
							fontSize: 15,
							color: registrationMd3.onSurfaceVariant,
							mb: '20px'
						}}
					>
						Wir suchen eine freie Beraterin für Sie.
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
				story: 'Mobil ist die Warteschlange heute schon stimmig — der Fehler liegt auf Desktop. Hier zum Vergleich, damit beide Breiten nebeneinander beurteilt werden können.'
			}
		}
	}
};

export const Step3Closed: StoryObj = {
	name: '5 — Geschlossen',
	render: () => (
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
							mb: '20px'
						}}
					>
						Heute ist bis 17 Uhr jemand da. Sie können stattdessen
						eine Nachricht schreiben — die wird gelesen, auch wenn
						gerade niemand online ist.
					</Typography>
				</Box>
				<RegistrationFooter
					secondary={{ label: 'Später wiederkommen' }}
					primary={{ label: 'Nachricht schreiben' }}
				/>
			</Staged>
		</WithContext>
	),
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				story: 'Der Fall, der heute am spätesten kommt: Auf dev erfährt der Gast erst NACH Einwilligung und 30 bis 40 Sekunden Pseudonym-Animation, dass geschlossen ist. Diese Ansicht gehört vor den Eintritt, nicht dahinter. Und der Ausweg gehört dazu — „später wiederkommen" allein ist keine Hilfe.'
			}
		}
	}
};
