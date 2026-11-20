import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, spyOn, userEvent, waitFor, within } from 'storybook/test';
import { chatTransportService } from '../../services/chatTransportService';
import { REMOTE_DRAFT_INDEX_SCOPE } from '../../services/draftStore';
import { DragAndDropArea } from '../dragAndDropArea/DragAndDropArea';
import { phone375Globals } from '../message/messageStoryShell';
import { ComposerStoryDecorator } from './__storybook__/composerStoryDecorator';
import { MessageSubmitInterfaceComponent } from './messageSubmitInterfaceComponent';
import './messageSubmitInterface.styles.scss';
import '../session/session.styles.scss';

/**
 * The real composer with the real send path down to the transport, where a
 * script stands in for the homeserver. `uploadProgress` and the abort signal
 * are the same ones the Matrix SDK upload uses.
 */
type FileSend = {
	file: File;
	options: {
		abortController?: AbortController;
		caption?: string;
		uploadProgress?: (percent: number) => void;
	};
};

let sends: FileSend[] = [];
let answer: (send: FileSend) => Promise<unknown> = () => Promise.resolve({});

const installTransport = () => {
	sends = [];
	answer = () => Promise.resolve({ event_id: '$sent' });
	const fileSpy = spyOn(
		chatTransportService,
		'sendFileMessage'
	).mockImplementation((_room, file, options = {}) => {
		const send = { file, options };
		sends.push(send);
		return answer(send) as Promise<any>;
	});
	const textSpy = spyOn(
		chatTransportService,
		'sendTextMessage'
	).mockResolvedValue({ success: true, event_id: '$text' });
	// Failure stories report to the error intake, as the app does. After a send
	// the draft store rereads its index. Both are real requests of this flow.
	const delegate = globalThis.fetch;
	const fixtureFetch: typeof fetch = (input, init) => {
		const url = new URL(
			input instanceof Request ? input.url : String(input)
		);
		if (url.pathname === '/service/error-reports') {
			return Promise.resolve(new Response(null, { status: 204 }));
		}
		if (url.searchParams.get('scopeKey') === REMOTE_DRAFT_INDEX_SCOPE) {
			return Promise.resolve(new Response(null, { status: 204 }));
		}
		return delegate(input, init);
	};
	globalThis.fetch = fixtureFetch;
	return () => {
		fileSpy.mockRestore();
		textSpy.mockRestore();
		globalThis.fetch = delegate;
	};
};

const waitForever = (send: FileSend) =>
	new Promise((_resolve, reject) => {
		send.options.abortController?.signal.addEventListener('abort', () =>
			reject(new DOMException('Aborted', 'AbortError'))
		);
	});

const shellStyle: React.CSSProperties = {
	background: '#eae7e8',
	minHeight: 560,
	padding: 24,
	position: 'relative',
	boxSizing: 'border-box',
	display: 'flex',
	flexDirection: 'column',
	justifyContent: 'flex-end',
	margin: 0,
	overflow: 'hidden'
};

const Composer = (
	props: Partial<React.ComponentProps<typeof MessageSubmitInterfaceComponent>>
) => (
	<ComposerStoryDecorator>
		<MessageSubmitInterfaceComponent
			placeholder="Nachricht an Klient:in schreiben"
			onSendButton={() => {}}
			isTyping={() => {}}
			language="de"
			{...props}
		/>
	</ComposerStoryDecorator>
);

const ComposerShell = () => (
	<div className="session" tabIndex={-1} style={shellStyle}>
		<Composer />
	</div>
);

const meta = {
	title: 'Components/Message/MessageSubmitInterface/Attachments',
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component:
					'Der echte Composer mit einer Datei: Der Entwurf bleibt stehen und geht als Beschriftung mit, der Fortschritt ist echt, jeder Fehler lässt Datei und Text stehen. Nur der Heimserver ist durch ein Skript ersetzt.'
			}
		}
	},
	beforeEach: installTransport,
	render: () => <ComposerShell />
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const DRAFT = 'Bitte Seite 2 lesen';

const editorIn = (canvasElement: HTMLElement) =>
	canvasElement.querySelector<HTMLElement>(
		'[contenteditable="true"]'
	) as HTMLElement;

