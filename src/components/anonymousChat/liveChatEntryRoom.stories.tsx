import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box, ButtonBase, Typography, useMediaQuery } from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { liveChatArtwork } from '../../resources/img/registration-md3/registrationArtwork';
import SentimentSatisfiedAltOutlinedIcon from '@mui/icons-material/SentimentSatisfiedAltOutlined';
import { RegistrationFooter } from '../registrationFooter/RegistrationFooter';
import { HandoverGateButton } from '../app/registrationLoader/HandoverGateButton';
import { sanitizeConsentHtml } from '../legalContent/legalHtmlSanitizer';
import htmlParser from '../../resources/scripts/util/htmlParser';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import { LeaveQueueDialog } from '../pseudonym/LeaveQueueDialog';
import { AnimalAvatar } from '../pseudonym/AnimalAvatar';
import type { Pseudonym } from '../../utils/pseudonymGenerator';
import { registrationMd3 } from '../registration/registrationDesign/registrationDesign';
import { StageLayout } from '../stageLayout/StageLayout';
import { Stage } from '../stage/stage';
import { AgencySpecificContext } from '../../globalState';
import {
	LegalLinksContext,
	TProvidedLegalLink
} from '../../globalState/provider/LegalLinksProvider';
import { phone375Globals } from '../message/messageStoryShell';

/**
 * The **live chat** entry room — one room, three states, no screen change
 * until the chat itself.
 *
 * Frank, 2026-09-05: the link is global, so nobody knows the agency until a
 * counsellor accepts; the waiting room is one page whose status line, middle
 * and button change; the button is the loading bar; consent arrives as a
 * card sliding in from below, carrying the button that starts the chat, with
 * a round X beside it so nobody is left with a single choice. Carimat stays
 * in the chat — the room does his job here.
 *
 * Built from what exists: `HandoverGateButton` (the bar), `AnimalAvatar`,
 * `AnonymousConsentGate`'s sentence, `LeaveQueueDialog` ("Sind Sie sicher?"),
 * `RegistrationFooter`, `StageLayout`.
 */
const meta: Meta = {
	title: 'Live chat/Entry room',
	parameters: {
		docs: {
			description: {
				component:
					'Zugang → Warteraum (wartet · Beraterin da) → Chat. Plus „Geschlossen". Abnahmefläche zu ORISO-Frontend#1052 und #1288; nichts verdrahtet. Die drei Kartenbilder sind Platzhalter — Beschreibung für die Grafik steht in der Story „Warteraum".'
			}
		}
	}
};

export default meta;

/* ---------------------------------------------------------------------------
   Fixtures
   --------------------------------------------------------------------------- */

const TOPIC = 'Schulden';
const AGENCY = 'Caritas Berlin — Schuldenberatung';

const PSEUDONYM: Pseudonym = {
	displayName: 'geschmeidiges Kätzchen Lou',
	animalLabel: 'Katze',
	name: 'Lou',
	avatar: { file: 'cat.svg', bg: '#FFD8E4', iconColor: '#1D1B20' }
};

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

const ABSENCE_MESSAGE =
	'Gerade ist niemand im Live-Chat. Schreiben Sie uns — wir antworten innerhalb von zwei Arbeitstagen.';
/** The same promise in one line, for a phone. */
const ABSENCE_MESSAGE_SHORT =
	'Schreiben Sie uns — Antwort in zwei Arbeitstagen.';

/**
 * The three cards of the waiting room (Frank, 2026-09-05).
 *
 * 1 and 2 carry his two pictures — waiting while the counsellors are with
 * others; consenting once we know who — as `process/live-wait.webp` and
 * `process/live-consent.webp` (528 × 528, like the registration's three).
 * Until the files are in the repo the slots show a pictogram. Card 3 is text
 * only: what the chat is like once assigned, and what happens afterwards.
 */
