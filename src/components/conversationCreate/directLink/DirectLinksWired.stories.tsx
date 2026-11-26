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

/**
 * #2252: "Link erstellen" opens the shared Direkteinladung dialog; its
 * defaults (no date, guests and accounts, knock) create the link.
 */
const confirmInvitationDialog = async (canvasElement: HTMLElement) => {
	const dialog = await within(canvasElement.ownerDocument.body).findByTestId(
		'invitation-dialog'
	);
	await userEvent.click(
		within(dialog).getByRole('button', { name: 'Erstellen' })
	);
	return dialog;
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
			canvas.getByRole('button', { name: 'Videoanruf' })
		);
		await userEvent.click(
			canvas.getByRole('button', { name: 'Link erstellen' })
		);
		await confirmInvitationDialog(canvasElement);

		const share = await body.findByTestId('direct-link-share-dialog');
		await expect(
			within(share).getByRole('textbox', { name: 'Direkteinladung' })
		).toHaveValue('https://app.oriso.org/invite/tok100');
		await expect(
			await within(share).findByRole('img', {
				name: 'QR-Code zur Direkteinladung'
			})
		).toBeInTheDocument();
		const create = directLinkMock().requests.find(
			(request) => request.method === 'POST'
		);
		// One Beratungsstelle: no agency id. Guests may come in by default,
		// so the link makes a temporary account. The dialog's access is the
		// mode (BOTH = GUEST_CHOOSES, UserService#1662); no separate field.
		await expect(create?.body).toEqual({
			medium: 'VIDEO',
			topicId: 4,
			temporary: true,
			name: 'Schulden',
			accessMode: 'BOTH',
			knock: true
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
		await userEvent.click(canvas.getByRole('button', { name: 'Chat' }));
		await userEvent.click(
			canvas.getByRole('button', { name: 'Link erstellen' })
		);
		await confirmInvitationDialog(canvasElement);
		// A chat link open to both keeps a permanent account by default
		// (Grilling 2026-10-27); only calls default to a temporary one.
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
				accessMode: 'BOTH',
				knock: true,
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
		await expect(
			canvas.getAllByRole('button', { pressed: false })
		).toHaveLength(1);
		await expect(
			canvas.getByRole('button', { name: 'Chat' })
		).toBeVisible();
		await expect(
			canvas.queryByRole('button', { name: 'Videoanruf' })
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
		await userEvent.click(canvas.getByRole('button', { name: 'Chat' }));
		await userEvent.click(
			canvas.getByRole('button', { name: 'Link erstellen' })
		);
		// The dialog stays open and says so.
		const dialog = await confirmInvitationDialog(canvasElement);
		await expect(
			await within(dialog).findByRole('alert')
		).toHaveTextContent('Der Link konnte nicht erstellt werden.');
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
			display: 'flex',
			background: 'var(--m3-surface-container, #f0eded)'
		}}
	>
		<CounsellorDashboardWired
			headline="Kurz durchatmen. Alles erledigt."
			variant="conversation-nothing-to-do"
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

export const OverviewWithFigures: Story = {
	name: 'Gespräche · overview: the cup and her own figures',
	globals: desktop1440Globals,
	beforeEach: () => installDirectLinkMockApi({ links: [fixtureLink(1)] }),
	render: () => <Overview />,
	play: async ({ canvas }) => {
		// Frank, 2026-11-25 (variant C): no tiles and no invitation line;
		// direct links are managed in "Meine Termine".
		await expect(
			await canvas.findByTestId('counsellor-dashboard-figures')
		).toBeVisible();
		await expect(canvas.queryByText('Flyer Schule')).toBeNull();
		await expect(canvas.queryByRole('switch')).toBeNull();
		const stats = directLinkMock().requests.find((request) =>
			request.path.includes('/statistics/consultant')
		);
		await expect(stats).toBeTruthy();
		await expect(
			directLinkMock().requests.some((request) =>
				request.path.includes('/directlinks')
			)
		).toBe(false);
	}
};

export const OverviewStatisticsOff: Story = {
	name: 'Gespräche · Träger switched statistics off: the cup only',
	globals: desktop1440Globals,
	beforeEach: () => installDirectLinkMockApi({ links: [fixtureLink(1)] }),
	render: () => (
		<TenantContext.Provider value={withoutStatistics}>
			<Overview />
		</TenantContext.Provider>
	),
	play: async ({ canvas }) => {
		await expect(
			await canvas.findByTestId('counsellor-dashboard')
		).toBeVisible();
		await expect(
			canvas.queryByTestId('counsellor-dashboard-figures')
		).toBeNull();
		await expect(
			directLinkMock().requests.some((request) =>
				request.path.includes('/statistics/consultant')
			)
		).toBe(false);
	}
};
