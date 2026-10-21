import * as React from 'react';
import { expect, waitFor } from 'storybook/test';
import { useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { ReactComponent as CircleIcon } from '../../resources/img/icons/self-help-group.svg';
import { ReactComponent as InternalIcon } from '../../resources/img/icons/internal-conversation.svg';
import {
	ARTWORK_CATALOGUE,
	getTopicCardArtwork,
	INTERNAL_CHAT_ARTWORK
} from '../../resources/img/topics';
import { GroupChatSeriesFieldsValue } from '../groupChat/GroupChatSeriesFields';
import { RuleChipsEditor } from '../groupChat/RuleChipsEditor';
import { SplitButton } from '../splitButton/SplitButton';
import { FormatCard } from './FormatCard';
import { TopicMedia } from './TopicMedia';
import { ArtworkImage } from './ArtworkImage';
import { CompactFormatRow } from './CompactFormatRow';
import { PersonChipGrid } from './internal/PersonChipGrid';
import { PersonOption, PersonSelectMenu } from './internal/PersonSelectMenu';
import { ScheduleRows } from './circle/ScheduleRows';
import './conversationCreate.styles.scss';

/**
 * Building blocks of the create-conversation flow
 * (Figma 8482-30551 "Desktop Flow Internal conversation",
 * 8482-30552 "Flow Self Help Group", 8480-27986 "Internal Group Chat
 * Configuration"). The assembled screens live in
 * `ConversationCreate/Screens`.
 */

const meta = {
	title: 'ConversationCreate/BuildingBlocks',
	tags: ['autodocs'],
	parameters: {
		layout: 'centered',
		docs: {
			description: {
				component:
					'Stacked format card, topic artwork, person menu and chips, the mobile format row, the schedule rows and the rule chips editor.'
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

export const StackedCard: Story = {
	render: () => (
		<FormatCard
			title="Interna besprechen"
			subtitle="mit Ihren Kolleg:innen"
			avatar={<InternalIcon />}
			media={<ArtworkImage artwork={INTERNAL_CHAT_ARTWORK} alt="" />}
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
			avatar={<InternalIcon />}
			media={<ArtworkImage artwork={INTERNAL_CHAT_ARTWORK} alt="" />}
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
				umbrochen.
			</p>
		</FormatCard>
	);
};

export const StackedCardWithChips: Story = {
	render: () => <StackedCardWithChipsDemo />
};

export const TopicArtwork: Story = {
	parameters: {
		docs: {
			description: {
				story: 'All 32 approved motifs: 25 topic variants for 20 subjects, five category illustrations and two format defaults. Agency topics carry no category; repeated subjects use their first supplied variant. Unknown and unselected topics use the self-help default.'
			}
		}
	},
	render: () => (
		<>
			<div
				style={{
					display: 'grid',
					gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
					gap: 24,
					width: 'min(1100px, calc(100vw - 48px))'
				}}
			>
				{Object.values(ARTWORK_CATALOGUE).map((artwork) => (
					<figure key={artwork.id} style={{ margin: 0 }}>
						<div style={{ aspectRatio: '16 / 9' }}>
							<ArtworkImage
								artwork={artwork}
								alt={artwork.label}
								sizes="(max-width: 600px) calc(100vw - 48px), 360px"
							/>
						</div>
						<figcaption>
							{artwork.id}: {artwork.label}
						</figcaption>
					</figure>
				))}
			</div>
			<div
				style={{
					display: 'flex',
					flexWrap: 'wrap',
					gap: 24,
					marginTop: 24,
					width: 'min(1100px, calc(100vw - 48px))'
				}}
			>
				{[null, 'Noch unbekanntes Thema'].map((topic) => (
					<FormatCard
						key={topic || 'unselected'}
						title={topic || 'Kein Thema ausgewählt'}
						subtitle="Selbsthilfegruppe als Standard"
						avatar={<CircleIcon />}
						media={
							<TopicMedia topic={topic} alt="Selbsthilfegruppe" />
						}
					>
						<p style={{ margin: 0 }}>
							Standardbild für ein noch nicht ausgewähltes oder
							unbekanntes Thema.
						</p>
					</FormatCard>
				))}
				<FormatCard
					title="Migration"
					subtitle="Ausgewähltes Thema"
					avatar={<CircleIcon />}
					media={<TopicMedia topic="Migration" alt="Migration" />}
				>
					<p style={{ margin: 0 }}>
						Das Bild folgt dem ausgewählten Thema.
					</p>
				</FormatCard>
			</div>
		</>
	),
	play: async ({ canvasElement }) => {
		await document.fonts.ready;
		const images = canvasElement.querySelectorAll('img');
		expect(images).toHaveLength(35);
		for (const image of images) {
			image.scrollIntoView({ block: 'center' });
			await waitFor(() => {
				expect(image.complete).toBe(true);
				expect(image.naturalWidth).toBeGreaterThan(0);
			});
			// Width descriptors density-correct natural dimensions to whole CSS
			// pixels, so an exact 16:9 asset can round by one pixel here.
			expect(
				Math.abs(image.naturalHeight - (image.naturalWidth * 9) / 16)
			).toBeLessThanOrEqual(1);
			const bounds = image.getBoundingClientRect();
			expect(bounds.width / bounds.height).toBeCloseTo(16 / 9, 2);
			expect(image.srcset).toContain('640w');
			expect(image.srcset).toContain('1280w');
		}
		for (const frame of canvasElement.querySelectorAll(
			'.formatCard__media'
		)) {
			const bounds = frame.getBoundingClientRect();
			const image = frame.querySelector('img')!;
			const imageBounds = image.getBoundingClientRect();
			expect(bounds.width / bounds.height).toBeCloseTo(16 / 9, 2);
			expect(Math.abs(imageBounds.width - bounds.width)).toBeLessThan(1);
			expect(Math.abs(imageBounds.height - bounds.height)).toBeLessThan(
				1
			);
		}
		canvasElement.scrollIntoView({ block: 'start' });
	}
};

const PersonMenuDemo = () => {
	const anchorRef = useRef<HTMLDivElement | null>(null);
	const [selected, setSelected] = useState<string[]>([PEOPLE[0].id]);
	const options: PersonOption[] = [
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
	];
	return (
		<div style={{ width: 320 }} ref={anchorRef}>
			<PersonSelectMenu
				options={options}
				onToggle={(id) =>
					setSelected((prev) =>
						prev.includes(id)
							? prev.filter((selectedId) => selectedId !== id)
							: [...prev, id]
					)
				}
				anchorRef={anchorRef}
				onClose={() => undefined}
				vacatedHint="nicht mehr in der Beratungsstelle"
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
			avatar={<InternalIcon />}
			media={<ArtworkImage artwork={INTERNAL_CHAT_ARTWORK} alt="" />}
		>
			<p style={{ margin: 0 }}>
				Stimmen Sie sich innerhalb Ihrer Beratungsstelle ab.
			</p>
			<SplitButton
				ref={splitButtonRef}
				fullWidth
				label={`${selected.length} Personen hinzugefügt`}
				variant={selected.length > 0 ? 'primary' : 'outlined'}
				open={open}
				onClick={() => setOpen((prev) => !prev)}
				onToggleMenu={() => setOpen((prev) => !prev)}
				menuLabel="Personenliste öffnen oder schließen"
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
					vacatedHint="nicht mehr in der Beratungsstelle"
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

export const CompactRowsMobile: Story = {
	parameters: {
		docs: {
			description: {
				story: 'Mobile format rows — the phone layout replaces the two stacked cards with full-width rows.'
			}
		}
	},
	render: () => (
		<div
			style={{
				display: 'flex',
				flexDirection: 'column',
				gap: 12,
				width: 340
			}}
		>
			<CompactFormatRow
				icon={<InternalIcon />}
				title="Interna besprechen"
				subtitle="mit ihren Kollegen"
				image={INTERNAL_CHAT_ARTWORK}
				onSelect={() => undefined}
			/>
			<CompactFormatRow
				icon={<CircleIcon />}
				title="Gesprächskreis"
				subtitle="moderierte Selbsthilfegruppen"
				image={getTopicCardArtwork(null)}
				onSelect={() => undefined}
			/>
		</div>
	)
};

const ScheduleRowsDemo = () => {
	const [value, setValue] = useState<GroupChatSeriesFieldsValue>({
		startDate: '2026-08-23',
		startTime: '19:00',
		duration: 240,
		repeatCount: 34,
		interval: 'WEEKLY',
		modality: 'VIDEO'
	});
	const [language, setLanguage] = useState('de');
	return (
		<div style={{ width: 360 }}>
			<ScheduleRows
				value={value}
				onChange={setValue}
				language={language}
				onLanguageChange={setLanguage}
				languageOptions={[
					{ value: 'de', label: 'Deutsch' },
					{ value: 'en', label: 'English' }
				]}
			/>
		</div>
	);
};

export const IntervalRows: Story = {
	parameters: {
		docs: {
			description: {
				story: '"Interval konfigurieren": chosen values use the tonal state, the row with an open menu is elevated, time / duration / repetitions carry the stepper pair.'
			}
		}
	},
	render: () => <ScheduleRowsDemo />
};

const RuleChipsDemo = () => {
	const [rules, setRules] = useState([
		'Sprich von dir selbst, nicht über andere.',
		'Was hier geteilt wird, bleibt hier.'
	]);
	return (
		<div style={{ width: 360 }}>
			<RuleChipsEditor rules={rules} onChange={setRules} />
		</div>
	);
};

export const RuleChips: Story = {
	parameters: {
		docs: {
			description: {
				story: 'Selecting a chip loads that rule back into the editor; the 48×48 add button is the WCAG 2.2 target-size minimum the design annotates.'
			}
		}
	},
	render: () => <RuleChipsDemo />
};
