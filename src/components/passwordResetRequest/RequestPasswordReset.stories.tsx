import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { RequestPasswordReset } from './RequestPasswordReset';
import { RequestPasswordResetFormView } from './RequestPasswordResetFormView';
import { PasswordResetSentView } from './PasswordResetSentView';
import { StageLayout } from '../stageLayout/StageLayout';
import { GlobalComponentContext } from '../../globalState/provider/GlobalComponentContext';
import { AgencySpecificContext } from '../../globalState/provider/AgencySpecificProvider';
import { Stage } from '../stage/stage';
import { APP_ORISO_FIGMA_URL } from '../storybookDesignLinks';
import '../login/login.styles';
import './requestPasswordReset.styles';

const withStage = (Story: React.ComponentType) => (
	<AgencySpecificContext.Provider
		value={{ specificAgency: null, setSpecificAgency: () => {} }}
	>
		<GlobalComponentContext.Provider value={{ Stage }}>
			<Story />
		</GlobalComponentContext.Provider>
	</AgencySpecificContext.Provider>
);

const meta = {
	title: 'Organisms/RequestPasswordReset',
	component: RequestPasswordReset,
	tags: ['autodocs'],
	decorators: [withStage],
	parameters: {
		design: {
			type: 'figma',
			url: APP_ORISO_FIGMA_URL
		},
		docs: {
			description: {
				component:
					'ORISO-Helm#72 follow-up: in-app, branded replacement for the ' +
					'"Passwort vergessen?" flow, which previously redirected to ' +
					"Keycloak's unbranded hosted pages. Submitting requests a " +
					'one-time reset email from UserService (mirrors the existing ' +
					'Magic Link self-service flow) and swaps to the confirmation ' +
					'state inline, the same way the Login page swaps in its ' +
					'Magic Link "sent" info text. See the RequestForm and Sent ' +
					'stories for each screen state on its own.'
			}
		}
	}
} satisfies Meta<typeof RequestPasswordReset>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Live, stateful container — wired to the real submit handler. */
export const Default: Story = {};

/** The request-email screen on its own (matches the design review's step 2). */
export const RequestForm: Story = {
	render: () => {
		const StoryShell = () => {
			const { Stage: StageComponent } = React.useContext(
				GlobalComponentContext
			);
			const [username, setUsername] = useState('');
			return (
				<StageLayout
					stage={<StageComponent hasAnimation={false} isReady />}
					showLegalLinks
				>
					<div className="loginForm">
						<div className="loginForm__inner">
							<RequestPasswordResetFormView
								username={username}
								onUsernameChange={(e) =>
									setUsername(e.target.value)
								}
								onSubmit={() => {}}
								onBackToLogin={() => {}}
								disabled={!username.trim()}
							/>
						</div>
					</div>
				</StageLayout>
			);
		};
		return <StoryShell />;
	}
};

/** The confirmation screen on its own (matches the design review's step 3). */
export const Sent: Story = {
	render: () => (
		<StageLayout
			stage={<Stage hasAnimation={false} isReady />}
			showLegalLinks
		>
			<div className="loginForm">
				<div className="loginForm__inner">
					<PasswordResetSentView
						username="asker@example.com"
						onBackToLogin={() => {}}
					/>
				</div>
			</div>
		</StageLayout>
	)
};