const CARDS = [
	{
		image: liveChatArtwork.wait,
		alt: 'Drei Beraterinnen, jede im Gespräch; eine Person wartet am Laptop, neben ihr eine Uhr',
		title: 'Sie warten, bis jemand frei ist',
		text: 'Die Beraterinnen sind gerade in anderen Gesprächen. Sie müssen nichts tun — wir holen Sie.'
	},
	{
		image: liveChatArtwork.consent,
		alt: 'Eine Person setzt ein Häkchen; gegenüber eine Beraterin, darüber ein Schild mit Schloss',
		title: 'Dann stimmen Sie einmal zu',
		text: 'Sobald eine Beratungsstelle Ihr Gespräch annimmt, sehen Sie ihren Datenschutz — ein Klick, und der Chat beginnt.'
	},
	{
		image: liveChatArtwork.anonymous,
		alt: 'Zwei Laptops, eine Seite nur als Schatten; ein Schloss, Sprechblasen, eine Uhr, die sich leert',
		title: 'Anonym, und danach weg',
		text: 'Im Chat sehen Sie und Ihre Beraterin sich nur unter Ihrem Pseudonym. Nach dem Gespräch wird alles gelöscht — spätestens nach 48 Stunden, auch Ihr Zugang.'
	}
];

/* ---------------------------------------------------------------------------
   Shell
   --------------------------------------------------------------------------- */

const Staged = ({
	children,
	statusLine
}: {
	children: React.ReactNode;
	/** Line 2 of the header: what is happening. Line 1 is the global link. */
	statusLine: string;
}) => {
	const heading = (
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
				Live-Chat · {TOPIC}
			</Typography>
			<Typography
				sx={{
					fontSize: 14,
					fontWeight: 600,
					color: registrationMd3.onSurface
				}}
			>
				{statusLine}
			</Typography>
		</Box>
	);
	return (
		<Box sx={{ minHeight: '100vh' }}>
			<LegalLinksContext.Provider value={legalLinks}>
				<AgencySpecificContext.Provider
					value={{
						specificAgency: null,
						setSpecificAgency: () => undefined
					}}
				>
					<StageLayout
						className="stageLayout--registration"
						showLegalLinks={true}
						showLoginLink={false}
						showRegistrationLink={false}
						stage={<Stage hasAnimation={false} />}
						mobileHero="bar"
						headerStart={heading}
					>
						<Box
							sx={{
								width: '100%',
								minWidth: 0,
								minHeight: {
									xs: 'calc(100vh - 96px)',
									lg: 'calc(100vh - 128px)'
								},
								display: 'flex',
								flexDirection: 'column',
								px: { xs: 2.5, sm: 5 },
								pt: { xs: 3, sm: 4 },
								pb: '104px'
							}}
						>
							<Box
								sx={{
									display: { xs: 'block', lg: 'none' },
									mb: 3
								}}
							>
								{heading}
							</Box>
							{children}
						</Box>
					</StageLayout>
				</AgencySpecificContext.Provider>
			</LegalLinksContext.Provider>
		</Box>
	);
};

const Headline = ({
	title,
	children
}: {
	title: string;
	children?: React.ReactNode;
}) => (
	<Box sx={{ mb: 3 }}>
		<Typography
			component="h1"
			sx={{
				fontSize: { xs: 30, sm: 34 },
				lineHeight: { xs: '36px', sm: '41px' },
				fontWeight: 700,
				color: registrationMd3.onSurface
			}}
		>
			{title}
		</Typography>
		{children}
	</Box>
);

/* ---------------------------------------------------------------------------
   A — Der Zugang
   --------------------------------------------------------------------------- */

