import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { TenantContext } from '../../globalState';
import { ModalProvider } from '../../globalState/provider/ModalProvider';
import { ConsultantSessionStage } from '../chatStage/__storybook__/ConsultantSessionStage';
import { stageRoute } from '../chatStage/__storybook__/chatStageFixtures';
import { GroupChatCopyLinks } from '../groupChat/GroupChatCopyLinks';
import {
	buildGroupStageListItem,
	GROUP_STAGE_CHAT_ID,
	GROUP_STAGE_ROOM_ID,
	GroupChatStage
} from '../groupChat/groupChatStageStoryShell';
import { GroupChatHeader } from '../sessionHeader/GroupChatHeader';
import {
	desktop1440Globals,
	phone390Globals
} from '../message/messageStoryShell';
import '../chatStage/chatStage.styles.scss';
import { ManagePeopleDialog } from './ManagePeopleDialog';
import type {
	ManagedPeopleSource,
	ManagedPerson,
	PersonCandidate
} from './managedPeople';

/**
 * The one dialog behind the "+" of every conversation, over the real stages
 * (feedback "Storybook-first = the wired view"). Sources run in memory, so add,
 * replace and remove behave as they will against the server.
 */

const SELMA: ManagedPerson = {
	id: 'selma',
	name: 'Selma Bouvier',
	role: 'supervisor',
	since: '2026-10-28',
	isStanding: true,
	canRemove: false,
	canReplace: true
};

const COLLEAGUES: PersonCandidate[] = [
	{ id: 'patty', name: 'Patty Bouvier' },
	{ id: 'herb', name: 'Herb Powell' },
	{ id: 'maggie', name: 'Maggie Simpson' },
	{ id: 'jacqueline', name: 'Jacqueline Bouvier' },
	{ id: 'lisa', name: 'Lisa Simpson' },
	{ id: 'spider', name: 'Spider Pig' },
	{ id: 'waylon', name: 'Waylon Smithers' }
];

interface MemorySourceOptions {
	kind: ManagedPeopleSource['kind'];
	members: ManagedPerson[];
	candidates?: PersonCandidate[];
	requiresReason?: boolean;
	failCandidates?: boolean;
	canAdd?: boolean;
	newPerson?: Partial<ManagedPerson>;
}

