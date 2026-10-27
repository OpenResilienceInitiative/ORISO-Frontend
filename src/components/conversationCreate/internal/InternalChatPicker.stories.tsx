import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from 'storybook/test';
import { useTranslation } from 'react-i18next';
import type { Consultant } from '../../../api/apiGetAgencyConsultantList';
import { INTERNAL_SUBSET_REASON } from '../../../api/apiCreateInternalSubsetChat';
import { PanelHeader } from '../PanelHeader';
import {
	InternalChatCreateCard,
	InternalChatDraft
} from './InternalChatCreateCard';
import { internalSubsetErrorKey } from './internalSubsetMessages';
import {
	filterColleaguesForScope,
	InternalChatRecipientScope
} from './recipientScope';
import '../conversationCreate.styles.scss';

/**
 * Picker of "Interna besprechen" with the Träger's recipient scope (#1772,
 * ORISO-Frontend#1269). The people shown are what `filterColleaguesForScope`
 * lets through for the chosen scope, and the selection is the recipient
 * list: nothing — no "everyone", no moderators, no groups — is added. A chat
 * with the chosen colleagues becomes a dedicated, encrypted room for exactly
 * them (ORISO-UserService#1426); every refusal of that endpoint has its own
 * message.
 */

const meta = {
	title: 'ConversationCreate/Internal chat picker',
	tags: ['autodocs'],
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component:
					'Who can be picked follows the recipient scope of the Träger: counselling centre, Träger or platform. The selection is the recipient list. Refusals of the dedicated-room endpoint are shown on the card in plain language.'
			}
		}
	}
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const CENTRE = 410;

const colleague = (
	consultantId: string,
	firstName: string,
	lastName: string,
	agencyId: number
): Consultant => ({
	consultantId,
	firstName,
	lastName,
	displayName: `${firstName} ${lastName}`,
	username: `${firstName}.${lastName}`.toLowerCase(),
	agencies: [{ id: agencyId }]
});

/** The Träger's directory: two colleagues of the counsellor's centre, two of other centres. */
const DIRECTORY: Consultant[] = [
	colleague('c-1', 'Anna', 'Becker', CENTRE),
	colleague('c-2', 'Boris', 'Kaya', CENTRE),
	colleague('c-3', 'Carla', 'Dietz', 411),
	colleague('c-4', 'Dmitri', 'Evers', 412)
];

const toPeople = (scope: InternalChatRecipientScope) =>
	filterColleaguesForScope({
		scope,
		colleagues: DIRECTORY,
		agencyId: CENTRE
	}).map((person) => ({
		id: person.consultantId,
		label: `${person.firstName} ${person.lastName}`
	}));

const Flow = ({
	scope = 'AGENCY',
	people,
	selectedIds = [],
	name = '',
	reason,
	compact = false
}: {
	scope?: InternalChatRecipientScope;
	people?: { id: string; label: string }[];
	selectedIds?: string[];
	name?: string;
	reason?: string;
	compact?: boolean;
}) => {
	const { t } = useTranslation();
	const [draft, setDraft] = useState<InternalChatDraft>({
		name,
		selectedIds
	});
	return (
		<div className="conversationCreate">
			<PanelHeader
				title={t('groupChat.format.panelTitle')}
				menuLabel={t('groupChat.format.panelMenu')}
				menuDisabled
			/>
			<div
				className={`conversationCreate__single${
					compact ? ' conversationCreate__single--compact' : ''
				}`}
			>
				<InternalChatCreateCard
					people={people ?? toPeople(scope)}
					draft={draft}
					onDraftChange={setDraft}
					onCreate={() => undefined}
					scope={scope}
					errorMessage={
						reason
							? t(
									internalSubsetErrorKey(
										reason as Parameters<
											typeof internalSubsetErrorKey
										>[0]
									)
								)
							: undefined
					}
				/>
			</div>
		</div>
	);
};

const phone390 = { viewport: { value: 'phone390' } };
const tablet820 = { viewport: { value: 'tablet820' } };
const desktop1440 = { viewport: { value: 'desktop1440' } };
const english = { locale: 'en' };

const openPersonList = async (canvasElement: HTMLElement) => {
	// The id sits on the split button's wrapper; its first button opens the list.
	const trigger = canvasElement.querySelector<HTMLButtonElement>(
		'#internalChatPersonButton button'
	);
	await userEvent.click(trigger as HTMLButtonElement);
	return within(document.body).findByRole('listbox');
};

const optionNames = (list: HTMLElement) =>
	within(list)
		.getAllByRole('option')
		.map((option) => option.textContent?.trim());

export const ScopeCounsellingCentre: Story = {
	name: 'Scope: counselling centre',
	parameters: {
		docs: {
			description: {
				story: 'Default, and what a Träger without the setting gets. Colleagues of other counselling centres are not offered.'
			}
		}
	},
	render: () => <Flow scope="AGENCY" />,
	play: async ({ canvasElement }) => {
		const list = await openPersonList(canvasElement);
		await expect(optionNames(list)).toEqual(['Anna Becker', 'Boris Kaya']);
		await expect(within(list).queryByText('Carla Dietz')).toBeNull();
	}
};

