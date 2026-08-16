import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { LoginSecurityExplainer } from './LoginSecurityExplainer';
import './login.styles.scss';

const meta: Meta<typeof LoginSecurityExplainer> = {
	title: 'Login/Security explainer',
	component: LoginSecurityExplainer,
	parameters: {
		docs: {
			description: {
				component: [
					'The card behind "Why is this extra safe?" on the login screen',
					'(design 2d desktop / 2e mobile). It replaces the green',
					'`loginForm__securityBanner`, which was the only foreign hue on',
					'the page.',
					'',
					'The story of the card is the **key**, not the lock: it is created',
					'on the user’s device and stays there, so the servers only ever',
					'carry noise. The hex scrambler therefore never resolves into',
					'anything readable — a scrambler that eventually settles would',
					'tell the opposite story. It holds still under',
					'`prefers-reduced-motion`.'
				].join('\n')
			}
		}
	}
};

export default meta;
type Story = StoryObj<typeof LoginSecurityExplainer>;

const Card = () => (
	<div className="loginForm" style={{ margin: '0 auto' }}>
		<div className="loginForm__inner">
			<LoginSecurityExplainer onBack={() => undefined} />
		</div>
	</div>
);

export const Desktop: Story = {
	render: () => <Card />
};

export const MobileSheet: Story = {
	render: () => <Card />,
	parameters: { viewport: { defaultViewport: 'mobile1' } }
};

/**
 * The teaser row and the slide transition together — click to flip.
 */
export const SlideFromLoginCard: Story = {
	render: function SlideStory() {
		const [isOpen, setIsOpen] = useState(false);
		return (
			<div
				className={`loginForm${isOpen ? ' loginForm--securityOpen' : ''}`}
				style={{ maxWidth: 520, margin: '0 auto' }}
			>
				<div className="loginForm__inner loginForm__pane loginForm__pane--login">
					<div className="loginForm__headline">
						<h2>Anmelden</h2>
					</div>
					<div className="loginForm__separator" />
					<button
						type="button"
						className="loginForm__securityTeaser"
						onClick={() => setIsOpen(true)}
					>
						<span className="loginForm__securityTeaserText">
							Ende-zu-Ende verschlüsselt — der Schlüssel entsteht
							auf Ihrem Gerät.
						</span>
						<span className="loginForm__securityTeaserLink">
							Warum das extra sicher ist
						</span>
					</button>
				</div>
				<div className="loginForm__inner loginForm__pane loginForm__pane--info">
					<LoginSecurityExplainer onBack={() => setIsOpen(false)} />
				</div>
			</div>
		);
	}
};
