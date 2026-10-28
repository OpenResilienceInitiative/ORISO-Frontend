import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import {
	desktop1440Globals,
	phone390Globals
} from '../../message/messageStoryShell';
import { CounsellorDashboardWired } from '../../counsellorDashboard/CounsellorDashboardWired';
import { DirectLinkCreateCard } from './DirectLinkCreateCard';
import { TenantContext } from '../../../globalState/provider/TenantProvider';
import type { TenantDataInterface } from '../../../globalState/interfaces';
import {
	directLinkMock,
	fixtureLink,
	installDirectLinkMockApi
} from '../../directLinkEntry/__storybook__/directLinkMockApi';
import '../conversationCreate.styles.scss';

/**
 * **Direct link, wired** (#1795) — the counsellor's side on the real
 * requests of ORISO-UserService#1479, answered by an in-memory stand-in on
 * `fetch`: the card in "Create chat" creates the link and the share dialog
 * shows it; "Gespräche" lists the links with copy, QR and on/off, and the
 * counsellor's figures from `apiGetConsultantStatistics`.
 */
const meta: Meta = {
	title: 'ConversationCreate/Direct link/Wired (mocked API)',
	parameters: { layout: 'fullscreen' }
};
export default meta;
type Story = StoryObj;

const TOPICS = [
	{ value: '4', label: 'Schulden' },
	{ value: '5', label: 'Sozialberatung' }
];

const onDone = fn();

const Card = ({
	media = ['CHAT', 'AUDIO', 'VIDEO'] as const,
	agencies = [{ id: 88, topicIds: [4, 5] }]
}: {
	media?: readonly ('CHAT' | 'AUDIO' | 'VIDEO')[];
	agencies?: { id: number; topicIds: number[] }[];
}) => (
	<div className="conversationCreate">
		<div className="conversationCreate__single">
			<DirectLinkCreateCard
				topics={TOPICS}
				agencies={agencies}
				media={[...media]}
				onDone={onDone}
			/>
		</div>
	</div>
);

const chooseTopic = async (canvasElement: HTMLElement, topic: string) => {
	const body = within(canvasElement.ownerDocument.body);
	await userEvent.click(
		within(canvasElement).getAllByRole('button', {
			name: /Thema wählen/
		})[0]
	);
	await userEvent.click(await body.findByRole('option', { name: topic }));
};

export const CreateAndShare: Story = {
	name: 'Create chat · create a video link, then share it',
	globals: desktop1440Globals,
	beforeEach: () => {
		onDone.mockClear();
		return installDirectLinkMockApi();
	},
	render: () => <Card />,
	play: async ({ canvasElement, canvas }) => {
		const body = within(canvasElement.ownerDocument.body);
		await chooseTopic(canvasElement, 'Schulden');
		await userEvent.click(
			canvas.getByRole('radio', { name: 'Videoanruf' })
		);
		await userEvent.click(
			canvas.getByRole('button', { name: 'Link erstellen' })
		);

		const share = await body.findByTestId('direct-link-share-dialog');
		await expect(
			within(share).getByRole('textbox', { name: 'Direktlink' })
		).toHaveValue('https://app.oriso.org/invite/tok100');
		await expect(
			await within(share).findByRole('img', {
				name: 'QR-Code zum Direktlink'
			})
		).toBeInTheDocument();
		const create = directLinkMock().requests.find(
			(request) => request.method === 'POST'
		);
		// One Beratungsstelle: no agency id; calls default to a temporary account.
		await expect(create?.body).toEqual({
			medium: 'VIDEO',
			topicId: 4,
			temporary: true,
			name: 'Schulden'
		});
		await userEvent.click(
			within(share).getByRole('button', { name: 'Fertig' })
		);
		await waitFor(() => expect(onDone).toHaveBeenCalled());
	}
};

