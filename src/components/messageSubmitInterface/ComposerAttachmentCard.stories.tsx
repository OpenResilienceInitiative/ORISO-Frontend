import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { phone375Globals } from '../message/messageStoryShell';
import {
	ComposerAttachmentCard,
	ComposerAttachmentCardProps
} from './ComposerAttachmentCard';

const PDF = {
	fileName: 'befund-seite-2.pdf',
	mimeType: 'application/pdf',
	sizeBytes: 1_250_000
};

const handlers = () => ({
	onRemove: fn(),
	onCancel: fn(),
	onRetry: fn(),
	onChooseAnother: fn()
});

const meta = {
	title: 'Components/Message/ComposerAttachmentCard',
	component: ComposerAttachmentCard,
	parameters: {
		// Off for product stories in general (#1338). This card is new and its
		// colours carry the error state, so it is held to the check.
		a11y: {
			options: { rules: { 'color-contrast': { enabled: true } } }
		},
		docs: {
			description: {
				component:
					'Die Datei, die im Eingabefeld auf das Senden wartet: Dateityp, Name, Größe, Entfernen. Der Balken zeigt nur beim Hochladen eine Zahl, denn nur dort sind echte Bytes bekannt. Davor und danach läuft er ohne Zahl. Jeder Fehler sagt, was passiert ist, und lässt Datei und Text stehen.'
			}
		}
	},
	decorators: [
		(Story) => (
			<div style={{ maxWidth: 480, padding: 16 }}>
				<Story />
			</div>
		)
	],
	args: { ...PDF, status: { kind: 'ready' } }
} satisfies Meta<typeof ComposerAttachmentCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Ready: Story = {
	name: 'Bereit: Dateityp, Name, Größe, Entfernen',
	args: { ...handlers(), sizeBytes: 1_240_000 },
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		expect(canvas.getByText('befund-seite-2.pdf')).toBeTruthy();
		expect(canvas.getByText('PDF · 1,2 MB')).toBeTruthy();
		expect(canvas.queryByRole('progressbar')).toBeNull();
		expect(canvas.queryByRole('alert')).toBeNull();
		await userEvent.click(
			canvas.getByRole('button', {
				name: /befund-seite-2\.pdf entfernen/
			})
		);
		expect(args.onRemove).toHaveBeenCalledOnce();
	}
};

export const ReadyWithCaption: Story = {
	name: 'Bereit, mit Text im Eingabefeld',
	args: { ...handlers(), hasCaption: true },
	play: async ({ canvasElement }) => {
		expect(
			within(canvasElement).getByText(
				'Der Text wird als Beschriftung mitgesendet.'
			)
		).toBeTruthy();
	}
};

const THUMBNAIL =
	'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/AAAMBAQAY3Y2wAAAAAElFTkSuQmCC';

export const ImageWithThumbnail: Story = {
	name: 'Bild mit Vorschau',
	args: {
		...handlers(),
		fileName: 'mietvertrag.png',
		mimeType: 'image/png',
		sizeBytes: 340_000,
		previewUrl: THUMBNAIL
	},
	play: async ({ canvasElement }) => {
		expect(canvasElement.querySelector('img')?.getAttribute('src')).toBe(
			THUMBNAIL
		);
		expect(within(canvasElement).getByText('PNG · 340 KB')).toBeTruthy();
	}
};

export const Preparing: Story = {
	name: 'Vorbereiten: noch keine Bytes, keine Zahl',
	args: { ...handlers(), status: { kind: 'preparing' } },
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		const bar = canvas.getByRole('progressbar');
		expect(bar.getAttribute('aria-valuenow')).toBeNull();
		expect(canvas.queryByText(/%/)).toBeNull();
		expect(canvas.getByRole('status').textContent).toBe(
			'Wird vorbereitet …'
		);
		await userEvent.click(
			canvas.getByRole('button', { name: 'Abbrechen' })
		);
		expect(args.onCancel).toHaveBeenCalledOnce();
	}
};

export const Uploading: Story = {
	name: 'Hochladen: die echte Zahl',
	args: { ...handlers(), status: { kind: 'uploading', percent: 45 } },
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		const bar = canvas.getByRole('progressbar');
		expect(bar.getAttribute('aria-valuenow')).toBe('45');
		expect(canvas.getByText('45 %')).toBeTruthy();
		const fill = bar.firstElementChild as HTMLElement;
		expect(fill.style.width).toBe('45%');
		expect(canvas.queryByRole('button', { name: /entfernen/ })).toBeNull();
		await userEvent.click(
			canvas.getByRole('button', { name: 'Abbrechen' })
		);
		expect(args.onCancel).toHaveBeenCalledOnce();
	}
};

export const Finishing: Story = {
	name: 'Senden: alles hochgeladen, ohne Zahl und ohne Abbrechen',
	args: { ...handlers(), status: { kind: 'finishing' } },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		expect(
			canvas.getByRole('progressbar').getAttribute('aria-valuenow')
		).toBeNull();
		expect(canvas.getByRole('status').textContent).toBe('Wird gesendet …');
		// The message is on its way and cannot be taken back.
		expect(canvas.queryAllByRole('button')).toHaveLength(0);
	}
};

const expectFailure = async (
	canvasElement: HTMLElement,
	args: ComposerAttachmentCardProps,
	message: string,
	action: 'retry' | 'chooseAnother'
) => {
	const canvas = within(canvasElement);
	expect(canvas.getByRole('alert').textContent).toBe(message);
	expect(canvas.queryByRole('progressbar')).toBeNull();
	await userEvent.click(
		canvas.getByRole('button', {
			name: action === 'retry' ? 'Erneut senden' : 'Andere Datei wählen'
		})
	);
	expect(
		action === 'retry' ? args.onRetry : args.onChooseAnother
	).toHaveBeenCalledOnce();
	await userEvent.click(canvas.getByRole('button', { name: /entfernen/ }));
	expect(args.onRemove).toHaveBeenCalledOnce();
};