export const ScopeTraeger: Story = {
	name: 'Scope: Träger',
	render: () => <Flow scope="TENANT" />,
	play: async ({ canvasElement }) => {
		const list = await openPersonList(canvasElement);
		await expect(optionNames(list)).toEqual([
			'Anna Becker',
			'Boris Kaya',
			'Carla Dietz',
			'Dmitri Evers'
		]);
	}
};

export const ScopePlatform: Story = {
	name: 'Scope: platform',
	parameters: {
		docs: {
			description: {
				story: 'The directory the Frontend can read is the Träger\u2019s, so the platform scope lists the same people as the Träger scope and uses the Träger wording until a platform-wide directory exists (follow-up issue in ORISO-UserService). The UserService accepts the wider choice.'
			}
		}
	},
	render: () => <Flow scope="PLATFORM" />,
	play: async ({ canvasElement }) => {
		const list = await openPersonList(canvasElement);
		await expect(optionNames(list)).toHaveLength(4);
	}
};

export const SelectionIsTheRecipientList: Story = {
	name: 'Selection = recipients',
	parameters: {
		docs: {
			description: {
				story: 'Two colleagues picked: the chips show exactly those two. Nothing is added — no "everyone", no moderators, no groups — and creating is possible straight away.'
			}
		}
	},
	render: () => (
		<Flow
			scope="TENANT"
			selectedIds={['c-2', 'c-3']}
			name="Fallbesprechung"
		/>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const chips = canvasElement.querySelectorAll('.personChipGrid__chip');
		await expect(
			Array.from(chips).map((chip) => chip.textContent?.trim())
		).toEqual(['Boris Kaya', 'Carla Dietz']);
		await expect(canvas.queryByText(/Alle|Everyone/)).toBeNull();
		const create = canvasElement.querySelector(
			'.internalChatCreateCard__createButton'
		) as HTMLButtonElement;
		await expect(create.disabled).toBe(false);
	}
};

export const NobodyInScope: Story = {
	name: 'Empty: nobody in scope',
	render: () => <Flow scope="AGENCY" people={[]} />,
	play: async ({ canvasElement }) => {
		const list = await openPersonList(canvasElement);
		await expect(within(list).getByRole('option')).toBeTruthy();
		await expect(
			canvasElement.querySelector('.internalChatCreateCard__createButton')
		).toHaveProperty('disabled', true);
	}
};

const ALL_REASONS = Object.values(INTERNAL_SUBSET_REASON);

const RefusalGrid = () => (
	<div
		style={{
			display: 'grid',
			gap: 24,
			gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
			padding: 24
		}}
	>
		{ALL_REASONS.map((reason) => (
			<div key={reason} data-reason={reason}>
				<code style={{ display: 'block', font: '12px monospace' }}>
					{reason}
				</code>
				<Flow
					scope="TENANT"
					selectedIds={['c-1']}
					name="Fallbesprechung"
					reason={reason}
					compact
				/>
			</div>
		))}
	</div>
);

const expectEveryRefusalReadable = async (canvasElement: HTMLElement) => {
	const alerts = within(canvasElement).getAllByRole('alert');
	await expect(alerts).toHaveLength(ALL_REASONS.length);
	alerts.forEach((alert) => {
		// A raw translation key would show a dot-separated token.
		expect(alert.textContent).not.toMatch(/groupChat\./);
		expect((alert.textContent ?? '').length).toBeGreaterThan(20);
	});
};

export const RefusalsGerman: Story = {
	name: 'Errors: every refusal (DE)',
	parameters: {
		docs: {
			description: {
				story: 'One card per refusal code of the dedicated-room endpoint, German.'
			}
		}
	},
	render: () => <RefusalGrid />,
	play: async ({ canvasElement }) => expectEveryRefusalReadable(canvasElement)
};

export const RefusalsEnglish: Story = {
	name: 'Errors: every refusal (EN)',
	globals: english,
	render: () => <RefusalGrid />,
	play: async ({ canvasElement }) => expectEveryRefusalReadable(canvasElement)
};

export const ScopeTraegerEnglish: Story = {
	name: 'Scope: Träger (EN)',
	globals: english,
	render: () => (
		<Flow scope="TENANT" selectedIds={['c-1']} name="Case review" />
	)
};

export const Phone390German: Story = {
	name: '390px phone (DE)',
	globals: phone390,
	render: () => (
		<Flow
			scope="AGENCY"
			selectedIds={['c-1', 'c-2']}
			name="Fallbesprechung"
			reason={INTERNAL_SUBSET_REASON.RECIPIENT_OUT_OF_SCOPE}
			compact
		/>
	)
};

export const Phone390English: Story = {
	name: '390px phone (EN)',
	globals: { ...phone390, ...english },
	render: () => (
		<Flow
			scope="AGENCY"
			selectedIds={['c-1', 'c-2']}
			name="Case review"
			reason={INTERNAL_SUBSET_REASON.RECIPIENT_OUT_OF_SCOPE}
			compact
		/>
	)
};

export const Tablet820: Story = {
	name: '820px tablet',
	globals: tablet820,
	render: () => (
		<Flow
			scope="TENANT"
			selectedIds={['c-1', 'c-3']}
			name="Fallbesprechung"
		/>
	)
};

export const Desktop1440: Story = {
	name: '1440px desktop',
	globals: desktop1440,
	render: () => (
		<Flow
			scope="TENANT"
			selectedIds={['c-1', 'c-3']}
			name="Fallbesprechung"
		/>
	)
};