const typeDraft = async (canvasElement: HTMLElement, text = DRAFT) => {
	await waitFor(() => expect(editorIn(canvasElement)).toBeTruthy());
	await userEvent.click(editorIn(canvasElement));
	await userEvent.keyboard(text);
	await waitFor(() => expect(editorIn(canvasElement).textContent).toBe(text));
};

const pdf = (name = 'befund.pdf', size = 1_250_000) => {
	const file = new File(['%PDF'], name, { type: 'application/pdf' });
	Object.defineProperty(file, 'size', { value: size });
	return file;
};

const pickFile = async (canvasElement: HTMLElement, file: File) => {
	const input = canvasElement.querySelector<HTMLInputElement>('#dataUpload');
	if (!input) {
		throw new Error('file input missing: upload feature is off');
	}
	await userEvent.upload(input, file);
};

const expectDraftKept = (canvasElement: HTMLElement, text = DRAFT) =>
	waitFor(() =>
		expect(canvasElement.querySelector('.ProseMirror')?.textContent).toBe(
			text
		)
	);

const clickSend = (canvasElement: HTMLElement) =>
	userEvent.click(
		within(canvasElement).getByRole('button', { name: /senden/i })
	);

const failedSend = async (canvasElement: HTMLElement, error: unknown) => {
	answer = () => Promise.reject(error);
	await typeDraft(canvasElement);
	await pickFile(canvasElement, pdf());
	await clickSend(canvasElement);
	await within(canvasElement).findByRole('alert');
};

const expectRetrySendsTheSameFileAndCaption = async (
	canvasElement: HTMLElement
) => {
	const canvas = within(canvasElement);
	const first = sends[0];
	answer = () => Promise.resolve({ event_id: '$sent' });
	await userEvent.click(
		canvas.getByRole('button', { name: 'Erneut senden' })
	);
	await waitFor(() => expect(sends).toHaveLength(2));
	expect(sends[1].file).toBe(first.file);
	expect(sends[1].options.caption).toContain(DRAFT);
	await waitFor(() => expect(canvas.queryByText('befund.pdf')).toBeNull());
	await expectDraftKept(canvasElement, '');
};

export const PickKeepsDraft: Story = {
	name: 'Datei wählen: der Entwurf bleibt und geht als Beschriftung mit',
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await typeDraft(canvasElement);
		await pickFile(canvasElement, pdf());

		expect(await canvas.findByText('befund.pdf')).toBeTruthy();
		expect(canvas.getByText('PDF · 1,3 MB')).toBeTruthy();
		expect(
			canvas.getByText('Der Text wird als Beschriftung mitgesendet.')
		).toBeTruthy();
		await expectDraftKept(canvasElement);

		await clickSend(canvasElement);
		await waitFor(() => expect(sends).toHaveLength(1));
		expect(sends[0].options.caption).toContain(DRAFT);
		await waitFor(() =>
			expect(canvas.queryByText('befund.pdf')).toBeNull()
		);
		await expectDraftKept(canvasElement, '');
	}
};

export const RemoveKeepsDraft: Story = {
	name: 'Datei entfernen: der Entwurf bleibt, der Text geht allein',
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await typeDraft(canvasElement);
		await pickFile(canvasElement, pdf());
		await userEvent.click(
			await canvas.findByRole('button', { name: /befund\.pdf entfernen/ })
		);

		expect(canvas.queryByText('befund.pdf')).toBeNull();
		await expectDraftKept(canvasElement);
		expect(sends).toHaveLength(0);
	}
};

export const RealProgress: Story = {
	name: 'Fortschritt: ohne Zahl, dann die echte Zahl, dann ohne Zahl',
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		answer = waitForever;
		await typeDraft(canvasElement);
		await pickFile(canvasElement, pdf());
		await clickSend(canvasElement);
		await waitFor(() => expect(sends).toHaveLength(1));

		expect(
			(await canvas.findByRole('progressbar')).getAttribute(
				'aria-valuenow'
			)
		).toBeNull();
		expect(canvas.getByText('Wird vorbereitet …')).toBeTruthy();

		sends[0].options.uploadProgress?.(37);
		await waitFor(() =>
			expect(
				canvas.getByRole('progressbar').getAttribute('aria-valuenow')
			).toBe('37')
		);
		expect(canvas.getByText('37 %')).toBeTruthy();
		expect(
			canvasElement
				.querySelector('.ProseMirror')
				?.getAttribute('contenteditable')
		).toBe('false');

		sends[0].options.uploadProgress?.(100);
		await canvas.findByText('Wird gesendet …');
		expect(
			canvas.getByRole('progressbar').getAttribute('aria-valuenow')
		).toBeNull();
		expect(canvas.queryByRole('button', { name: 'Abbrechen' })).toBeNull();
		await expectDraftKept(canvasElement);
	}
};

