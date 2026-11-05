import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { AppConfigContext } from '../../globalState';
import { AppConfigInterface } from '../../globalState/interfaces';
import { SessionsDataContext } from '../../globalState/provider/SessionsDataProvider';
import { AgencyAdminContact } from './AgencyAdminContact';
import './profile.styles';

/**
 * #1915 / OBP 2.1 #117: each counselling centre in "Meine Beratungsstellen"
 * offers a link to contact the centre's admin(s). The stage answers
 * `GET /users/agencies/{id}/admin-contacts` and
 * `POST /users/chat/internal-subset` like the UserService would. What these
 * stories cannot show (room reuse, navigation into the new room) is covered by
 * the unit tests of the hook and the component.
 */

type Scenario = 'admins' | 'none' | 'loadError' | 'chatRefused';

const json = (body: unknown, status = 200, headers: HeadersInit = {}) =>
	new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json', ...headers }
	});

/**
 * Installs the fetch stand-in while rendering (children fetch in their own
 * effects, which run before a wrapper's effect would) and puts the original
 * back on unmount.
 */
const MockedUserService = ({
	scenario,
	children
}: {
	scenario: Scenario;
	children: React.ReactNode;
}) => {
	const [original] = useState(() => globalThis.fetch);
	React.useMemo(() => {
		globalThis.fetch = async (
			input: RequestInfo | URL,
			init?: RequestInit
		) => {
			const request = input instanceof Request ? input : null;
			const url = String(request ? request.url : input);
			const method = (
				init?.method ||
				request?.method ||
				'GET'
			).toUpperCase();
			if (/\/admin-contacts$/.test(url) && method === 'GET') {
				if (scenario === 'loadError') {
					return json({}, 500);
				}
				return scenario === 'none'
					? new Response(null, { status: 204 })
					: json([
							{
								consultantId: 'admin-1',
								displayName: 'Alex Admin'
							}
						]);
			}
			if (/\/chat\/internal-subset$/.test(url) && method === 'POST') {
				return json({}, 403, {
					'X-Reason': 'INTERNAL_CHAT_ENCRYPTION_REQUIRED'
				});
			}
			return original(input, init);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [scenario]);
	React.useEffect(
		() => () => {
			globalThis.fetch = original;
		},
		[original]
	);
	return <>{children}</>;
};

const stage =
	(scenario: Scenario, supportEmail?: string) =>
	(Story: React.ComponentType): React.ReactElement => (
		<MockedUserService scenario={scenario}>
			<AppConfigContext.Provider
				value={{ supportEmail } as AppConfigInterface}
			>
				<SessionsDataContext.Provider
					value={{ sessions: [], ready: true, dispatch: () => {} }}
				>
					<div
						className="profile"
						style={{ maxWidth: 560, margin: '0 auto', padding: 16 }}
					>
						<div className="profile__data__content">
							<div>
								Beratungsstelle Musterstadt
								<Story />
							</div>
						</div>
					</div>
				</SessionsDataContext.Provider>
			</AppConfigContext.Provider>
		</MockedUserService>
	);

const meta = {
	title: 'Organisms/AgencyAdminContact',
	component: AgencyAdminContact,
	tags: ['autodocs'],
	parameters: { layout: 'fullscreen' },
	args: { agencyId: 4711, agencyName: 'Beratungsstelle Musterstadt' }
} satisfies Meta<typeof AgencyAdminContact>;
export default meta;
type Story = StoryObj<typeof meta>;

/** An admin is on file: the link is offered. */
export const AdminsAvailable: Story = {
	decorators: [stage('admins')],
	play: async ({ canvasElement }) => {
		await expect(
			await within(canvasElement).findByRole('button', {
				name: 'Beratungsstellen-Admin kontaktieren'
			})
		).toBeEnabled();
	}
};

/**
 * No admin reachable by chat: a hint replaces the link (never a dead button)
 * and, because the platform admin configured a support address in the global
 * settings, a mailto link to it follows.
 */
export const NoAdmin: Story = {
	decorators: [stage('none', 'support@example.org')],
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(await canvas.findByRole('status')).toBeVisible();
		await expect(
			await canvas.findByRole('link', { name: 'support@example.org' })
		).toHaveAttribute('href', 'mailto:support@example.org');
		await expect(canvas.queryByRole('button')).not.toBeInTheDocument();
	}
};

/** No admin and no support address configured: the hint alone, no link. */
export const NoAdminNoSupportEmail: Story = {
	decorators: [stage('none')],
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(await canvas.findByRole('status')).toBeVisible();
		await expect(canvas.queryByRole('link')).not.toBeInTheDocument();
		await expect(canvas.queryByRole('button')).not.toBeInTheDocument();
	}
};

/** The admin list could not be loaded: an error hint, no link. */
export const LoadError: Story = {
	decorators: [stage('loadError')],
	play: async ({ canvasElement }) => {
		await expect(
			await within(canvasElement).findByRole('status')
		).toBeVisible();
		await expect(
			within(canvasElement).queryByRole('button')
		).not.toBeInTheDocument();
	}
};

/** The chat call is refused: the reason is shown next to the link. */
export const ChatRefused: Story = {
	decorators: [stage('chatRefused')],
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(
			await canvas.findByRole('button', {
				name: 'Beratungsstellen-Admin kontaktieren'
			})
		);
		await waitFor(() => expect(canvas.getByRole('alert')).toBeVisible());
	}
};