const Access = () => (
	<Staged statusLine="Ihr Zugang für dieses Gespräch">
		<Headline title="Ihr Name für heute.">
			<Typography
				sx={{
					mt: 0.75,
					fontSize: 16,
					color: registrationMd3.onSurfaceVariant
				}}
			>
				Anonym, ohne Konto. Würfeln Sie, bis er Ihnen gefällt.
			</Typography>
		</Headline>
		<Box
			sx={{
				display: 'flex',
				alignItems: 'center',
				gap: 2.5,
				p: 2.5,
				borderRadius: '20px',
				bgcolor: registrationMd3.surfaceContainer,
				maxWidth: 560
			}}
		>
			<Box sx={{ width: 72, height: 72, flexShrink: 0 }}>
				<AnimalAvatar avatar={PSEUDONYM.avatar} size={72} />
			</Box>
			<Box sx={{ minWidth: 0 }}>
				<Typography
					sx={{
						fontSize: 11,
						fontWeight: 600,
						letterSpacing: '.12em',
						textTransform: 'uppercase',
						color: registrationMd3.onSurfaceVariant
					}}
				>
					Ihr Pseudonym
				</Typography>
				<Typography sx={{ fontSize: 22, fontWeight: 700, mt: 0.25 }}>
					{PSEUDONYM.displayName}
				</Typography>
			</Box>
		</Box>
		<Box
			sx={{
				display: 'flex',
				gap: 1.25,
				alignItems: 'flex-start',
				mt: 3,
				maxWidth: 560,
				fontSize: 13,
				lineHeight: '18px',
				color: registrationMd3.onSurfaceVariant
			}}
		>
			<LockOutlinedIcon
				aria-hidden
				sx={{ fontSize: 18, flexShrink: 0, mt: '1px' }}
			/>
			<Typography sx={{ fontSize: 'inherit', lineHeight: 'inherit' }}>
				Dieser Zugang gilt nur für dieses Gespräch. Danach löschen wir
				ihn — samt aller Nachrichten, spätestens nach 48 Stunden.
				Bleiben Sie in diesem Fenster, bis Sie dran sind.
			</Typography>
		</Box>
		<RegistrationFooter
			secondary={{ label: 'Neu würfeln' }}
			primary={{ label: 'Zum Warteraum' }}
		/>
	</Staged>
);

export const StepAccess: StoryObj = {
	name: 'A — Der Zugang',
	render: () => <Access />,
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				story: 'Kein Träger im Header — der Link ist global, wer berät, weiß noch niemand. Kein Passwort: ein Zugang, der sich selbst löscht, braucht keins; der Satz sagt stattdessen „bleiben Sie in diesem Fenster". Pseudonym mit Würfel als eine ruhige Zeile, nicht als Chatblase. Fuß: Neu würfeln · In den Warteraum.'
			}
		}
	}
};

export const StepAccessMobile: StoryObj = {
	name: 'A — Der Zugang, mobil',
	globals: phone375Globals,
	render: () => <Access />,
	parameters: { layout: 'fullscreen' }
};

/* ---------------------------------------------------------------------------
   B — Der Warteraum: one page, its state changes.
   --------------------------------------------------------------------------- */

/** One dot per person ahead; a filled dot is someone who has been called. */
const QueueDots = ({ ahead, total }: { ahead: number; total: number }) => (
	<Box
		aria-hidden
		sx={{
			display: 'inline-flex',
			gap: 0.75,
			alignItems: 'center',
			mr: 1.5
		}}
	>
		{Array.from({ length: total }, (_, i) => (
			<Box
				key={i}
				sx={{
					width: 10,
					height: 10,
					borderRadius: '50%',
					bgcolor:
						i < total - ahead
							? registrationMd3.primary
							: registrationMd3.surfaceContainerHighest,
					transition: 'background-color 400ms ease'
				}}
			/>
		))}
	</Box>
);

/** The arrow's stand-in while the queue moves. */
const TurningClock = () => (
	<ScheduleOutlinedIcon
		sx={{
			'@keyframes liveChatTurn': {
				to: { transform: 'rotate(360deg)' }
			},
			'animation': 'liveChatTurn 6s linear infinite',
			'@media (prefers-reduced-motion: reduce)': { animation: 'none' }
		}}
	/>
);

