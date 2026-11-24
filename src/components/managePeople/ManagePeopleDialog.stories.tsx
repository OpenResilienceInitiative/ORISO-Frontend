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
import {
	PersonChangeRefusedError,
	type ManagedPeopleSource,
	type ManagedPerson,
	type PersonCandidate
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

const SPRINGFIELD = 'Beratungsstelle Springfield';
const SHELBYVILLE = 'Suchtberatung Shelbyville';

const COLLEAGUES: PersonCandidate[] = [
	{ id: 'patty', name: 'Patty Bouvier', organisation: SPRINGFIELD },
	{ id: 'herb', name: 'Herb Powell', organisation: SHELBYVILLE },
	{ id: 'maggie', name: 'Maggie Simpson', organisation: SPRINGFIELD },
	{ id: 'jacqueline', name: 'Jacqueline Bouvier', organisation: SPRINGFIELD },
	{ id: 'lisa', name: 'Lisa Simpson', organisation: SHELBYVILLE },
	{ id: 'spider', name: 'Spider Pig', organisation: SPRINGFIELD },
	{ id: 'waylon', name: 'Waylon Smithers', organisation: SHELBYVILLE }
];

interface MemorySourceOptions {
	kind: ManagedPeopleSource['kind'];
	members: ManagedPerson[];
	candidates?: PersonCandidate[];
	requiresReason?: boolean;
	failCandidates?: boolean;
	/** The server rejects the add: 'refused' = permission withdrawn (403). */
	failAdd?: 'error' | 'refused';
	canAdd?: boolean;
	newPerson?: Partial<ManagedPerson>;
}

const useMemorySource = ({
	kind,
	members: initialMembers,
	candidates = [],
	requiresReason,
	failCandidates,
	failAdd,
	canAdd = true,
	newPerson
}: MemorySourceOptions): ManagedPeopleSource =>
	React.useMemo(() => {
		let members = initialMembers;
		let eligible = candidates;
		const person = (candidate: PersonCandidate, reason?: string) =>
			({
				id: candidate.id,
				name: candidate.name,
				organisation: candidate.organisation,
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
						return eligible;
					}
				: undefined,
			addPerson: canAdd
				? async (candidate, { reason }) => {
						if (failAdd === 'error') throw new Error('500');
						if (failAdd === 'refused') {
							// The organisation withdrew the permission meanwhile.
							eligible = eligible.filter(
								({ id }) => id !== candidate.id
							);
							throw new PersonChangeRefusedError();
						}
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

/**
 * The real case: the counsellor chose this supervisor, so the person can be
 * swapped in one step. The old one goes, the new one comes, one dialog.
 */
const SUPERVISION_SWAPPABLE: MemorySourceOptions = {
	...SUPERVISION,
	members: [
		{ ...SELMA, isStanding: false, canRemove: true, canReplace: true }
	],
	newPerson: { role: 'supervisor', canRemove: true, canReplace: true }
};

const swapSupervisor = async () => {
	const canvas = dialogCanvas();
	await userEvent.click(
		await canvas.findByRole('button', { name: 'Selma Bouvier wechseln' })
	);
	await canvas.findByRole('heading', {
		name: 'Wer soll Selma Bouvier ablösen?'
	});
	await userEvent.click(
		await canvas.findByRole('button', { name: 'Herb Powell auswählen' })
	);
	await userEvent.type(
		canvas.getByRole('textbox', { name: /Grund/ }),
		'Selma ist im Urlaub'
	);
	await userEvent.click(
		canvas.getByRole('button', { name: 'Zu Herb Powell wechseln' })
	);
	await waitFor(() => expect(canvas.queryByText('Selma Bouvier')).toBeNull());
	await canvas.findByText('Herb Powell');
	await canvas.findByText('Selma ist im Urlaub');
};

/** Swap the supervisor in one step: pick, give the reason, confirm. */
export const SupervisionSwapInOneStep: Story = {
	render: () => <SessionStageDialog options={SUPERVISION_SWAPPABLE} />,
	play: swapSupervisor
};

/** The same swap on the phone, full screen. */
export const PhoneSupervisionSwapInOneStep: Story = {
	globals: phone390Globals,
	render: () => <SessionStageDialog options={SUPERVISION_SWAPPABLE} phone />,
	play: swapSupervisor
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
		organisation: SPRINGFIELD,
		role: 'owner',
		isSelf: false,
		canRemove: false,
		canReplace: false
	},
	{
		id: 'me',
		name: 'Agnes Skinner',
		organisation: SPRINGFIELD,
		role: 'coModerator',
		isSelf: true,
		canRemove: false,
		canReplace: false
	},
	{
		id: 'herb',
		name: 'Herb Powell',
		organisation: SHELBYVILLE,
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
		await canvas.findByText('Lisa Simpson ist jetzt in diesem Chat.');
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

const INTERNAL_CHAT: MemorySourceOptions = {
	kind: 'internalChat',
	members: INTERNAL_MEMBERS.slice(0, 2),
	candidates: COLLEAGUES,
	newPerson: { role: 'coModerator', canRemove: false }
};

/** Search matches the organisation as well as the name. */
export const InternalChatSearchByOrganisation: Story = {
	render: () => <GroupStageDialog options={INTERNAL_CHAT} />,
	play: async () => {
		const canvas = dialogCanvas();
		await userEvent.type(
			await canvas.findByRole('searchbox', {
				name: 'Nach Name oder Organisation suchen'
			}),
			'Shelbyville'
		);
		await canvas.findByRole('button', { name: 'Herb Powell hinzufügen' });
		await expect(
			canvas.queryByRole('button', { name: 'Patty Bouvier hinzufügen' })
		).toBeNull();
	}
};

/** A search without a hit says so instead of showing an empty list. */
export const InternalChatSearchNoMatch: Story = {
	render: () => <GroupStageDialog options={INTERNAL_CHAT} />,
	play: async () => {
		const canvas = dialogCanvas();
		await userEvent.type(
			await canvas.findByRole('searchbox', { name: /suchen/ }),
			'Flanders'
		);
		await canvas.findByText('Niemand passt zu dieser Suche.');
	}
};

/** Nobody left who may join: the reason, not an empty box. */
export const InternalChatNobodyToAdd: Story = {
	render: () => (
		<GroupStageDialog options={{ ...INTERNAL_CHAT, candidates: [] }} />
	),
	play: async () => {
		const canvas = dialogCanvas();
		await canvas.findByText(
			'Es können keine weiteren Kolleg:innen zu diesem Chat hinzugefügt werden.'
		);
	}
};

/** The add fails on the server: the person stays selectable for another try. */
export const InternalChatAddFailed: Story = {
	render: () => (
		<GroupStageDialog options={{ ...INTERNAL_CHAT, failAdd: 'error' }} />
	),
	play: async () => {
		const canvas = dialogCanvas();
		await userEvent.click(
			await canvas.findByRole('button', {
				name: 'Lisa Simpson hinzufügen'
			})
		);
		await canvas.findByRole('alert');
		await canvas.findByRole('button', { name: 'Lisa Simpson hinzufügen' });
	}
};

/**
 * The organisation withdrew the permission while the list was open: the
 * dialog says so and the person disappears from the list.
 */
export const InternalChatAddRefused: Story = {
	render: () => (
		<GroupStageDialog options={{ ...INTERNAL_CHAT, failAdd: 'refused' }} />
	),
	play: async () => {
		const canvas = dialogCanvas();
		await userEvent.click(
			await canvas.findByRole('button', {
				name: 'Lisa Simpson hinzufügen'
			})
		);
		await canvas.findByText(/kann hier nicht mehr hinzugefügt werden/);
		await waitFor(() =>
			expect(
				canvas.queryByRole('button', {
					name: 'Lisa Simpson hinzufügen'
				})
			).toBeNull()
		);
	}
};

/** English: invite a colleague and read the confirmation. */
export const InternalChatEnglish: Story = {
	globals: { ...desktop1440Globals, locale: 'en' },
	render: () => <GroupStageDialog options={INTERNAL_CHAT} />,
	play: async () => {
		const canvas = dialogCanvas();
		await canvas.findByRole('heading', { name: 'Add a colleague' });
		await userEvent.click(
			await canvas.findByRole('button', { name: 'Add Lisa Simpson' })
		);
		await canvas.findByText('Lisa Simpson was added to this chat.');
	}
};

/** English: inviting a supervisor asks for the reason first. */
export const SupervisionEnglish: Story = {
	globals: { ...desktop1440Globals, locale: 'en' },
	render: () => <SessionStageDialog options={SUPERVISION} />,
	play: async () => {
		const canvas = dialogCanvas();
		await userEvent.click(
			await canvas.findByRole('button', { name: 'Add Patty Bouvier' })
		);
		await canvas.findByRole('textbox', { name: /Reason for supervision/ });
	}
};

/** Phone, internal chat: search, list and confirmation fit 390 px. */
export const PhoneInternalChat: Story = {
	globals: phone390Globals,
	render: () => <GroupStageDialog options={INTERNAL_CHAT} phone />,
	play: async () => {
		const canvas = dialogCanvas();
		await canvas.findByRole('searchbox', { name: /suchen/ });
	}
};

/** Phone, English, after an invitation was refused. */
export const PhoneInternalChatRefusedEnglish: Story = {
	globals: { ...phone390Globals, locale: 'en' },
	render: () => (
		<GroupStageDialog
			options={{ ...INTERNAL_CHAT, failAdd: 'refused' }}
			phone
		/>
	),
	play: async () => {
		const canvas = dialogCanvas();
		await userEvent.click(
			await canvas.findByRole('button', { name: 'Add Lisa Simpson' })
		);
		await canvas.findByText(/can no longer be added here/);
	}
};