export const CancelAndRetry: Story = {
	name: 'Abbrechen: bricht wirklich ab, Datei und Text bleiben',
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		answer = waitForever;
		await typeDraft(canvasElement);
		await pickFile(canvasElement, pdf());
		await clickSend(canvasElement);
		await waitFor(() => expect(sends).toHaveLength(1));
		sends[0].options.uploadProgress?.(20);

		await userEvent.click(
			await canvas.findByRole('button', { name: 'Abbrechen' })
		);
		expect(sends[0].options.abortController?.signal.aborted).toBe(true);
		expect((await canvas.findByRole('alert')).textContent).toBe(
			'Abgebrochen. Datei und Text bleiben hier.'
		);
		await expectDraftKept(canvasElement);

		await expectRetrySendsTheSameFileAndCaption(canvasElement);
	}
};

export const NetworkFailureAndRetry: Story = {
	name: 'Verbindung weg: Datei und Text bleiben, erneut senden geht',
	play: async ({ canvasElement }) => {
		// An XHR with status 0 reaches us like this from matrix-js-sdk.
		await failedSend(canvasElement, new DOMException('', 'AbortError'));
		expect(within(canvasElement).getByRole('alert').textContent).toBe(
			'Die Verbindung ist abgebrochen. Datei und Text bleiben hier.'
		);
		await expectDraftKept(canvasElement);
		await expectRetrySendsTheSameFileAndCaption(canvasElement);
	}
};

export const TokenServiceDown: Story = {
	name: 'Token-Dienst antwortet 503: nicht still, und nichts geht verloren',
	play: async ({ canvasElement }) => {
		await failedSend(
			canvasElement,
			Object.assign(new Error('Matrix token unavailable'), {
				name: 'MatrixTokenUnavailableError',
				cause: new Error('CATCH_ALL')
			})
		);
		expect(within(canvasElement).getByRole('alert').textContent).toBe(
			'Der Dienst ist gerade nicht erreichbar. Datei und Text bleiben hier.'
		);
		await expectDraftKept(canvasElement);
		await expectRetrySendsTheSameFileAndCaption(canvasElement);
	}
};

export const ServerRefusesSize: Story = {
	name: 'Server antwortet 413: ehrlich, ohne Grenze zu erfinden',
	play: async ({ canvasElement }) => {
		await failedSend(
			canvasElement,
			Object.assign(new Error('too large'), { httpStatus: 413 })
		);
		expect(within(canvasElement).getByRole('alert').textContent).toBe(
			'Der Server lehnt diese Datei als zu groß ab. Datei und Text bleiben hier.'
		);
		await expectDraftKept(canvasElement);
	}
};

export const TooLargeBeforeUpload: Story = {
	name: 'Zu groß: abgelehnt vor dem Hochladen, mit der echten Grenze',
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await typeDraft(canvasElement);
		await pickFile(canvasElement, pdf('scan.pdf', 12_400_000));

		expect((await canvas.findByRole('alert')).textContent).toBe(
			'Diese Datei ist 12,4 MB groß. Erlaubt sind höchstens 10 MB. Es wurde nichts hochgeladen.'
		);
		await expectDraftKept(canvasElement);
		expect(sends).toHaveLength(0);
		expect(
			(
				canvas.getByRole('button', {
					name: /senden/i
				}) as HTMLButtonElement
			).disabled
		).toBe(true);

		await userEvent.click(
			canvas.getByRole('button', { name: /scan\.pdf entfernen/ })
		);
		expect(canvas.queryByRole('alert')).toBeNull();
		await expectDraftKept(canvasElement);
	}
};