export const CreateForOneOfTwoAgencies: Story = {
	name: 'Create chat · two Beratungsstellen: the topic names the agency',
	globals: desktop1440Globals,
	beforeEach: () => installDirectLinkMockApi(),
	render: () => (
		<Card
			agencies={[
				{ id: 88, topicIds: [4] },
				{ id: 91, topicIds: [5] }
			]}
		/>
	),
	play: async ({ canvasElement, canvas }) => {
		await chooseTopic(canvasElement, 'Sozialberatung');
		await userEvent.click(canvas.getByRole('radio', { name: 'Chat' }));
		await userEvent.click(
			canvas.getByRole('button', { name: 'Link erstellen' })
		);
		await waitFor(() =>
			expect(
				directLinkMock().requests.find(
					(request) => request.method === 'POST'
				)?.body
			).toEqual({
				medium: 'CHAT',
				topicId: 5,
				temporary: false,
				name: 'Sozialberatung',
				agencyId: 91
			})
		);
		const share = await within(
			canvasElement.ownerDocument.body
		).findByTestId('direct-link-share-dialog');
		await userEvent.click(
			within(share).getByRole('button', { name: 'Fertig' })
		);
	}
};

export const OnlyAllowedMedia: Story = {
	name: 'Create chat · "Direkteinladung erlauben" only for chat',
	globals: phone390Globals,
	beforeEach: () => installDirectLinkMockApi(),
	render: () => <Card media={['CHAT']} />,
	play: async ({ canvas }) => {
		await expect(canvas.getAllByRole('radio')).toHaveLength(1);
		await expect(canvas.getByRole('radio', { name: 'Chat' })).toBeVisible();
		await expect(
			canvas.queryByRole('radio', { name: 'Videoanruf' })
		).toBeNull();
	}
};

export const CreateFails: Story = {
	name: 'Create chat · the backend refuses',
	globals: desktop1440Globals,
	beforeEach: () => installDirectLinkMockApi({ createStatus: 500 }),
	render: () => <Card />,
	play: async ({ canvasElement, canvas }) => {
		await chooseTopic(canvasElement, 'Schulden');
		await userEvent.click(canvas.getByRole('radio', { name: 'Chat' }));
		await userEvent.click(
			canvas.getByRole('button', { name: 'Link erstellen' })
		);
		await expect(await canvas.findByRole('alert')).toHaveTextContent(
			'Der Link konnte nicht erstellt werden.'
		);
		await expect(
			canvasElement.ownerDocument.querySelector(
				'[data-testid="direct-link-share-dialog"]'
			)
		).toBeNull();
	}
};

const Overview = () => (
	<div
		style={{
			height: '100vh',
			background: 'var(--m3-surface-container, #f0eded)'
		}}
	>
		<CounsellorDashboardWired
			fallback={<p data-testid="dashboard-fallback">Alles erledigt</p>}
		/>
	</div>
);

/** A Träger with statistics switched off. */
const withoutStatistics = {
	tenant: {
		id: 1,
		name: 'Träger ohne Statistik',
		settings: { featureStatisticsEnabled: false }
	} as unknown as TenantDataInterface,
	setTenant: () => undefined,
	updateTenantSettings: () => undefined
};

const inDays = (days: number, hour: number) => {
	const date = new Date();
	date.setDate(date.getDate() + days);
	date.setHours(hour, 0, 0, 0);
	return date.toISOString();
};

/** Two self-help circles in her own list, as `GET /sessions/consultants` sends them. */
const circleSessions = () => [
	{
		chat: {
			id: 71,
			topic: 'Trauer am Abend',
			conversationType: 'SELF_HELP',
			startDateWithTime: inDays(2, 19),
			duration: 90,
			modality: 'VIDEO',
			participants: [{}, {}, {}, {}],
			active: false
		}
	},
	{
		chat: {
			id: 72,
			topic: 'Schulden gemeinsam angehen',
			conversationType: 'SELF_HELP',
			startDateWithTime: inDays(5, 18),
			duration: 60,
			modality: 'TEXT',
			participants: [{}, {}],
			active: false
		}
	},
	{ session: { id: 9 }, user: { username: 'ratsuchend' } }
];

