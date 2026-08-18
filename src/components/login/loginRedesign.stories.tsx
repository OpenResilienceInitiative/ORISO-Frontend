import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box, Typography } from '@mui/material';
import { LocaleSwitchPill } from '../localeSwitch/LocaleSwitchPill';
import { StageMobileHero } from '../stageLayout/StageMobileHero';
import { LoginSecurityExplainer } from './LoginSecurityExplainer';
import { Login } from './Login';
import { Stage } from '../stage/stage';
import { GlobalComponentContext } from '../../globalState/provider/GlobalComponentContext';
import { TenantContext } from '../../globalState/provider/TenantProvider';
import { LegalLinksProvider } from '../../globalState/provider/LegalLinksProvider';

/**
 * Design turn 2d (desktop) / 2e (mobile) for the login screen, part by part.
 *
 * The teaser line under the form and the explainer card it opens ship together
 * here — the card is `LoginSecurityExplainer`, the line lives inside `Login`.
 */
const meta: Meta = {
	title: 'Login/Redesign 2d–2e',
	parameters: {
		docs: {
			description: {
				component:
					'Bausteine des Login-Redesigns 2d/2e: Sprach-Pill, mobiler Kopf, E2E-Erklärkarte. Der Bühneneffekt liegt unter `Stage/Login effects`.\n\nZwei Entwurfsentscheidungen, die hier nicht mehr sichtbar sind, aber den Ausschlag gaben: Das alte `loginForm__securityBanner` war smaragdgrün — der einzige Fremdton der Seite, und eine Warnbox für etwas, das keine Warnung ist. Ersatz ist die ruhige Teaser-Zeile mit dem Link „Warum das extra sicher ist“. Und die Rechtstexte öffnen als Modal statt als zweiter Tab: der Login ist der erste Bildschirm, ein Tabwechsel verliert die Anmeldung. Dort ist noch **keine Beratungsstelle gewählt**, der Hinweis gilt also bewusst auf Plattformebene — der verbindliche Text liegt einen Klick weiter.'
			}
		}
	}
};

export default meta;

const Caption = ({ children }: { children: React.ReactNode }) => (
	<Typography
		sx={{ fontSize: 12, fontWeight: 700, mb: 1.5, color: 'text.secondary' }}
	>
		{children}
	</Typography>
);

export const LanguagePill: StoryObj = {
	name: 'Sprach-Pill (Kopf, Desktop)',
	parameters: {
		docs: {
			description: {
				story: 'Ersetzt im Login-Kopf das react-select-Control. Die Pill versorgt sich selbst aus dem `LocaleContext` — Optionen, aktuelle Sprache und das `lang`-Cookie liegen in der Komponente, sie nimmt keine Daten-Props. `variant="circle"` ist dieselbe Pill als Kreis für den mobilen Kopf.'
			}
		}
	},
	render: () => (
		<Box sx={{ width: 420, minHeight: 380, pt: 1 }}>
			<Caption>Geschlossen und geöffnet (auf „Deutsch“ klicken)</Caption>
			<LocaleSwitchPill />
		</Box>
	)
};

export const MobileHero: StoryObj = {
	name: 'Mobiler Kopf (2e)',
	parameters: {
		docs: {
			description: {
				story: '230 pt roter Kopf: Radial-Gradient und zwei Haarlinien-Ringe, alles CSS. Kein Wellenmuster, kein Canvas, kein Lichtkegel — auf dem Handy wird der Effekt-Code gar nicht erst geladen.'
			}
		}
	},
	render: () => (
		<Box
			sx={{
				width: 390,
				border: '1px solid rgba(0,0,0,.14)',
				borderRadius: 2,
				overflow: 'hidden'
			}}
		>
			<StageMobileHero action={<LocaleGlobe />} />
			<Box
				sx={{
					position: 'relative',
					zIndex: 2,
					mt: '-28px',
					borderRadius: '28px 28px 0 0',
					bgcolor: '#fff',
					boxShadow: '0 -4px 24px rgba(0,0,0,.08)',
					p: 3,
					minHeight: 180
				}}
			>
				<Typography
					sx={{
						fontSize: 22,
						fontWeight: 500,
						textAlign: 'center',
						color: 'var(--m3-on-surface, #1a1c1e)'
					}}
				>
					Anmelden
				</Typography>
			</Box>
		</Box>
	)
};

