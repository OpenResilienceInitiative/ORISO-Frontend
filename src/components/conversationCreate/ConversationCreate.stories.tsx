import * as React from 'react';
import { useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { userEvent, within } from 'storybook/test';
import { M3SplitButton } from './M3SplitButton';
import { PersonSelectMenu } from './internal/PersonSelectMenu';
import {
	InternalChatCreateCard,
	InternalChatDraft
} from './internal/InternalChatCreateCard';
import { CircleFormatCard } from './CircleFormatCard';
import {
	ConversationCreateFrame,
	ConversationFormatIntro
} from './ConversationPickerFrame';
import { ReactComponent as TopicInterestsIcon } from '../../resources/img/icons/conversation-create/topic-interests.svg';
import './conversationCreate.styles.scss';

/**
 * Building blocks of the create-conversation flow
 * (Figma 8482-30552 "Flow Self Help Group" + 8480-27986
 * "Internal Group Chat Configuration").
 */

const meta = {
	title: 'Components/ConversationCreate/BuildingBlocks',
	tags: ['autodocs'],
	parameters: {
		layout: 'centered',
		docs: {
			description: {
				component:
					'M3 building blocks for the redesigned create-conversation flow: stacked format card, split button, person selection menu and the person chip grid that overlays the card media.'
			}
		}
	}
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const PEOPLE = [
	'Sabine Leutheuser-Schnarrenberger',
	'Siegfried Beutmer',
	'Angela Labisslere',
	'Karl Jung',
	'Siegmund Freud',
	'Charlotte Rausch',
	'Kian Un',
	'Lars Meier'
].map((label, index) => ({ id: `person-${index}`, label }));

const SplitButtonDemo = () => {
	const [selected, setSelected] = useState(false);
	const [open, setOpen] = useState(false);
	return (
		<div style={{ width: 320 }}>
			<M3SplitButton
				label={selected ? '1x Person hinzugefügt' : 'Person hinzufügen'}
				selected={selected}
				open={open}
				onLeadingClick={() => setSelected((prev) => !prev)}
				onTrailingClick={() => setOpen((prev) => !prev)}
				trailingAriaLabel="Personenliste öffnen oder schließen"
			/>
		</div>
	);
};

export const SplitButton: Story = {
	render: () => <SplitButtonDemo />
};

const CircleCardState = ({ initialTopic = '' }: { initialTopic?: string }) => {
	const [topic, setTopic] = useState(initialTopic);
	return (
		<CircleFormatCard selectedTopic={topic}>
			<div className="conversationCreate__cardActions">
				<M3SplitButton
					label={topic || 'Thema / Fachbereich'}
					selected={Boolean(topic)}
					leadingIcon={<TopicInterestsIcon />}
					onLeadingClick={() =>
						setTopic((current) => (current ? '' : 'Schulden'))
					}
					onTrailingClick={() =>
						setTopic((current) => (current ? '' : 'Schulden'))
					}
					trailingAriaLabel="Themenbild umschalten"
				/>
			</div>
		</CircleFormatCard>
	);
};

export const CircleCardDefaultImage: Story = {
	parameters: {
		docs: {
			description: {
				story:
					'Figma 8482:30552. Before a topic is selected the generic gruppenkreis illustration is shown.'
			}
		}
	},
	render: () => <CircleCardState />
};

export const CircleCardSelectedTopicFallback: Story = {
	parameters: {
		docs: {
			description: {
				story:
					'Figma 7633:34734. A selected topic uses the debt illustration until the final per-topic image set is delivered.'
			}
		}
	},
	render: () => <CircleCardState initialTopic="Schulden" />
};

const FullPickerState = () => {
	const [circleTopic, setCircleTopic] = useState('Schulden');
	const [internalDraft, setInternalDraft] = useState<InternalChatDraft>({
		name: '',
		selectedIds: []
	});

	return (
		<ConversationCreateFrame
			headerTitle="Create New Conversation"
			menuLabel="Weitere Optionen"
		>
			<div className="conversationCreate__picker">
				<ConversationFormatIntro
					title="Gesprächsformat wählen"
					subtitle="Wir bieten verschiedene spezialisierte Gesprächsformate für Sie und die Ratsuchenden an. Die Auswahl ist von den Trägern und ihrem Beratungsstelle frei konfigurierbar."
				/>
				<div className="conversationCreate__cards">
					<CircleFormatCard selectedTopic={circleTopic}>
						<div className="conversationCreate__cardActions">
							<M3SplitButton
								label={circleTopic || 'Thema / Fachbereich'}
								selected={Boolean(circleTopic)}
								leadingIcon={<TopicInterestsIcon />}
								onLeadingClick={() =>
									setCircleTopic((topic) =>
										topic ? '' : 'Schulden'
									)
								}
								onTrailingClick={() =>
									setCircleTopic((topic) =>
										topic ? '' : 'Schulden'
									)
								}
								trailingAriaLabel="Themenbild umschalten"
							/>
						</div>
					</CircleFormatCard>
					<InternalChatCreateCard
						people={PEOPLE}
						draft={internalDraft}
						onDraftChange={setInternalDraft}
						onCreate={() => undefined}
					/>
				</div>
			</div>
		</ConversationCreateFrame>
	);
};

export const FullFormatPicker: Story = {
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				story:
					'Figma 7633:34734. Complete desktop picker reference with the shared production header, intro and both conversation cards.'
			}
		}
	},
	render: () => <FullPickerState />
};

