import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import {
	SessionSearchPanel,
	SessionSearchPanelLabels,
	SessionSearchAgencyOption,
	SessionSearchPersonOption,
	SessionSearchTab,
	SessionSearchTopicOption,
	SessionSearchTypeOption
} from './SessionSearchPanel';
import {
	CASE_HANDOVER_SEARCH_FIGMA_URL,
	ORISO_M3_FIGMA_URL
} from '../storybookDesignLinks';
import './sessionsList.styles.scss';

const shell: React.CSSProperties = {
	backgroundColor: '#eae7e8',
	padding: 16,
	maxWidth: 420,
	margin: '0 auto',
	position: 'relative'
};

const labelsEn: SessionSearchPanelLabels = {
	refineHint: 'Refine your search further using filters',
	tabPeople: 'People',
	tabType: 'By type',
	tabCentre: 'Counseling center',
	tabArchiveOnly: 'Archive only',
	emptyPeople: 'No matching people found.',
	emptyTypes: 'No chat types available.',
	emptyTopics: 'No topics found for your counseling centers.'
};

const labelsDe: SessionSearchPanelLabels = {
	refineHint: 'Verfeinere deine Suche durch Filter weiter',
	tabPeople: 'Personen',
	tabType: 'Nach Typ',
	tabCentre: 'Beratungsstelle',
	tabArchiveOnly: 'Nur Archiv',
	emptyPeople: 'Keine passenden Personen gefunden.',
	emptyTypes: 'Keine Chat-Typen verfügbar.',
	emptyTopics: 'Keine Themen für deine Beratungsstellen gefunden.'
};

const people: SessionSearchPersonOption[] = [
	{
		id: 'ingrid-koschmider',
		name: 'Ingrid Koschmider',
		subtitle: 'Berater:in | Mainz 30232',
		role: 'consultant',
		avatarSeed: 'ingrid-koschmider'
	},
	{
		id: 'hans-p',
		name: 'Hans P.',
		subtitle: 'Berat. Person | Berlin 10117',
		role: 'consultant',
		avatarSeed: 'hans-p'
	},
	{
		id: 'iene-lou-7575',
		name: 'iene_lou_7575',
		subtitle: 'Ratsuchende:r | Mainz 30232',
		role: 'asker',
		avatarSeed: 'iene-lou-7575'
	},
	{
		id: 'rango-durango',
		name: 'Rango Durango',
		subtitle: 'Berater:in | Mainz 30232',
		role: 'consultant',
		avatarSeed: 'rango-durango'
	}
];

const topics: SessionSearchTopicOption[] = [
	{ id: 'schulden', label: 'Schulden', subtitle: 'Mainz 30232' },
	{ id: 'suchtberatung', label: 'Suchtberatung', subtitle: 'Mainz 30232' }
];

const types: SessionSearchTypeOption[] = [
	{ id: 'oneToOne', label: '1-1 Beratung' },
	{ id: 'liveChat', label: 'Live Chat' },
	{ id: 'nearby', label: 'Mail' },
	{ id: 'group', label: 'Kreis' }
];

type PlaygroundProps = {
	labels?: SessionSearchPanelLabels;
	initialTab?: SessionSearchTab;
	initialSelectedPersonIds?: string[];
	initialSelectedTopicId?: string | null;
	initialArchiveOnly?: boolean;
	people?: SessionSearchPersonOption[];
	topics?: SessionSearchTopicOption[];
	types?: SessionSearchTypeOption[];
	agencies?: SessionSearchAgencyOption[];
	initialSelectedAgencyIds?: string[];
};

function SessionSearchPanelPlayground({
	labels = labelsDe,
	initialTab = 'people',
	initialSelectedPersonIds = [],
	initialSelectedTopicId = null,
	initialArchiveOnly = false,
	people: peopleOptions = people,
	topics: topicOptions = topics,
	types: typeOptions = types,
	agencies: agencyOptions = agencies,
	initialSelectedAgencyIds = []
}: PlaygroundProps) {
	const [tab, setTab] = useState<SessionSearchTab>(initialTab);
	const [selectedPersonIds, setSelectedPersonIds] = useState<string[]>(
		initialSelectedPersonIds
	);
	const [selectedTopicId, setSelectedTopicId] = useState<string | null>(
		initialSelectedTopicId
	);
	const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);
	const [archiveOnly, setArchiveOnly] = useState(initialArchiveOnly);
	const [selectedAgencyIds, setSelectedAgencyIds] = useState<string[]>(
		initialSelectedAgencyIds
	);

	return (
		<div style={shell} className="sessionsListToolbar">
			<div style={{ position: 'relative', height: 1 }}>
				<SessionSearchPanel
					labels={labels}
					activeTab={tab}
					onTabChange={setTab}
					archiveOnly={archiveOnly}
					onArchiveOnlyChange={setArchiveOnly}
					people={peopleOptions}
					selectedPersonIds={selectedPersonIds}
					onPersonToggle={(id) =>
						setSelectedPersonIds((prev) =>
							prev.includes(id)
								? prev.filter((entry) => entry !== id)
								: [...prev, id]
						)
					}
					types={typeOptions}
					selectedTypeId={selectedTypeId}
					onTypeSelect={setSelectedTypeId}
					topics={topicOptions}
					selectedTopicId={selectedTopicId}
					onTopicSelect={setSelectedTopicId}
					agencies={agencyOptions}
					selectedAgencyIds={selectedAgencyIds}
					onAgencyToggle={(id) =>
						setSelectedAgencyIds((prev) =>
							prev.includes(id)
								? prev.filter((entry) => entry !== id)
								: [...prev, id]
						)
					}
				/>
			</div>
		</div>
	);
}