const LocaleGlobe = () => (
	<Box
		aria-hidden
		component="span"
		sx={{ display: 'flex', color: 'inherit' }}
	>
		<svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor">
			<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm6.9 6h-2.95a15.6 15.6 0 0 0-1.38-3.56A8.03 8.03 0 0 1 18.9 8ZM12 4.04c.83 1.2 1.48 2.53 1.91 3.96h-3.82c.43-1.43 1.08-2.76 1.91-3.96ZM4.26 14a7.98 7.98 0 0 1 0-4h3.38a16.5 16.5 0 0 0 0 4H4.26Zm.84 2h2.95c.32 1.25.79 2.45 1.38 3.56A7.99 7.99 0 0 1 5.1 16Zm2.95-8H5.1a7.99 7.99 0 0 1 4.33-3.56A15.6 15.6 0 0 0 8.05 8ZM12 19.96A13.9 13.9 0 0 1 10.09 16h3.82A13.9 13.9 0 0 1 12 19.96ZM14.34 14H9.66a14.7 14.7 0 0 1 0-4h4.68a14.7 14.7 0 0 1 0 4Zm.23 5.56c.59-1.11 1.06-2.31 1.38-3.56h2.95a8.03 8.03 0 0 1-4.33 3.56ZM16.36 14a16.5 16.5 0 0 0 0-4h3.38a7.98 7.98 0 0 1 0 4h-3.38Z" />
		</svg>
	</Box>
);

export const SecurityExplainer: StoryObj = {
	name: 'Erklärkarte „Warum das extra sicher ist“',
	parameters: {
		docs: {
			description: {
				story: 'Fährt an der Stelle des Formulars ein, wenn man die Teaser-Zeile unter dem Login klickt — kein zweiter Bildschirm, kein Tabwechsel. Das Argument ist der Schlüssel, nicht das Schloss: er entsteht auf dem Gerät und bleibt dort, die Server tragen nur Rauschen. Deshalb löst sich das Hex-Rauschen in der Mitte auch nie auf; ein Scrambler, der am Ende Klartext zeigt, würde die gegenteilige Geschichte erzählen. Bei `prefers-reduced-motion` steht es still.'
			}
		}
	},
	render: () => (
		<Box
			sx={{
				width: 560,
				bgcolor: '#fff',
				border: '1px solid rgba(0,0,0,.06)',
				borderRadius: '24px',
				px: 4,
				py: 3
			}}
		>
			<Caption>
				Zurück führt auf das Formular, nicht auf eine neue Seite
			</Caption>
			<LoginSecurityExplainer onBack={() => undefined} />
		</Box>
	)
};

/**
 * The whole screen, rendered from the real `Login` component.
 *
 * MUI breakpoints follow the browser viewport, not this frame — switch
 * Storybook's viewport to a phone to see 2e, or leave it wide for 2d.
 */
const STORY_TENANT = {
	id: 1,
	name: 'Caritas',
	subdomain: 'caritas',
	theming: {},
	licensing: { allowedNumberOfUsers: 1000 },
	settings: {},
	content: {
		impressum:
			'<h2>Angaben gemäß § 5 TMG</h2><p>Diesen Text pflegt der Plattformbetreiber im Admin-Panel unter <strong>Legal</strong>.</p>',
		privacy:
			'<h2>Verantwortliche Stelle</h2><p>Auch dieser Text kommt aus dem Admin-Panel. Pflegt ein Träger nichts, öffnet der Link weiter die externe Seite.</p>'
	}
} as any;

/**
 * The story supplies a tenant with maintained legal texts and the two legal
 * links, because the shared preview has neither — without them the stage shows
 * no links to click and the header CTA (which only appears for a tenant) would
 * be missing.
 */
const LoginScreen = () => (
	<TenantContext.Provider
		value={{ tenant: STORY_TENANT, setTenant: () => undefined } as any}
	>
		<LegalLinksProvider
			legalLinks={[
				{
					url: '/impressum',
					label: 'login.legal.infoText.impressum'
				},
				{
					url: '/datenschutz',
					label: 'login.legal.infoText.dataprotection',
					registration: true
				}
			]}
		>
			<GlobalComponentContext.Provider value={{ Stage }}>
				<Login />
			</GlobalComponentContext.Provider>
		</LegalLinksProvider>
	</TenantContext.Provider>
);

export const FullScreen: StoryObj = {
	name: '2d / 2e — ganzer Screen',
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				story: 'Der echte `Login` in der echten `StageLayout`. Ab 1200 pt: Bühne links, Sprach-Pill und Registrierungs-CTA im Kopf. Darunter: 230-pt-Kopf und weißes Sheet. Die Teaser-Zeile unter dem Formular ist hier anklickbar — sie blendet die Erklärkarte ein.'
			}
		}
	},
	render: () => <LoginScreen />
};