const CONSENT_HTML =
	'Ich habe die <a href="https://oriso.example/datenschutz" target="_blank" rel="noreferrer">Datenschutzbestimmung</a> von Caritas Berlin zur Kenntnis genommen. Für Authentifizierung und Navigation verwendet diese Website Cookies.';

const WaitingRoom = ({
	accepted,
	ahead = 5,
	total = 5
}: {
	accepted: boolean;
	ahead?: number;
	total?: number;
}) => {
	const [leaving, setLeaving] = useState(false);
	const progress = Math.round(((total - ahead) / total) * 100);
	return (
		<Staged
			statusLine={
				accepted ? AGENCY : 'Warteraum — freie Beraterin wird gesucht'
			}
		>
			<Headline title="Gleich geht es los.">
				<Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
					{!accepted && <QueueDots ahead={ahead} total={total} />}
					<Typography
						role="status"
						aria-live="polite"
						sx={{
							fontSize: 16,
							fontWeight: accepted ? 700 : 400,
							color: accepted
								? registrationMd3.primary
								: registrationMd3.onSurfaceVariant
						}}
					>
						{accepted
							? 'Eine Beraterin ist da.'
							: ahead === 1
								? 'Eine Person vor Ihnen'
								: `${ahead} Personen vor Ihnen`}
					</Typography>
				</Box>
			</Headline>

			{/* What happens meanwhile — three cards on a strip. They use the
			    height between the headline and the row above the bar; on a
			    phone they are narrower so the next card peeks in and the
			    strip reads as scrollable. No frame around the current card:
			    these are read, not clicked (Frank, 2026-09-05). */}
			<Box
				sx={{
					'flex': 1,
					'minHeight': 0,
					'display': 'flex',
					'gap': 2,
					'overflowX': 'auto',
					'scrollSnapType': 'x mandatory',
					'mx': { xs: -2.5, sm: -5 },
					'px': { xs: 2.5, sm: 5 },
					'pb': 1,
					'scrollbarWidth': 'none',
					'&::-webkit-scrollbar': { display: 'none' }
				}}
			>
				{CARDS.map((card) => (
					<Box
						key={card.title}
						sx={{
							flex: { xs: '0 0 64%', sm: '1 1 0' },
							minWidth: 0,
							scrollSnapAlign: 'start',
							display: 'flex',
							flexDirection: 'column',
							borderRadius: '20px',
							border: `1px solid ${registrationMd3.outlineVariant}`,
							overflow: 'hidden',
							bgcolor: registrationMd3.surfaceContainerLowest
						}}
					>
						{/* Phone: a 4:3 picture so text and the row below stay in
						    reach. Desktop: the picture takes whatever height the
						    column leaves — the card fills its space. */}
						<Box
							sx={{
								aspectRatio: { xs: '4 / 3', sm: 'auto' },
								flex: { xs: 'none', sm: 1 },
								minHeight: { sm: 160 },
								overflow: 'hidden',
								bgcolor: registrationMd3.surfaceContainerHigh
							}}
						>
							<Box
								component="img"
								src={card.image.src}
								alt={card.alt}
								sx={{
									width: '100%',
									height: '100%',
									objectFit: 'cover',
									display: 'block'
								}}
							/>
						</Box>
						<Box sx={{ p: 2.5, pt: 2 }}>
							<Typography sx={{ fontSize: 17, fontWeight: 700 }}>
								{card.title}
							</Typography>
							<Typography
								sx={{
									fontSize: 14,
									lineHeight: '20px',
									color: registrationMd3.onSurfaceVariant,
									mt: 0.75
								}}
							>
								{card.text}
							</Typography>
						</Box>
					</Box>
				))}
			</Box>

			{/* The small row above the bar: the calm companion and the way
			    out — one line, not a section. */}
			{!accepted && (
				<Box
					sx={{
						/* 8 px to the bar's hairline — the bar starts at the
						   column's padding-bottom minus 8. */
						mt: 1.5,
						mb: -1,
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'space-between',
						gap: 2,
						flexWrap: 'wrap'
					}}
				>
					<ButtonBase
						sx={{
							'display': 'flex',
							'alignItems': 'center',
							'gap': 1.5,
							'px': 2,
							'py': 1.25,
							'borderRadius': '999px',
							'bgcolor': registrationMd3.surfaceContainer,
							'fontSize': 14,
							'& svg': { color: registrationMd3.primary }
						}}
					>
						<SentimentSatisfiedAltOutlinedIcon />
						Ruhige Begleitung, bis es losgeht
					</ButtonBase>
					<Typography
						component="a"
						href="/registration"
						sx={{
							fontSize: 14,
							color: registrationMd3.onSurfaceVariant
						}}
					>
						Lieber schreiben statt warten? Zur Mail-Beratung →
					</Typography>
				</Box>
			)}

			{/* The bar is the loading bar: it fills as the queue moves, the
			    arrow is a turning clock until it is open. */}
			{!accepted && (
				<RegistrationFooter>
					<Box sx={{ width: '100%' }}>
						<HandoverGateButton
							state="queued"
							onEnter={() => undefined}
							label="Warteraum"
							status={`${ahead} vor Ihnen — Sie müssen nichts tun`}
							progress={progress}
							icon={<TurningClock />}
						/>
					</Box>
				</RegistrationFooter>
			)}

			{/* Consent slides in from below — over the content, carrying the
			    button that starts the chat. Same movement as the footer's own
			    entry (`animateIn`). Beside it a round X: nobody is left with
			    a single choice. The X asks "Sind Sie sicher?" through the
			    dialog that already exists. */}
			{accepted && (
				<Box
					data-cy="live-chat-consent"
					sx={{
						'position': 'fixed',
						'bottom': 0,
						'right': 0,
						'width': { xs: '100vw', lg: '60vw' },
						'zIndex': 65,
						'px': { xs: 2, sm: 5 },
						'pb': {
							xs: 'calc(12px + env(safe-area-inset-bottom))',
							sm: 3
						},
						'pt': 3,
						'bgcolor': 'rgba(255,255,255,0.96)',
						'backdropFilter': 'blur(8px)',
						'borderTop': `1px solid ${registrationMd3.outlineVariant}`,
						'animation':
							'liveChatConsentIn 420ms cubic-bezier(0.4,0,0.2,1) both',
						'@keyframes liveChatConsentIn': {
							from: { transform: 'translateY(100%)' },
							to: { transform: 'translateY(0)' }
						},
						'@media (prefers-reduced-motion: reduce)': {
							animation: 'none'
						}
					}}
				>
					<Box sx={{ maxWidth: 720, mx: 'auto' }}>
						{/* The consent sentence through the same sanitizer the
						    dialog uses (ADR-022 Gate 2) — but not the dialog
						    itself: it brings its own two buttons, and the bar
						    below is the one that acts. */}
						<Box
							sx={{
								display: 'flex',
								gap: 2,
								alignItems: 'flex-start'
							}}
						>
							<ShieldOutlinedIcon
								aria-hidden
								sx={{
									fontSize: 40,
									color: registrationMd3.primary,
									flexShrink: 0
								}}
							/>
							<Box sx={{ minWidth: 0 }}>
								{/* The headline is the call to action — the person is
								    up, a counsellor is waiting — not a greeting. Anonymity
								    and deletion stand in card 3 above, not repeated here. */}
								<Typography
									sx={{ fontSize: 22, fontWeight: 700 }}
								>
									Sie sind dran.
								</Typography>
								<Typography
									sx={{
										mt: 0.5,
										fontSize: 15,
										color: registrationMd3.onSurfaceVariant
									}}
								>
									{AGENCY} hat Ihr Gespräch angenommen und
									wartet auf Sie.
								</Typography>
								<Typography
									component="div"
									sx={{
										'mt': 1.25,
										'fontSize': 14,
										'lineHeight': '20px',
										'fontWeight': 600,
										'& a': {
											color: registrationMd3.primary
										}
									}}
								>
									{htmlParser(
										sanitizeConsentHtml(CONSENT_HTML)
									)}
								</Typography>
							</Box>
						</Box>
						<Box
							sx={{
								display: 'flex',
								alignItems: 'center',
								gap: 2,
								mt: 2
							}}
						>
							<ButtonBase
								aria-label="Nicht zustimmen und Chat verlassen"
								onClick={() => setLeaving(true)}
								sx={{
									width: 60,
									height: 60,
									flexShrink: 0,
									borderRadius: '50%',
									border: `1.5px solid ${registrationMd3.outline}`,
									color: registrationMd3.onSurfaceVariant
								}}
							>
								<CloseRoundedIcon />
							</ButtonBase>
							<Box sx={{ flex: 1, minWidth: 0 }}>
								<HandoverGateButton
									state="ready"
									onEnter={() => undefined}
									label="Zustimmen & starten"
									status="Ihre Beraterin wartet auf Sie"
								/>
							</Box>
						</Box>
					</Box>
				</Box>
			)}

			<LeaveQueueDialog
				open={leaving}
				canStartChat={accepted}
				onStay={() => setLeaving(false)}
				onStartChat={() => setLeaving(false)}
				onDeleteAccess={() => setLeaving(false)}
			/>
		</Staged>
	);
};

