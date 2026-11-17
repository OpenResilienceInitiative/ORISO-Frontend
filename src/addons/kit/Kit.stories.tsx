import { Meta, StoryObj } from '@storybook/react-vite';
import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { webKit, WEB_KIT_VERSION } from '.';

const {
	Provider,
	Button,
	TextField,
	Textarea,
	Checkbox,
	Select,
	RadioGroup,
	DatePicker,
	NumberField,
	Notice,
	Card,
	Headline,
	Spinner
} = webKit;

const KitShowcase = () => {
	const [name, setName] = useState('');
	const [goals, setGoals] = useState('');
	const [shared, setShared] = useState(false);
	const [rhythm, setRhythm] = useState('weekly');
	const [contact, setContact] = useState('chat');
	const [startDate, setStartDate] = useState('');
	const [daysPerWeek, setDaysPerWeek] = useState<number | null>(null);

	return (
		<Card>
			<div
				style={{ display: 'grid', gap: 16, padding: 24, maxWidth: 640 }}
			>
				<Headline level={2}>Ausgangssituation und Ziele</Headline>
				<Notice title="Hinweis" type="info">
					Ihre Antworten sieht nur Ihre Beraterin oder Ihr Berater,
					wenn Sie sie teilen.
				</Notice>
				<TextField
					label="Wie möchten Sie genannt werden?"
					value={name}
					onChange={setName}
				/>
				<Textarea
					label="Was möchten Sie erreichen?"
					value={goals}
					onChange={setGoals}
					maxLength={2000}
					helperText={`${goals.length} / 2000`}
				/>
				<Select
					label="Wie oft möchten Sie Ihre Ziele überprüfen?"
					value={rhythm}
					onChange={setRhythm}
					options={[
						{ value: 'weekly', label: 'Wöchentlich' },
						{ value: 'monthly', label: 'Monatlich' }
					]}
				/>
				<RadioGroup
					label="Wie möchten Sie Kontakt halten?"
					value={contact}
					onChange={setContact}
					options={[
						{ value: 'chat', label: 'Im Chat' },
						{ value: 'call', label: 'Per Videoanruf' },
						{
							value: 'visit',
							label: 'Vor Ort (zurzeit nicht möglich)',
							disabled: true
						}
					]}
					helperText="Sie können das später ändern."
				/>
				<DatePicker
					label="Ab wann gilt Ihr Ziel?"
					value={startDate}
					onChange={setStartDate}
					min="2026-01-01"
					helperText="TT.MM.JJJJ"
				/>
				<NumberField
					label="An wie vielen Tagen pro Woche?"
					value={daysPerWeek}
					onChange={setDaysPerWeek}
					min={0}
					max={7}
					step={1}
					error={daysPerWeek != null && daysPerWeek > 7}
					helperText="0 bis 7"
				/>
				<Checkbox
					label="Mit meiner Beratung teilen"
					checked={shared}
					onChange={setShared}
				/>
				<div style={{ display: 'flex', gap: 12 }}>
					<Button>Speichern</Button>
					<Button variant="secondary">Abbrechen</Button>
					<Button variant="tertiary">Teil 2: Weiter</Button>
				</div>
				<Notice title="Gespeichert" type="success">
					Ihre Antworten sind gespeichert.
				</Notice>
				<Notice title="Fehler" type="error">
					Das hat nicht geklappt. Bitte versuchen Sie es erneut.
				</Notice>
				<Spinner />
			</div>
		</Card>
	);
};

// Mounts the showcase in its own React root, the way an add-on renders.
const MountedLikeAnAddon = () => {
	const element = useRef<HTMLDivElement>(null);
	useEffect(() => {
		if (!element.current) {
			return;
		}
		const root = createRoot(element.current);
		root.render(
			<Provider>
				<KitShowcase />
			</Provider>
		);
		return () => {
			setTimeout(() => root.unmount());
		};
	}, []);
	return <div ref={element} />;
};

const meta = {
	title: 'Add-ons/Web kit',
	component: MountedLikeAnAddon,
	parameters: {
		docs: {
			description: {
				component: `The components add-ons can use from the host (\`@oriso/web-kit\` ${WEB_KIT_VERSION}, ADR-034). They render the core components; the props shown here are the stable contract.`
			}
		}
	}
} satisfies Meta<typeof MountedLikeAnAddon>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AllComponents: Story = {};

export const HeadlineEscapesHtml: Story = {
	render: () => (
		<Provider>
			<Headline level={3}>
				{'<img src=x onerror=alert(1)> stays text'}
			</Headline>
		</Provider>
	)
};