const useMemorySource = ({
	kind,
	members: initialMembers,
	candidates = [],
	requiresReason,
	failCandidates,
	canAdd = true,
	newPerson
}: MemorySourceOptions): ManagedPeopleSource =>
	React.useMemo(() => {
		let members = initialMembers;
		const person = (candidate: PersonCandidate, reason?: string) =>
			({
				id: candidate.id,
				name: candidate.name,
				role: 'participant',
				reason,
				since: '2026-11-04',
				canRemove: true,
				canReplace: false,
				...newPerson
			}) as ManagedPerson;
		return {
			kind,
			requiresReason,
			loadMembers: async () => members,
			loadCandidates: canAdd
				? async () => {
						if (failCandidates) throw new Error('403');
						return candidates;
					}
				: undefined,
			addPerson: canAdd
				? async (candidate, { reason }) => {
						members = [...members, person(candidate, reason)];
					}
				: undefined,
			removePerson: async ({ id }) => {
				members = members.filter((member) => member.id !== id);
			},
			replacePerson: async (old, candidate, { reason }) => {
				members = members.map((member) =>
					member.id === old.id
						? { ...old, ...person(candidate, reason) }
						: member
				);
			}
		};
		// A story's source lives as long as the story.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

const SessionStageDialog = ({
	options,
	phone
}: {
	options: MemorySourceOptions;
	phone?: boolean;
}) => {
	const source = useMemorySource(options);
	return (
		<>
			<ConsultantSessionStage
				panel={phone ? null : 'supervision'}
				phone={phone ? 'main' : undefined}
			/>
			<ManagePeopleDialog
				open
				fullScreen={phone}
				onClose={() => undefined}
				source={source}
			/>
		</>
	);
};

const noStopRequest = { current: false };

const GroupStageDialog = ({
	options,
	withInvite,
	phone
}: {
	options: MemorySourceOptions;
	withInvite?: boolean;
	phone?: boolean;
}) => {
	const listItem = React.useMemo(() => buildGroupStageListItem(3600), []);
	const source = useMemorySource(options);
	return (
		<TenantContext.Provider
			value={
				{
					tenant: {
						id: 1,
						settings: { featureGroupChatV2Enabled: true }
					},
					setTenant: () => undefined
				} as any
			}
		>
			<GroupChatStage
				listItem={listItem}
				layout={phone ? 'mobile' : 'desktop'}
			>
				<ModalProvider>
					<GroupChatHeader
						hasUserInitiatedStopOrLeaveRequest={noStopRequest}
						isJoinGroupChatView={false}
						bannedUsers={[]}
					/>
					<ManagePeopleDialog
						open
						fullScreen={phone}
						onClose={() => undefined}
						source={source}
						inviteContent={
							withInvite ? (
								<GroupChatCopyLinks
									seriesId={GROUP_STAGE_CHAT_ID}
									inviteToken="Ab3_x-Yz"
								/>
							) : undefined
						}
					/>
				</ModalProvider>
			</GroupChatStage>
		</TenantContext.Provider>
	);
};

const meta = {
	title: 'Chat/Manage people',
	tags: ['autodocs'],
	parameters: {
		layout: 'fullscreen',
		router: { initialPath: stageRoute },
		docs: {
			description: {
				component:
					'One dialog to see, add, replace, remove and invite the people of a conversation. A `ManagedPeopleSource` decides what is possible for each chat type.'
			}
		}
	},
	globals: desktop1440Globals
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const SUPERVISION: MemorySourceOptions = {
	kind: 'supervision',
	members: [SELMA],
	candidates: COLLEAGUES.slice(0, 3),
	requiresReason: true
};

const dialogCanvas = () => within(document.body);

/** The case Frank found: a readable name, the standing assignment, real choices. */
export const SupervisionStanding: Story = {
	render: () => <SessionStageDialog options={SUPERVISION} />,
	play: async () => {
		const canvas = dialogCanvas();
		await canvas.findByText('Selma Bouvier');
		await expect(document.body.textContent).not.toContain('enc.');
		await expect(
			canvas.queryByRole('button', { name: /Selma Bouvier entfernen/ })
		).toBeNull();
		await canvas.findByRole('button', {
			name: /Selma Bouvier wechseln/
		});
	}
};

/** Picking somebody asks for the reason before anything changes. */
export const SupervisionAddWithReason: Story = {
	render: () => <SessionStageDialog options={SUPERVISION} />,
	play: async () => {
		const canvas = dialogCanvas();
		await userEvent.click(
			await canvas.findByRole('button', {
				name: 'Patty Bouvier hinzufügen'
			})
		);
		await userEvent.click(
			await canvas.findByRole('button', {
				name: 'Patty Bouvier hinzufügen'
			})
		);
		await canvas.findByText('Bitte geben Sie einen Grund an.');
		await userEvent.type(
			canvas.getByRole('textbox', { name: /Grund/ }),
			'Zweite Meinung zum Schuldenplan'
		);
		await userEvent.click(
			canvas.getByRole('button', { name: 'Patty Bouvier hinzufügen' })
		);
		await waitFor(() =>
			expect(
				canvas.getByText('Zweite Meinung zum Schuldenplan')
			).toBeTruthy()
		);
		await canvas.findByRole('button', { name: 'Patty Bouvier entfernen' });
	}
};

/** Standing supervision changes hands: the new person stays standing. */
export const SupervisionReplace: Story = {
	render: () => (
		<SessionStageDialog
			options={{
				...SUPERVISION,
				newPerson: {
					role: 'supervisor',
					isStanding: true,
					canRemove: false,
					canReplace: true
				}
			}}
		/>
	),
	play: async () => {
		const canvas = dialogCanvas();
		await userEvent.click(
			await canvas.findByRole('button', {
				name: 'Selma Bouvier wechseln'
			})
		);
		await canvas.findByRole('heading', {
			name: 'Wer soll Selma Bouvier ablösen?'
		});
		await canvas.findByRole('button', { name: 'Herb Powell auswählen' });
	}
};

/** Today's Dev data: nobody is marked as a supervisor, so nobody can take over. */
export const SupervisionNobodyAvailable: Story = {
	render: () => (
		<SessionStageDialog options={{ ...SUPERVISION, candidates: [] }} />
	),
	play: async () => {
		const canvas = dialogCanvas();
		await canvas.findByText(/sonst niemand als Supervisor:in markiert/);
		await waitFor(() =>
			expect(
				canvas.getByRole('button', { name: 'Selma Bouvier wechseln' })
			).toBeDisabled()
		);
	}
};

/** The list failing says so and offers a retry; the people stay visible. */
export const SupervisionListFailed: Story = {
	render: () => (
		<SessionStageDialog
			options={{ ...SUPERVISION, failCandidates: true }}
		/>
	),
	play: async () => {
		const canvas = dialogCanvas();
		await canvas.findByRole('alert');
		await canvas.findByText('Selma Bouvier');
		await canvas.findByRole('button', { name: 'Erneut versuchen' });
	}
};

const INTERNAL_MEMBERS: ManagedPerson[] = [
	{
		id: 'marge',
		name: 'Marge Simpson',
		role: 'owner',
		isSelf: false,
		canRemove: false,
		canReplace: false
	},
	{
		id: 'me',
		name: 'Agnes Skinner',
		role: 'coModerator',
		isSelf: true,
		canRemove: false,
		canReplace: false
	},
	{
		id: 'herb',
		name: 'Herb Powell',
		role: 'coModerator',
		canRemove: false,
		canReplace: false
	}
];

/** A member of an internal chat can add colleagues but remove nobody. */
export const InternalChatAsMember: Story = {
	render: () => (
		<GroupStageDialog
			options={{
				kind: 'internalChat',
				members: INTERNAL_MEMBERS,
				candidates: COLLEAGUES,
				newPerson: { role: 'coModerator', canRemove: false }
			}}
		/>
	),
	play: async () => {
		const canvas = dialogCanvas();
		await canvas.findByText(/erst ab ihrem Beitritt/);
		await canvas.findByRole('searchbox', { name: /suchen/ });
		await expect(
			canvas.queryByRole('button', { name: /entfernen$/ })
		).toBeNull();
		await userEvent.click(
			await canvas.findByRole('button', {
				name: 'Lisa Simpson hinzufügen'
			})
		);
		await waitFor(() =>
			expect(
				canvas.queryByRole('button', {
					name: 'Lisa Simpson hinzufügen'
				})
			).toBeNull()
		);
		await canvas.findByText('Lisa Simpson');
	}
};

/** The owner can also remove; a second click confirms inside the row. */
export const InternalChatAsOwner: Story = {
	render: () => (
		<GroupStageDialog
			options={{
				kind: 'internalChat',
				members: [
					{ ...INTERNAL_MEMBERS[0], id: 'me', isSelf: true },
					{ ...INTERNAL_MEMBERS[2], canRemove: true },
					{
						id: 'maggie',
						name: 'Maggie Simpson',
						role: 'coModerator',
						canRemove: true,
						canReplace: false
					}
				],
				candidates: COLLEAGUES.slice(2, 4)
			}}
		/>
	),
	play: async () => {
		const canvas = dialogCanvas();
		await userEvent.click(
			await canvas.findByRole('button', {
				name: 'Herb Powell entfernen'
			})
		);
		await canvas.findByText('Wirklich entfernen?');
	}
};

/** A running group: moderation plus the invite link and QR code. */
export const GroupChatWithInvite: Story = {
	render: () => (
		<GroupStageDialog
			withInvite
			options={{
				kind: 'groupChat',
				canAdd: false,
				members: [
					{ ...INTERNAL_MEMBERS[0], id: 'me', isSelf: true },
					{ ...INTERNAL_MEMBERS[2], canRemove: true }
				]
			}}
		/>
	),
	parameters: {
		router: {
			initialPath: `/sessions/consultant/sessionView/${GROUP_STAGE_ROOM_ID}/${GROUP_STAGE_CHAT_ID}`
		}
	},
	play: async () => {
		const canvas = dialogCanvas();
		await canvas.findByRole('heading', { name: 'Personen einladen' });
	}
};

/** Phone: the same dialog fills the screen, nothing is desktop-only any more. */
export const PhoneSupervision: Story = {
	globals: phone390Globals,
	render: () => <SessionStageDialog options={SUPERVISION} phone />,
	play: async () => {
		const canvas = dialogCanvas();
		await canvas.findByText('Selma Bouvier');
	}
};
