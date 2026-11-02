import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { AttachmentCard } from './AttachmentCard';
import { AttachmentGate, AttachmentGateStatus } from './AttachmentGate';
import './message.styles';

const meta = {
	title: 'Components/Chat/AttachmentGate',
	component: AttachmentGate,
	parameters: {
		docs: {
			description: {
				component:
					'Der Platzhalter für eine Datei, die noch nicht auf diesem Gerät liegt. Erst das Tor (eine Person entscheidet), dann die laufende Prüfung (Animation ohne vorgetäuschten Prozentwert), dann die Datei. Bilder und Videos als Poster in ihrer endgültigen Form, alles andere als Zeile.'
			}
		}
	},
	args: {
		mimeType: 'image/png',
		fileName: 'mietvertrag-seite-2.png',
		meta: 'PNG · 1,20 MB',
		status: {
			kind: 'gate',
			actionLabel: 'Prüfen und öffnen',
			hint: 'Noch nicht auf Viren geprüft'
		}
	}
} satisfies Meta<typeof AttachmentGate>;

export default meta;
type Story = StoryObj<typeof meta>;

const FILES = [
	{
		mimeType: 'image/png',
		fileName: 'mietvertrag-seite-2.png',
		meta: 'PNG · 1,20 MB'
	},
	{
		mimeType: 'video/mp4',
		fileName: 'besichtigung-keller.mp4',
		meta: 'MP4 · 8,40 MB'
	},
	{
		mimeType: 'audio/mpeg',
		fileName: 'nachricht-vermieter.mp3',
		meta: 'MP3 · 2,10 MB'
	},
	{
		mimeType: 'application/pdf',
		fileName: 'kuendigung.pdf',
		meta: 'PDF · 340 KB'
	},
	{
		mimeType:
			'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
		fileName:
			'lebenslauf-mit-einem-sehr-langen-dateinamen-der-nicht-passt.docx',
		meta: 'DOCX · 88 KB'
	},
	{
		mimeType:
			'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
		fileName: 'haushaltsplan.xlsx',
		meta: 'XLSX · 42 KB'
	}
];

const GATE: AttachmentGateStatus = {
	kind: 'gate',
	actionLabel: 'Prüfen und öffnen',
	onAction: () => undefined,
	hint: 'Noch nicht auf Viren geprüft'
};

const Grid = ({ children }: { children: React.ReactNode }) => (
	<div
		style={{
			display: 'grid',
			gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 340px))',
			gap: 16,
			alignItems: 'start'
		}}
	>
		{children}
	</div>
);

const everyFile = (status: AttachmentGateStatus) => (
	<Grid>
		{FILES.map((file) => (
			<AttachmentGate key={file.fileName} {...file} status={status} />
		))}
	</Grid>
);

/** Wartet auf eine Entscheidung. Nichts wurde geladen. */
export const AllMediaTypes: Story = {
	name: 'Tor — alle Medientypen',
	render: () => everyFile(GATE)
};

/** Prüfung läuft, ohne vorgetäuschten Prozentwert. */
export const Checking: Story = {
	name: 'Virenprüfung läuft',
	render: () =>
		everyFile({ kind: 'working', label: 'Wird auf Viren geprüft …' })
};

const UploadingDemo = () => {
	const [progress, setProgress] = useState(0.1);
	useEffect(() => {
		const timer = window.setInterval(
			() => setProgress((p) => (p >= 1 ? 0.1 : Math.min(1, p + 0.1))),
			600
		);
		return () => window.clearInterval(timer);
	}, []);
	return everyFile({
		kind: 'working',
		label: 'Wird hochgeladen …',
		progress
	});
};

const IMAGE_CHECKS: AttachmentGateStatus = {
	kind: 'working',
	label: 'Bild wird geprüft …',
	checks: [
		{ label: 'Virenprüfung', state: 'running' },
		{
			label: 'Bildanalyse: sicher und ohne Richtlinienverstoß?',
			state: 'running'
		}
	]
};

/**
 * Mit KI-Bildprüfung (ADR-019). Der Scanner antwortet einmal für die ganze
 * Datei, darum laufen beide Zeilen gleichzeitig und nichts bekommt vorab einen
 * Haken. Ohne KI-Prüfung bleibt es bei „Virenprüfung läuft“.
 */
