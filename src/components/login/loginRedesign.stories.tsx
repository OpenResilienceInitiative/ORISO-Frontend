import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box, Typography } from '@mui/material';
import { LocaleSwitchPill } from '../localeSwitch/LocaleSwitchPill';
import { LegalLinkDialog } from '../legalLinks/LegalLinkDialog';
import { StageMobileHero } from '../stageLayout/StageMobileHero';
import { LoginSecurityNote } from './LoginSecurityNote';
import { Login } from './Login';
import { Stage } from '../stage/stage';
import { GlobalComponentContext } from '../../globalState/provider/GlobalComponentContext';
import { TenantContext } from '../../globalState/provider/TenantProvider';
import { LegalLinksProvider } from '../../globalState/provider/LegalLinksProvider';

/**
 * Design turn 2d (desktop) / 2e (mobile) for the login screen, part by part.
 *
 * Not covered here: the end-to-end encryption explainer card the teaser line
 * points at in the design. It is
 * [#991](https://github.com/OpenResilienceInitiative/ORISO-Frontend/issues/991),
 * so the line ships without its link rather than with a dead one.
 */
const meta: Meta = {
	title: 'Login/Redesign 2d–2e',
	parameters: {
		docs: {
			description: {
				component:
					'Bausteine des Login-Redesigns 2d/2e: Sprach-Pill, Legal-Modal, mobiler Kopf, E2E-Zeile. Der Bühneneffekt liegt unter `Stage/Login effects`.'
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

/**
 * Labels as `LocaleSwitch` hands them over: the `languages` namespace's
 * "(DE) Deutsch" with the code prefix stripped, because the pill shows the code
 * in its own slot.
 */
const LOCALES = [
	{ value: 'de', label: 'Deutsch' },
	{ value: 'en', label: 'Englisch' },
	{ value: 'fr', label: 'French' },
	{ value: 'ru', label: 'Russian' },
	{ value: 'tr', label: 'Turkish' },
	{ value: 'ti', label: 'Tigrinya' }
];

export const LanguagePill: StoryObj = {
	name: 'Sprach-Pill (Kopf, Desktop)',
	parameters: {
		docs: {
			description: {
				story: 'Ersetzt im Login-Kopf das react-select-Control. Optionen kommen unverändert aus `selectableLocales` — `LocaleSwitch variant="pill"` reicht sie nur durch.'
			}
		}
	},
	render: () => {
		const [value, setValue] = useState('de');
		return (
			<Box sx={{ width: 420, minHeight: 380, pt: 1 }}>
				<Caption>Geschlossen und geöffnet (auf „Deutsch“ klicken)</Caption>
				<LocaleSwitchPill
					value={value}
					options={LOCALES}
					onChange={setValue}
					ariaLabel="Sprache wählen"
				/>
			</Box>
		);
	}
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
			<StageMobileHero
				title="Beratung & Hilfe"
				headline={'Hier ist Raum für\nIhre Anliegen.'}
				claim="Online. Anonym. Sicher."
				action={<LocaleGlobe />}
			/>
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
				<LoginSecurityNote variant="compact" />
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

export const SecurityNote: StoryObj = {
	name: 'E2E-Zeile statt grünem Banner',
	parameters: {
		docs: {
			description: {
				story: 'Das alte `loginForm__securityBanner` war smaragdgrün — der einzige Fremdton der Seite, und eine Warnbox für etwas, das keine Warnung ist. Ersatz: eine ruhige Zeile in den Neutralfarben der Seite. Der Link „Warum das extra sicher ist“ kommt mit der Erklärkarte in #991.'
			}
		}
	},
	render: () => (
		<Box sx={{ width: 560, display: 'grid', gap: 3 }}>
			<Box>
				<Caption>Desktop</Caption>
				<Box
					sx={{
						bgcolor: '#fff',
						border: '1px solid rgba(0,0,0,.06)',
						borderRadius: '24px',
						px: 7,
						py: 2
					}}
				>
					<LoginSecurityNote />
				</Box>
			</Box>
			<Box>
				<Caption>Mobil (kürzere Fassung)</Caption>
				<Box
					sx={{
						width: 350,
						bgcolor: '#fff',
						border: '1px solid rgba(0,0,0,.06)',
						borderRadius: '24px',
						px: 3,
						py: 2
					}}
				>
					<LoginSecurityNote variant="compact" />
				</Box>
			</Box>
		</Box>
	)
};

export const LegalModal: StoryObj = {
	name: 'Impressum / Datenschutz als Modal',
	parameters: {
		docs: {
			description: {
				story: 'Der Login ist der erste Bildschirm; ein zweiter Tab für die Datenschutzerklärung verliert die Anmeldung. Inhalt kommt aus dem Träger (`content.impressum` / `content.privacy`, Admin → Legal). Pflegt ein Träger nichts, bleibt der externe Link — ein Modal auf den Platzhalterhinweis wäre schlechter als die Seite, die der Link heute erreicht.'
			}
		}
	},
	render: () => {
		const [open, setOpen] = useState(true);
		return (
			<Box sx={{ minHeight: 620 }}>
				<Caption>
					Escape und Klick auf den Scrim schließen; der Fokus ist
					gefangen und kehrt zum Auslöser zurück.
				</Caption>
				<Box
					component="button"
					type="button"
					onClick={() => setOpen(true)}
					sx={{
						border: 'none',
						background: 'none',
						textDecoration: 'underline',
						cursor: 'pointer',
						color: 'var(--m3-on-surface-variant, #4f565d)',
						fontSize: 14
					}}
				>
					Datenschutzerklärung
				</Box>
				<LegalLinkDialog
					open={open}
					title="Datenschutzerklärung"
					content={
						'<h2>Verantwortliche Stelle</h2><p>Diesen Text pflegt der Plattformbetreiber im Admin-Panel unter <strong>Legal</strong>. Er wird hier sanitisiert gerendert.</p><h2>Zwecke der Verarbeitung</h2><p>Beispieltext, damit die Typografie im Modal beurteilt werden kann.</p>'
					}
					onClose={() => setOpen(false)}
				/>
			</Box>
		);
	}
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
				story: 'Der echte `Login` in der echten `StageLayout`-Variante `login`. Ab 1200 pt: Bühne links, Sprach-Pill und gefüllter Primary-CTA im Kopf. Darunter: 230-pt-Kopf und weißes Sheet.'
			}
		}
	},
	render: () => <LoginScreen />
};