export const StepWaiting: StoryObj = {
	name: 'B — Warteraum: wartet',
	render: () => <WaitingRoom accepted={false} ahead={3} total={5} />,
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				story: 'Eine Seite, drei Stellen, die sich ändern: Zeile 2 im Header, der Satz unter dem Titel, der Knopf. Die Punkte sind die Schlange (zwei von fünf schon dran), der Knopf ist der Ladebalken mit drehender Uhr statt Pfeil. Drei schematische Karten sagen, was gerade passiert; die Bilder sind Platzhalter, die Briefs stehen im Code (`CARDS`). Kleine Zeile: ruhige Begleitung · Mail-Beratung. Kein Träger — den kennt noch niemand.'
			}
		}
	}
};

export const StepAccepted: StoryObj = {
	name: 'B — Warteraum: Beraterin ist da',
	render: () => <WaitingRoom accepted />,
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				story: 'Derselbe Screen. Zeile 2 heißt jetzt „Caritas Berlin — Schuldenberatung", der Satz „Eine Beraterin ist da", die dritte Karte leuchtet. Von unten slidet die Datenschutz-Karte des Trägers herein — mit dem Knopf „Zustimmen und Chat starten" und dem runden X daneben. Das X fragt „Sind Sie sicher?" (der vorhandene Dialog) und schließt dann. Kommt auch über die Atemübung — hart, in dem Moment zählt nur das.'
			}
		}
	}
};

