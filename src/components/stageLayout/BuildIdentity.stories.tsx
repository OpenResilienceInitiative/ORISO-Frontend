import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { StageLayout } from './StageLayout';
import { Stage } from '../stage/stage';
import {
	BuildIdentity,
	AuthenticatedBuildIdentityBoundary
} from '../app/BuildIdentity';
import { GroupWaitingRoom } from '../groupChat/entryRoom/GroupWaitingRoom';
import { RegistrationFooter } from '../registrationFooter/RegistrationFooter';
import { LegalLinksProvider } from '../../globalState/provider/LegalLinksProvider';
import '../app/authenticatedApp.styles.scss';

const meta: Meta<typeof StageLayout> = {
	title: 'Login/Build identity',
	component: StageLayout,
	parameters: { layout: 'fullscreen' },
	decorators: [
		(Story) => (
			<LegalLinksProvider
				legalLinks={[
					{
						url: '/__fixtures__/legal/privacy',
						label: 'login.legal.infoText.dataprotection',
						registration: true
					},
					{
						url: '/__fixtures__/legal/imprint',
						label: 'login.legal.infoText.impressum',
						registration: true
					}
				]}
			>
				<Story />
			</LegalLinksProvider>
		)
	],
	beforeEach: () => {
		const runtimeWindow: Window & {
			__ORISO_RUNTIME_CONFIG__?: Record<string, string | undefined>;
		} = window;
		const previous = runtimeWindow.__ORISO_RUNTIME_CONFIG__;
		runtimeWindow.__ORISO_RUNTIME_CONFIG__ = {
			...previous,
			REACT_APP_PLATFORM_VERSION: 'v2.0.6'
		};
		return () => {
			runtimeWindow.__ORISO_RUNTIME_CONFIG__ = previous;
		};
	}
};
export default meta;
type Story = StoryObj<typeof StageLayout>;

export const Public: Story = {
	args: {
		stage: <Stage hasAnimation={false} isReady />,
		showLegalLinks: true,
		children: <p>Public content</p>
	}
};

export const Login: Story = {
	args: { ...Public.args, className: 'stageLayout--login' }
};

export const Registration: Story = {
	args: {
		...Public.args,
		className: 'stageLayout--registration',
		children: (
			<>
				<p>Registration content</p>
				<RegistrationFooter primary={{ label: 'Continue' }} />
			</>
		)
	}
};

/** Real authenticated identity and stylesheet; no authenticated session is implied. */
export const Authenticated: Story = {
	render: () => <BuildIdentity variant="authenticated" />
};

/** Actual nested waiting layout and controls; no authenticated session or API is implied. */
export const AuthenticatedWaiting: Story = {
	render: () => (
		<AuthenticatedBuildIdentityBoundary>
			<GroupWaitingRoom
				plannedStart={null}
				eventId={42}
				rules={[]}
				active={false}
				onJoin={() => {}}
				nowMs={0}
			/>
		</AuthenticatedBuildIdentityBoundary>
	)
};

/** Include the calendar action and enabled Join, which the original F5 RED did not cover. */
export const AuthenticatedWaitingCalendar: Story = {
	render: () => (
		<AuthenticatedBuildIdentityBoundary>
			<GroupWaitingRoom
				plannedStart={new Date('2026-09-17T12:00:00Z')}
				eventId={42}
				rules={[]}
				active
				onJoin={() => {}}
				nowMs={Date.parse('2026-09-17T11:00:00Z')}
			/>
		</AuthenticatedBuildIdentityBoundary>
	)
};
