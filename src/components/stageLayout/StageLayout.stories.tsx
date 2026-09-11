import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { StageLayout } from './StageLayout';
import { Stage } from '../stage/stage';
import { LoginSecurityExplainer } from '../login/LoginSecurityExplainer';
import '../login/login.styles.scss';

/**
 * A stand-in for the real login form: same class names, no auth wiring, so the
 * story stays about the layout (design 2d desktop / 2e mobile).
 */
const LoginCard = () => {
	const [isSecurityOpen, setIsSecurityOpen] = useState(false);

	return (
		<div
			className={`loginForm${
				isSecurityOpen ? ' loginForm--securityOpen' : ''
			}`}
		>
			<div className="loginForm__inner loginForm__pane loginForm__pane--login">
				<div className="loginForm__headline">
					<h2>Anmelden</h2>
				</div>
				<div className="loginForm__fields">
					<input placeholder="Benutzername/E-Mail" />
					<input placeholder="Passwort" type="password" />
				</div>
				<div className="loginForm__actions">
					<button type="button" className="button__item">
						Anmelden
					</button>
					<button type="button" className="button-as-link">
						Passwort vergessen?
					</button>
				</div>
				<div className="loginForm__separator" />
				<button
					type="button"
					className="loginForm__securityTeaser"
					onClick={() => setIsSecurityOpen(true)}
				>
					<span className="loginForm__securityTeaserText">
						Ende-zu-Ende verschlüsselt — der Schlüssel entsteht auf
						Ihrem Gerät.
					</span>
					<span className="loginForm__securityTeaserTextShort">
						Schlüssel nur auf Ihrem Gerät
					</span>
					<span className="loginForm__securityTeaserLink">
						Warum das extra sicher ist
					</span>
					<span className="loginForm__securityTeaserLinkShort">
						Warum das sicher ist
					</span>
				</button>
			</div>
			<div className="loginForm__inner loginForm__pane loginForm__pane--info">
				<LoginSecurityExplainer
					onBack={() => setIsSecurityOpen(false)}
				/>
			</div>
		</div>
	);
};

const meta: Meta<typeof StageLayout> = {
	title: 'Login/Stage layout',
	component: StageLayout,
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component: [
					'`StageLayout` after the login redesign.',
					'',
					'**Desktop (design 2d)** — language pill on the left, "Neu hier?"',
					'plus a *filled* primary CTA on the right, because registration is',
					'the onboarding path and therefore the stronger call to action.',
					'',
					'**Mobile (design 2e)** — below `$fromXLarge` the desktop stage is',
					'not rendered at all, so mobile gets its own dramaturgy instead of',
					'a shrunken desktop: a 230px red head and the content below it as',
					'a white sheet overlapping it by 28px. Pure CSS — no canvas, no',
					'image, no effect script ever reaches a phone.'
				].join('\n')
			}
		}
	}
};

export default meta;
type Story = StoryObj<typeof StageLayout>;

export const Desktop: Story = {
	render: () => (
		<StageLayout
			stage={<Stage hasAnimation={false} isReady />}
			showLegalLinks
			showRegistrationLink
		>
			<LoginCard />
		</StageLayout>
	)
};

export const Mobile: Story = {
	render: () => (
		<StageLayout
			stage={<Stage hasAnimation={false} isReady />}
			showLegalLinks
			showRegistrationLink
		>
			<LoginCard />
		</StageLayout>
	),
	parameters: { viewport: { defaultViewport: 'mobile1' } }
};