export const StepAcceptedMobile: StoryObj = {
	name: 'B — Beraterin ist da, mobil',
	globals: phone375Globals,
	render: () => <WaitingRoom accepted />,
	parameters: { layout: 'fullscreen' }
};

export const StepWaitingMobile: StoryObj = {
	name: 'B — Warteraum, mobil',
	globals: phone375Globals,
	render: () => <WaitingRoom accepted={false} ahead={3} total={5} />,
	parameters: { layout: 'fullscreen' }
};

/* ---------------------------------------------------------------------------
   C — Geschlossen
   --------------------------------------------------------------------------- */

/** The week as a strip: open days carry their hours, closed days stay quiet. */
const WEEK: Array<{ short: string; hours?: string }> = [
	{ short: 'Mo', hours: '10–17' },
	{ short: 'Di', hours: '10–17' },
	{ short: 'Mi', hours: '10–17' },
	{ short: 'Do', hours: '10–17' },
	{ short: 'Fr', hours: '10–13' },
	{ short: 'Sa' },
	{ short: 'So' }
];

const Closed = () => {
	const narrow = useMediaQuery('(max-width:599px)');
	return (
		<Staged statusLine="Gerade geschlossen">
			<Box
				sx={{
					flex: 1,
					display: 'flex',
					flexDirection: 'column',
					justifyContent: 'center',
					alignItems: 'center',
					textAlign: 'center',
					maxWidth: 560,
					mx: 'auto'
				}}
			>
				<Box
					aria-hidden
					sx={{
						'width': 72,
						'height': 72,
						'borderRadius': '50%',
						'bgcolor': registrationMd3.surfaceContainer,
						'color': registrationMd3.primary,
						'display': 'flex',
						'alignItems': 'center',
						'justifyContent': 'center',
						'mb': 2.5,
						'& svg': { fontSize: 36 }
					}}
				>
					<ScheduleOutlinedIcon />
				</Box>
				<Typography
					component="h1"
					sx={{
						fontSize: { xs: 28, sm: 32 },
						lineHeight: 1.15,
						fontWeight: 700
					}}
				>
					Der Live-Chat ist gerade geschlossen.
				</Typography>
				{/* The week as a strip instead of a sentence of weekdays: open
			    days stand out with their hours, closed days stay grey. Read at
			    a glance, nothing to parse. */}
				<Box
					role="list"
					aria-label="Öffnungszeiten"
					sx={{
						display: 'flex',
						gap: { xs: 0.5, sm: 1 },
						mt: 3,
						width: '100%',
						justifyContent: 'center'
					}}
				>
					{WEEK.map((day) => (
						<Box
							key={day.short}
							role="listitem"
							sx={{
								flex: { xs: '1 1 0', sm: '0 0 60px' },
								minWidth: 0,
								py: 1.25,
								borderRadius: '14px',
								bgcolor: day.hours
									? registrationMd3.selectedLayer
									: registrationMd3.surfaceContainer,
								color: day.hours
									? registrationMd3.primary
									: registrationMd3.onSurfaceVariant
							}}
						>
							<Typography sx={{ fontSize: 13, fontWeight: 700 }}>
								{day.short}
							</Typography>
							<Typography sx={{ fontSize: 12, mt: 0.25 }}>
								{day.hours ?? '—'}
							</Typography>
						</Box>
					))}
				</Box>
				<Typography
					sx={{
						mt: 3,
						fontSize: 15,
						color: registrationMd3.onSurfaceVariant
					}}
				>
					{narrow ? ABSENCE_MESSAGE_SHORT : ABSENCE_MESSAGE}
				</Typography>
			</Box>
			{/* One long way on, one short way out — they need not be the same
		    size. "Anfrage", not "Beratung": what starts here is a written
		    request a counsellor answers within two working days. */}
			<RegistrationFooter
				secondary={{ label: 'Später', compact: true, round: narrow }}
				primary={{
					label: narrow
						? 'Anfrage schreiben'
						: 'Anfrage an eine Beratungsstelle schreiben'
				}}
			/>
		</Staged>
	);
};

export const StepClosed: StoryObj = {
	name: 'C — Geschlossen',
	render: () => <Closed />,
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				story: 'Zentriert, in der Spalte, nicht links oben: Uhr, Titel, die regulären Öffnungszeiten direkt sichtbar (kein Aufklapper — wer hier landet, will genau das wissen), Abwesenheitstext des Trägers. Texte aus `anonymousChat.noAvailability.*`. Fuß: Später · Zur Mail-Beratung.'
			}
		}
	}
};

export const StepClosedMobile: StoryObj = {
	name: 'C — Geschlossen, mobil',
	globals: phone375Globals,
	render: () => <Closed />,
	parameters: { layout: 'fullscreen' }
};