/** #1195 JOB1 — a counsellor who belongs to two agencies. */
const agencies: SessionSearchAgencyOption[] = [
	{ id: '77', label: 'Beratungsstelle Mainz', subtitle: 'Mainz 30232' },
	{ id: '42', label: 'Beratungsstelle Berlin', subtitle: 'Berlin 10117' }
];

/** #1195 JOB3 — enough people to force auto-pagination (page size 10). */
const manyPeople: SessionSearchPersonOption[] = Array.from(
	{ length: 24 },
	(_, index) => ({
		id: `person-${index}:asker`,
		name: `ratsuchend_${1000 + index}`,
		subtitle: 'Ratsuchende:r | Mainz 30232',
		role: 'asker' as const,
		avatarSeed: `person-${index}`
	})
);

const meta: Meta = {
	title: 'Organisms/CaseHandoverSearch/SessionSearchPanel',
	tags: ['autodocs'],
	parameters: {
		layout: 'fullscreen',
		design: [
			{
				type: 'figma',
				name: 'CARX Case Handover — Search Bar Organisms',
				url: CASE_HANDOVER_SEARCH_FIGMA_URL
			},
			{
				type: 'figma',
				name: 'Design System M3 ORISO',
				url: ORISO_M3_FIGMA_URL
			}
		],
		docs: {
			description: {
				component:
					'Search refinement panel for the session-list search pill (Case Handover flow). Tabs: **People** (checkbox multi-select), **By type** (radio), **Counseling center** (topic radio — one topic only, per Section 00: a person must never combine two topics), plus the independent **Archive only** toggle tab. Confirm affordance (red checkmark / Enter) lives in the search pill (`SessionsListToolbar`).'
			}
		}
	}
};

export default meta;
type Story = StoryObj<typeof meta>;

export const PeopleTab: Story = {
	render: () => (
		<SessionSearchPanelPlayground
			initialSelectedPersonIds={['ingrid-koschmider']}
		/>
	)
};

export const PeopleTabEnglish: Story = {
	render: () => (
		<SessionSearchPanelPlayground
			labels={labelsEn}
			initialSelectedPersonIds={['ingrid-koschmider']}
		/>
	)
};

export const CounselingCenterTab: Story = {
	render: () => (
		<SessionSearchPanelPlayground
			initialTab="centre"
			initialSelectedTopicId="schulden"
		/>
	)
};

/**
 * #1195 JOB1 — both agencies of a two-agency counsellor are selectable at once,
 * above the single-select topic list.
 */
export const TwoAgencyFilter: Story = {
	render: () => (
		<SessionSearchPanelPlayground
			initialTab="centre"
			initialSelectedAgencyIds={['77', '42']}
		/>
	)
};

/**
 * #1195 JOB3 — 24 people, of which only the first 10 render until the sentinel
 * scrolls into view inside the menu's own scroll container.
 */
export const AutoPagination: Story = {
	render: () => <SessionSearchPanelPlayground people={manyPeople} />
};

export const ByTypeTab: Story = {
	render: () => <SessionSearchPanelPlayground initialTab="type" />
};

export const ArchiveOnlyActive: Story = {
	render: () => (
		<SessionSearchPanelPlayground
			initialArchiveOnly
			initialSelectedPersonIds={['ingrid-koschmider']}
		/>
	)
};

export const EmptyResults: Story = {
	render: () => (
		<SessionSearchPanelPlayground people={[]} topics={[]} types={[]} />
	)
};

/** Topic selection is exclusive: choosing a second topic deselects the first. */
export const TopicRadioIsExclusive: Story = {
	render: () => <SessionSearchPanelPlayground initialTab="centre" />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const schulden = await canvas.findByRole('radio', {
			name: /Schulden/
		});
		const sucht = await canvas.findByRole('radio', {
			name: /Suchtberatung/
		});
		await userEvent.click(schulden);
		await expect(schulden).toHaveAttribute('aria-checked', 'true');
		await userEvent.click(sucht);
		await expect(sucht).toHaveAttribute('aria-checked', 'true');
		await expect(schulden).toHaveAttribute('aria-checked', 'false');
	}
};

/** People selection is additive (checkboxes). */
export const PeopleMultiSelect: Story = {
	render: () => <SessionSearchPanelPlayground />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const ingrid = await canvas.findByRole('checkbox', {
			name: /Ingrid Koschmider/
		});
		const hans = await canvas.findByRole('checkbox', { name: /Hans P/ });
		await userEvent.click(ingrid);
		await userEvent.click(hans);
		await expect(ingrid).toHaveAttribute('aria-checked', 'true');
		await expect(hans).toHaveAttribute('aria-checked', 'true');
	}
};