export const OverviewWithLinks: Story = {
	name: 'Gespräche · overview with real links and figures',
	globals: desktop1440Globals,
	beforeEach: () =>
		installDirectLinkMockApi({
			links: [
				fixtureLink(1),
				fixtureLink(2, {
					name: 'Aushang Rathaus',
					medium: 'CHAT',
					temporary: false,
					admission: 'DIRECT',
					active: false
				})
			]
		}),
	render: () => <Overview />,
	play: async ({ canvasElement, canvas }) => {
		await expect(await canvas.findByText('Flyer Schule')).toBeVisible();
		await expect(canvas.getByText('Aushang Rathaus')).toBeVisible();
		await waitFor(() => expect(canvas.getByText('14')).toBeVisible());
		const stats = directLinkMock().requests.find((request) =>
			request.path.includes('/statistics/consultant')
		);
		await expect(stats).toBeTruthy();

		await userEvent.click(
			canvas.getAllByRole('button', { name: 'QR-Code zeigen' })[0]
		);
		const share = await within(
			canvasElement.ownerDocument.body
		).findByTestId('direct-link-share-dialog');
		await expect(within(share).getByRole('textbox')).toHaveValue(
			'https://app.oriso.org/invite/tok1'
		);
		await userEvent.click(
			within(share).getByRole('button', { name: 'Fertig' })
		);
		await waitFor(() =>
			expect(
				canvasElement.ownerDocument.querySelector(
					'[data-testid="direct-link-share-dialog"]'
				)
			).toBeNull()
		);

		await userEvent.click(
			canvas.getByRole('switch', { name: 'Flyer Schule aktiv' })
		);
		await waitFor(() =>
			expect(
				directLinkMock().requests.find(
					(request) => request.method === 'PATCH'
				)
			).toMatchObject({
				path: expect.stringMatching(/\/directlinks\/1$/),
				body: { active: false }
			})
		);
	}
};

export const OverviewWithoutLinks: Story = {
	name: 'Gespräche · no link yet: the screen stays as it was',
	globals: desktop1440Globals,
	beforeEach: () => installDirectLinkMockApi({ links: [] }),
	render: () => <Overview />,
	play: async ({ canvas }) => {
		await expect(
			await canvas.findByTestId('dashboard-fallback')
		).toBeVisible();
	}
};

export const OverviewWithCircles: Story = {
	name: 'Gespräche · links and the next self-help circles',
	globals: desktop1440Globals,
	beforeEach: () =>
		installDirectLinkMockApi({
			links: [fixtureLink(1)],
			sessions: circleSessions()
		}),
	render: () => <Overview />,
	play: async ({ canvas }) => {
		await expect(await canvas.findByText('Trauer am Abend')).toBeVisible();
		await expect(
			canvas.getByText('Schulden gemeinsam angehen')
		).toBeVisible();
		const tile = canvas
			.getByRole('heading', { name: 'Nächste Gesprächskreise' })
			.closest('section') as HTMLElement;
		const items = within(tile).getAllByRole('listitem');
		// Soonest first; the plain conversation in the list is no circle.
		await expect(items).toHaveLength(2);
		await expect(items[0]).toHaveTextContent('Trauer am Abend');
		await expect(items[0]).toHaveTextContent('4 Teilnehmende');
	}
};

export const OverviewCirclesOnly: Story = {
	name: 'Gespräche · no link, but circles ahead',
	globals: phone390Globals,
	beforeEach: () =>
		installDirectLinkMockApi({ links: [], sessions: circleSessions() }),
	render: () => <Overview />,
	play: async ({ canvas }) => {
		await expect(await canvas.findByText('Trauer am Abend')).toBeVisible();
		await expect(canvas.queryByTestId('dashboard-fallback')).toBeNull();
	}
};

export const OverviewStatisticsOff: Story = {
	name: 'Gespräche · Träger switched statistics off: no figures',
	globals: desktop1440Globals,
	beforeEach: () => installDirectLinkMockApi({ links: [fixtureLink(1)] }),
	render: () => (
		<TenantContext.Provider value={withoutStatistics}>
			<Overview />
		</TenantContext.Provider>
	),
	play: async ({ canvas }) => {
		await expect(await canvas.findByText('Flyer Schule')).toBeVisible();
		await expect(
			canvas.queryByRole('heading', { name: 'Beratungen' })
		).toBeNull();
		await expect(
			directLinkMock().requests.some((request) =>
				request.path.includes('/statistics/consultant')
			)
		).toBe(false);
	}
};