export const TooLarge: Story = {
	name: 'Fehler: zu groß, vor dem Hochladen',
	args: {
		...handlers(),
		fileName: 'scan-gesamt.pdf',
		sizeBytes: 12_400_000,
		status: { kind: 'failed', reason: 'tooLarge' }
	},
	play: ({ canvasElement, args }) =>
		expectFailure(
			canvasElement,
			args,
			'Diese Datei ist 12,4 MB groß. Erlaubt sind höchstens 10 MB. Es wurde nichts hochgeladen.',
			'chooseAnother'
		)
};

export const JustOverTheLimit: Story = {
	name: 'Fehler: ein Byte über der Grenze',
	args: {
		...handlers(),
		sizeBytes: 10_000_001,
		status: { kind: 'failed', reason: 'tooLarge' }
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		expect(canvas.getByText('PDF · 10,1 MB')).toBeVisible();
		expect(canvas.getByRole('alert')).toHaveTextContent(
			'Diese Datei ist 10,1 MB groß. Erlaubt sind höchstens 10 MB.'
		);
	}
};

export const WrongFormat: Story = {
	name: 'Fehler: Dateiformat nicht erlaubt',
	args: {
		...handlers(),
		fileName: 'setup.exe',
		mimeType: 'application/x-msdownload',
		sizeBytes: 900_000,
		status: { kind: 'failed', reason: 'format' }
	},
	play: ({ canvasElement, args }) =>
		expectFailure(
			canvasElement,
			args,
			'Dieses Dateiformat ist nicht erlaubt. Möglich sind jpg, png, pdf, docx, xlsx, webm, ogg und mp3.',
			'chooseAnother'
		)
};

export const ServerTooLarge: Story = {
	name: 'Fehler: der Server lehnt die Größe ab (413)',
	args: {
		...handlers(),
		status: { kind: 'failed', reason: 'serverTooLarge' }
	},
	play: ({ canvasElement, args }) =>
		expectFailure(
			canvasElement,
			args,
			'Der Server lehnt diese Datei als zu groß ab. Datei und Text bleiben hier.',
			'chooseAnother'
		)
};

export const NetworkLost: Story = {
	name: 'Fehler: Verbindung abgebrochen',
	args: { ...handlers(), status: { kind: 'failed', reason: 'network' } },
	play: ({ canvasElement, args }) =>
		expectFailure(
			canvasElement,
			args,
			'Die Verbindung ist abgebrochen. Datei und Text bleiben hier.',
			'retry'
		)
};

export const ServiceUnavailable: Story = {
	name: 'Fehler: Token oder Dienst nicht erreichbar (503)',
	args: { ...handlers(), status: { kind: 'failed', reason: 'service' } },
	play: ({ canvasElement, args }) =>
		expectFailure(
			canvasElement,
			args,
			'Der Dienst ist gerade nicht erreichbar. Datei und Text bleiben hier.',
			'retry'
		)
};

export const Cancelled: Story = {
	name: 'Abgebrochen',
	args: { ...handlers(), status: { kind: 'failed', reason: 'cancelled' } },
	play: ({ canvasElement, args }) =>
		expectFailure(
			canvasElement,
			args,
			'Abgebrochen. Datei und Text bleiben hier.',
			'retry'
		)
};

export const OtherFailure: Story = {
	name: 'Fehler: anderer Grund',
	args: { ...handlers(), status: { kind: 'failed', reason: 'other' } },
	play: ({ canvasElement, args }) =>
		expectFailure(
			canvasElement,
			args,
			'Das Senden hat nicht geklappt. Datei und Text bleiben hier.',
			'retry'
		)
};

const PHONE_STATES: ComposerAttachmentCardProps[] = [
	{ ...PDF, status: { kind: 'ready' }, hasCaption: true },
	{ ...PDF, status: { kind: 'uploading', percent: 72 } },
	{ ...PDF, status: { kind: 'failed', reason: 'network' } },
	{
		...PDF,
		sizeBytes: 12_400_000,
		fileName:
			'lebenslauf-mit-einem-sehr-langen-dateinamen-der-nicht-in-die-zeile-passt.pdf',
		status: { kind: 'failed', reason: 'tooLarge' }
	}
];

export const OnPhone: Story = {
	name: 'Telefon, 375 px: Tippflächen und lange Namen',
	globals: phone375Globals,
	decorators: [(Story) => <Story />],
	render: () => (
		<div
			style={{
				display: 'grid',
				gridTemplateColumns: 'minmax(0, 1fr)',
				gap: 12,
				padding: 16,
				boxSizing: 'border-box',
				width: '100%'
			}}
		>
			{PHONE_STATES.map((state, index) => (
				<ComposerAttachmentCard key={index} {...state} />
			))}
		</div>
	),
	play: async ({ canvasElement }) => {
		const buttons = within(canvasElement).getAllByRole('button');
		expect(buttons.length).toBeGreaterThan(0);
		for (const button of buttons) {
			const { width, height } = button.getBoundingClientRect();
			expect(width).toBeGreaterThanOrEqual(44);
			expect(height).toBeGreaterThanOrEqual(44);
		}
		// The long name stays on its line, nothing widens the page.
		const root = canvasElement.ownerDocument.documentElement;
		expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth);
	}
};