export const ImageCheck: Story = {
	name: 'Bildanalyse läuft',
	render: () => (
		<Grid>
			<AttachmentGate
				mimeType="image/png"
				fileName="mietvertrag-seite-2.png"
				meta="PNG · 1,20 MB"
				status={IMAGE_CHECKS}
			/>
			<AttachmentGate
				mimeType="image/jpeg"
				fileName="foto-vom-keller-mit-einem-sehr-langen-dateinamen.jpg"
				meta="JPG · 2,40 MB"
				status={IMAGE_CHECKS}
			/>
		</Grid>
	),
	play: async ({ canvasElement }) => {
		// A tick here reads as "this part is safe". Nothing has answered yet.
		expect(
			canvasElement.querySelector('.attachmentGate__check--done')
		).toBe(null);
		expect(within(canvasElement).getAllByText('Virenprüfung').length).toBe(
			2
		);
	}
};

const STEP_ORDER = ['Viren', 'Bild', 'Fertig'] as const;

const StepsDemo = () => {
	const [step, setStep] = useState(0);
	useEffect(() => {
		const timer = window.setInterval(
			() => setStep((s) => (s + 1) % STEP_ORDER.length),
			1800
		);
		return () => window.clearInterval(timer);
	}, []);
	return (
		<Grid>
			<AttachmentGate
				mimeType="image/png"
				fileName="mietvertrag-seite-2.png"
				meta="PNG · 1,20 MB"
				status={{
					kind: 'working',
					label: 'Bild wird geprüft …',
					checks: [
						step === 0
							? {
									label: 'Wird auf Viren geprüft',
									state: 'running'
								}
							: { label: 'Keine Viren gefunden', state: 'done' },
						step === 0
							? { label: 'Bildanalyse wartet', state: 'pending' }
							: step === 1
								? {
										label: 'Bild wird analysiert: sicher und ohne Richtlinienverstoß?',
										state: 'running'
									}
								: {
										label: 'Bild ist unbedenklich',
										state: 'done'
									}
					]
				}}
			/>
		</Grid>
	);
};

/**
 * Nur Vorschau, so läuft es im Chat noch nicht: Der Scanner meldet keine
 * Zwischenschritte. Der Takt kommt hier von einem Timer der Story. Im Produkt
 * darf ein Haken nur auf ein echtes Signal des Scanners erscheinen.
 */
export const StepByStepPreview: Story = {
	name: 'Vorschau: Schritt für Schritt (braucht Scanner-Signal)',
	render: () => <StepsDemo />
};

/** Hochladen hat echte Bytes, darum hier als einziges mit Prozentwert. */
export const Uploading: Story = {
	name: 'Upload mit Fortschritt',
	render: () => <UploadingDemo />
};

export const Blocked: Story = {
	name: 'Gesperrt',
	render: () =>
		everyFile({
			kind: 'blocked',
			label: 'Von der Sicherheitsprüfung gesperrt'
		})
};

export const CheckUnavailable: Story = {
	name: 'Prüfung nicht erreichbar',
	render: () =>
		everyFile({
			kind: 'error',
			label: 'Prüfung nicht verfügbar, die Datei bleibt gesperrt',
			retryLabel: 'Erneut versuchen',
			onRetry: () => undefined
		})
};

const PLACEHOLDER_IMAGE =
	'data:image/svg+xml;utf8,' +
	encodeURIComponent(
		'<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#ffdad5"/><circle cx="480" cy="110" r="52" fill="#ffb4aa"/><path d="M0 360 220 150l150 130 90-70 180 150z" fill="#a5000a" opacity=".55"/></svg>'
	);

/** Durchklicken: Tor, Prüfung, Datei, so wie im Chat. */
const ExperienceDemo = ({
	mimeType,
	fileName,
	fileMeta,
	verdict = 'safe'
}: {
	mimeType: string;
	fileName: string;
	fileMeta: string;
	verdict?: 'safe' | 'blocked';
}) => {
	const [phase, setPhase] = useState<'gate' | 'checking' | 'done'>('gate');
	const timer = useRef<number>();
	useEffect(() => () => window.clearTimeout(timer.current), []);

	if (phase === 'done' && verdict === 'safe') {
		return (
			<AttachmentCard
				action={{
					kind: 'download',
					href: PLACEHOLDER_IMAGE,
					fileName
				}}
				fileName={fileName}
				meta={fileMeta}
				actionLabel={`${fileName} herunterladen`}
				preview={
					mimeType.startsWith('image/') ? (
						<span className="attachmentCard__preview">
							<img src={PLACEHOLDER_IMAGE} alt={fileName} />
						</span>
					) : undefined
				}
			/>
		);
	}

	return (
		<AttachmentGate
			mimeType={mimeType}
			fileName={fileName}
			meta={fileMeta}
			status={
				phase === 'done'
					? {
							kind: 'blocked',
							label: 'Von der Sicherheitsprüfung gesperrt'
						}
					: phase === 'checking'
						? mimeType.startsWith('image/')
							? IMAGE_CHECKS
							: {
									kind: 'working',
									label: 'Wird auf Viren geprüft …'
								}
						: {
								...GATE,
								onAction: () => {
									setPhase('checking');
									timer.current = window.setTimeout(
										() => setPhase('done'),
										2800
									);
								}
							}
			}
		/>
	);
};

