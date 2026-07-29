import * as React from 'react';
import { useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { FormatCard } from './FormatCard';
import { M3SplitButton } from './M3SplitButton';
import { PersonChipGrid } from './internal/PersonChipGrid';
import { PersonSelectMenu } from './internal/PersonSelectMenu';
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

const Avatar = () => (
	<svg width="32" height="32" viewBox="0 0 24 24" fill="#a5000a" aria-hidden>
		<path d="M12 3L2 9V21H8V14H16V21H22V9L12 3Z" />
	</svg>
);

const Media = () => (
	<div
		style={{
			alignItems: 'center',
			background:
				'linear-gradient(135deg, #ffe2de 0%, #f6c9c4 60%, #eab1ad 100%)',
			color: '#a5000a',
			display: 'flex',
			height: '100%',
			justifyContent: 'center',
			width: '100%'
		}}
	>
		Media
	</div>
);

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

export const StackedCardDefault: Story = {
	render: () => (
		<FormatCard
			title="Interna besprechen"
			subtitle="mit Ihren Kolleg:innen"
			avatar={<Avatar />}
			media={<Media />}
		>
			<p style={{ margin: 0 }}>
				Stimmen Sie sich innerhalb Ihrer Beratungsstelle ab.
			</p>
		</FormatCard>
	)
};

const StackedCardWithChipsDemo = () => {
	const [entries, setEntries] = useState(PEOPLE);
	return (
		<FormatCard
			title="Interna besprechen"
			subtitle="mit Ihren Kolleg:innen"
			avatar={<Avatar />}
			media={<Media />}
			mediaDimmed={entries.length > 0}
			mediaOverlay={
				<PersonChipGrid
					entries={entries}
					onRemove={(id) =>
						setEntries((prev) =>
							prev.filter((entry) => entry.id !== id)
						)
					}
					removeLabel={(label) => `${label} entfernen`}
				/>
			}
		>
			<p style={{ margin: 0 }}>
				Chips teilen die Reihen gleichmäßig, Namen werden gekürzt statt
				umbrochen; eine ungerade Anzahl bekommt die volle Breite für den
				letzten Chip.
			</p>
		</FormatCard>
	);
};

export const StackedCardWithChips: Story = {
	render: () => <StackedCardWithChipsDemo />
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

/**
 * The card clips its own content to keep its rounded corners, so the menu is
 * portalled to the body and anchored to the split button: it floats on top of
 * the card instead of being cut off inside it.
 */
const CardMenuOverlayDemo = () => {
	const splitButtonRef = useRef<HTMLDivElement | null>(null);
	const [open, setOpen] = useState(true);
	const [selected, setSelected] = useState<string[]>([PEOPLE[0].id]);
	return (
		<FormatCard
			title="Interna besprechen"
			subtitle="mit Ihren Kolleg:innen"
			avatar={<Avatar />}
			media={<Media />}
		>
			<p style={{ margin: 0 }}>
				Stimmen Sie sich innerhalb Ihrer Beratungsstelle ab.
			</p>
			<M3SplitButton
				ref={splitButtonRef}
				label={`${selected.length} Personen hinzugefügt`}
				selected={selected.length > 0}
				open={open}
				onLeadingClick={() => setOpen((prev) => !prev)}
				onTrailingClick={() => setOpen((prev) => !prev)}
				trailingAriaLabel="Personenliste öffnen oder schließen"
			/>
			{open && (
				<PersonSelectMenu
					options={PEOPLE.slice(0, 6).map((person) => ({
						...person,
						selected: selected.includes(person.id)
					}))}
					onToggle={(id) =>
						setSelected((prev) =>
							prev.includes(id)
								? prev.filter((selectedId) => selectedId !== id)
								: [...prev, id]
						)
					}
					anchorRef={splitButtonRef}
					onClose={() => setOpen(false)}
					toggleLabel={(label, isSelected) =>
						isSelected ? `${label} entfernen` : `${label} auswählen`
					}
				/>
			)}
		</FormatCard>
	);
};

export const CardMenuOverlay: Story = {
	render: () => <CardMenuOverlayDemo />
};