const dropEvent = (type: string, files: File[], target: Element) => {
	const dataTransfer = new DataTransfer();
	files.forEach((file) => dataTransfer.items.add(file));
	// ProseMirror resolves a drop by its coordinates.
	const box = target.getBoundingClientRect();
	return new DragEvent(type, {
		bubbles: true,
		cancelable: true,
		clientX: box.left + box.width / 2,
		clientY: box.top + box.height / 2,
		dataTransfer
	});
};

export const DropIntoEditor: Story = {
	name: 'Datei ins Textfeld ziehen: dieselbe Karte, der Entwurf bleibt',
	play: async ({ canvasElement }) => {
		await typeDraft(canvasElement);
		const target = editorIn(canvasElement);
		target.dispatchEvent(dropEvent('drop', [pdf('gezogen.pdf')], target));

		expect(
			await within(canvasElement).findByText('gezogen.pdf')
		).toBeTruthy();
		await expectDraftKept(canvasElement);
	}
};

/** Wired like SessionItemComponent: DragAndDropArea hands over `preselectedFile`. */
const SessionDropShell = () => {
	const [dropped, setDropped] = React.useState<File | null>(null);
	return (
		<div className="session" tabIndex={-1} style={shellStyle}>
			<div
				data-testid="drop-zone-host"
				style={{ position: 'relative', height: 160 }}
			>
				<DragAndDropArea
					onFileDragged={setDropped}
					isDragging
					canDrop
					onDragLeave={() => {}}
				/>
			</div>
			<Composer preselectedFile={dropped} />
		</div>
	);
};

export const DropOnSessionArea: Story = {
	name: 'Datei auf den Gesprächsbereich ziehen: dieselbe Karte, der Entwurf bleibt',
	render: () => <SessionDropShell />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await typeDraft(canvasElement);
		const zone = canvasElement.querySelector('.dragAndDropArea')!;
		const file = pdf('bereich.pdf');
		zone.dispatchEvent(dropEvent('dragenter', [file], zone));
		zone.dispatchEvent(dropEvent('drop', [file], zone));

		expect(await canvas.findByText('bereich.pdf')).toBeTruthy();
		await expectDraftKept(canvasElement);

		// Removed from the card, it must not travel with the next send.
		await userEvent.click(
			canvas.getByRole('button', { name: /bereich\.pdf entfernen/ })
		);
		expect(canvas.queryByText('bereich.pdf')).toBeNull();
		await userEvent.click(canvas.getByRole('button', { name: /senden/i }));
		await expectDraftKept(canvasElement, '');
		expect(sends).toHaveLength(0);
	}
};

export const OnPhone: Story = {
	name: 'Telefon, 375 px: Karte passt, Tippflächen 44 px, Text bleibt sichtbar',
	globals: phone375Globals,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await typeDraft(canvasElement);
		await pickFile(
			canvasElement,
			pdf('ein-sehr-langer-dateiname-der-nicht-in-eine-zeile-passt.pdf')
		);
		const card = await waitFor(() => {
			const node = canvasElement.querySelector<HTMLElement>(
				'.composerAttachmentCard'
			);
			if (!node) {
				throw new Error('card not rendered yet');
			}
			return node;
		});
		const field =
			canvasElement.querySelector<HTMLElement>('.textarea__input')!;
		const text = canvasElement.querySelector<HTMLElement>('.ProseMirror')!;

		await waitFor(() => {
			const cardBox = card.getBoundingClientRect();
			const fieldBox = field.getBoundingClientRect();
			const textBox = text.getBoundingClientRect();
			expect(cardBox.left).toBeGreaterThanOrEqual(fieldBox.left);
			expect(cardBox.right).toBeLessThanOrEqual(fieldBox.right);
			expect(cardBox.bottom).toBeLessThanOrEqual(fieldBox.bottom);
			// The draft stays readable above the card.
			expect(textBox.bottom).toBeLessThanOrEqual(cardBox.top);
			expect(textBox.height).toBeGreaterThanOrEqual(20);
		});
		const remove = canvas.getByRole('button', { name: /entfernen/ });
		const { width, height } = remove.getBoundingClientRect();
		expect(width).toBeGreaterThanOrEqual(44);
		expect(height).toBeGreaterThanOrEqual(44);
	}
};