interface InternalCardStoryProps {
	initialName?: string;
	initialSelectedIds?: string[];
}

const InternalCardState = ({
	initialName = '',
	initialSelectedIds = []
}: InternalCardStoryProps) => {
	const [draft, setDraft] = useState<InternalChatDraft>({
		name: initialName,
		selectedIds: initialSelectedIds
	});

	return (
		<InternalChatCreateCard
			people={PEOPLE}
			draft={draft}
			onDraftChange={setDraft}
			onCreate={() => undefined}
		/>
	);
};

export const InternalCardDefault: Story = {
	parameters: {
		docs: {
			description: {
				story:
					'Figma 8480:27906. Exact internal-conversation illustration, outlined name field, unselected split button and disabled create action.'
			}
		}
	},
	render: () => <InternalCardState />
};

const StackedCardWithChipsDemo = () => {
	return <InternalCardState initialSelectedIds={PEOPLE.map(({ id }) => id)} />;
};

export const StackedCardWithChips: Story = {
	parameters: {
		docs: {
			description: {
				story:
					'Figma 8480:27549. Many selected colleagues: image is dimmed, chip rows split evenly, labels truncate and overflow scrolls inside the media.'
			}
		}
	},
	render: () => <StackedCardWithChipsDemo />
};

export const InternalCardReadyToCreate: Story = {
	parameters: {
		docs: {
			description: {
				story:
					'Figma 8480:27549. A valid name plus at least one selected colleague enables the primary create action.'
			}
		}
	},
	render: () => (
		<InternalCardState
			initialName="Wochenplanungsgruppe"
			initialSelectedIds={[PEOPLE[0].id, PEOPLE[1].id]}
		/>
	)
};

export const InternalCardPersonMenuOpen: Story = {
	parameters: {
		docs: {
			description: {
				story:
					'Figma 8482:25911. The menu remains scrollable, shows current selections and keeps vacated entries disabled until they are deselected.'
			}
		}
	},
	render: () => <InternalCardState />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(
			canvas.getByRole('button', {
				name: 'Personenliste öffnen oder schließen'
			})
		);
	}
};

const PersonMenuDemo = () => {
	const anchorRef = useRef<HTMLDivElement | null>(null);
	const [selected, setSelected] = useState<string[]>([PEOPLE[0].id]);
	return (
		<div style={{ position: 'relative', width: 320 }} ref={anchorRef}>
			<PersonSelectMenu
				options={[
					...PEOPLE.slice(0, 5).map((person) => ({
						...person,
						selected: selected.includes(person.id)
					})),
					{
						id: 'vacated-1',
						label: 'Janine Janzig',
						selected: true,
						vacated: true
					}
				]}
				onToggle={(id) =>
					setSelected((prev) =>
						prev.includes(id)
							? prev.filter((selectedId) => selectedId !== id)
							: [...prev, id]
					)
				}
				anchorRef={anchorRef}
				onClose={() => undefined}
				toggleLabel={(label, isSelected) =>
					isSelected ? `${label} entfernen` : `${label} auswählen`
				}
			/>
		</div>
	);
};

export const PersonMenu: Story = {
	render: () => <PersonMenuDemo />
};