export const Experience: Story = {
	name: 'Erlebnis — klicken, prüfen, öffnen',
	render: () => (
		<Grid>
			<ExperienceDemo
				mimeType="image/png"
				fileName="mietvertrag-seite-2.png"
				fileMeta="PNG · 1,20 MB"
			/>
			<ExperienceDemo
				mimeType="application/pdf"
				fileName="kuendigung.pdf"
				fileMeta="PDF · 340 KB"
			/>
			<ExperienceDemo
				mimeType="video/mp4"
				fileName="unbekannt.mp4"
				fileMeta="MP4 · 8,40 MB"
				verdict="blocked"
			/>
		</Grid>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const buttons = canvas.getAllByRole('button', {
			name: 'Prüfen und öffnen'
		});
		expect(buttons).toHaveLength(3);
		await userEvent.click(buttons[0]);
		expect(
			await canvas.findByRole('progressbar', {
				name: 'Bild wird geprüft …'
			})
		).toBeTruthy();
		expect(canvas.getByText('Virenprüfung')).toBeTruthy();
		// No invented percentage while the check runs.
		expect(
			canvas
				.getByRole('progressbar', {
					name: 'Bild wird geprüft …'
				})
				.getAttribute('aria-valuenow')
		).toBeNull();
	}
};

export const Phone: Story = {
	name: 'Telefon 340 px',
	render: () => (
		<div style={{ width: 300, display: 'grid', gap: 12 }}>
			{FILES.slice(0, 5).map((file) => (
				<AttachmentGate key={file.fileName} {...file} status={GATE} />
			))}
		</div>
	)
};

const Bubble = ({
	own,
	children
}: {
	own?: boolean;
	children: React.ReactNode;
}) => (
	<div className={own ? 'messageItem messageItem--right' : 'messageItem'}>
		<div
			className={
				own
					? 'messageItem__message messageItem__message--myMessage'
					: 'messageItem__message'
			}
			style={{ width: 340 }}
		>
			{children}
		</div>
	</div>
);

/** So liegt der Platzhalter in der echten Sprechblase, eigene und fremde Nachricht. */
export const InBubble: Story = {
	name: 'In der Sprechblase',
	render: () => (
		<div style={{ display: 'grid', gap: 16, justifyItems: 'start' }}>
			<Bubble own>
				<AttachmentGate
					mimeType="image/png"
					fileName="qa-live-check.png"
					meta="PNG · 1 KB"
					status={{
						kind: 'gate',
						actionLabel: 'Entschlüsseln',
						onAction: () => undefined,
						hint: 'Ende-zu-Ende-verschlüsselt'
					}}
				/>
			</Bubble>
			<Bubble>
				<AttachmentGate
					mimeType="application/pdf"
					fileName="qa-live-check.pdf"
					meta="PDF · 193 B"
					status={{
						kind: 'working',
						label: 'Wird auf Viren geprüft …'
					}}
				/>
			</Bubble>
			<Bubble own>
				<AttachmentCard
					action={{
						kind: 'download',
						href: PLACEHOLDER_IMAGE,
						fileName: 'kuendigung.pdf'
					}}
					fileName="kuendigung.pdf"
					meta="PDF · 340 KB"
					actionLabel="kuendigung.pdf herunterladen"
				/>
			</Bubble>
		</div>
	),
	play: async ({ canvasElement }) => {
		// The bug this story guards: the bubble's blanket `span { display:
		// inline }` ran the file name and the status line together.
		const meta = canvasElement.querySelector(
			'a.attachmentCard .attachmentCard__meta'
		) as HTMLElement;
		expect(getComputedStyle(meta).display).toBe('block');
	}
};
