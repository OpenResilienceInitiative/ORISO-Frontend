// @vitest-environment jsdom
import * as React from 'react';
import { createRef } from 'react';
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react';
import { Editor } from '@tiptap/core';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import de from '../../resources/i18n/de/common.json';
import en from '../../resources/i18n/en/common.json';
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';
import { TipTapComposer, TipTapComposerRef } from './TipTapComposer';

// TipTap's focus command lands in a requestAnimationFrame, not in the call.
// Frames are queued and flushed by hand so the test does not ride on
// jsdom's frame timer.
const frames: FrameRequestCallback[] = [];

beforeEach(() => {
	frames.length = 0;
	vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
		frames.push(callback);
		return frames.length;
	});
	vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
});

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

const nextFrames = async (count = 2) => {
	for (let i = 0; i < count; i += 1) {
		frames.splice(0).forEach((callback) => callback(0));
		await Promise.resolve();
	}
};

const renderBesideAnInput = () => {
	const ref = createRef<TipTapComposerRef>();
	render(
		<>
			<input data-testid="elsewhere" />
			<TipTapComposer
				ref={ref}
				value="<p>Entwurf</p>"
				placeholder="test"
				showToolbar={false}
				readOnly={false}
				onChange={() => {}}
				onSubmitShortcut={() => {}}
			/>
		</>
	);
	return ref;
};

describe('TipTapComposer focus ownership', () => {
	it('resets the alignment without taking focus — not now, not a frame later', async () => {
		const ref = renderBesideAnInput();
		await waitFor(() => expect(ref.current).toBeTruthy());
		const elsewhere = screen.getByTestId('elsewhere');
		// A plain paragraph already counts as left; start from centre so a
		// no-op reset cannot pass.
		ref.current!.runAction('alignCenter');
		await nextFrames();
		expect(ref.current!.isActionActive('alignCenter')).toBe(true);
		elsewhere.focus();

		ref.current!.resetTextAlign();
		await nextFrames();

		expect(document.activeElement).toBe(elsewhere);
		expect(ref.current!.isActionActive('alignLeft')).toBe(true);
	});

	// Why the automatic focus must not use it: the toolbar action focuses a
	// frame after the call, past any check made at call time.
	it('runAction("alignLeft") pulls focus in a later frame', async () => {
		const ref = renderBesideAnInput();
		await waitFor(() => expect(ref.current).toBeTruthy());
		const elsewhere = screen.getByTestId('elsewhere');
		elsewhere.focus();

		ref.current!.runAction('alignLeft');
		expect(document.activeElement).toBe(elsewhere);
		await nextFrames();

		expect(document.activeElement).not.toBe(elsewhere);
	});
});

// Names are checked on the actual ProseMirror node, including populated and
// non-editable states. Neither useEditor nor EditorContent is mocked.
const renderAccessibleComposer = async (
	overrides: Partial<React.ComponentProps<typeof TipTapComposer>> = {},
	language = 'de'
) => {
	const i18n = createInstance();
	await i18n.init({
		lng: language,
		fallbackLng: 'de',
		defaultNS: 'common',
		ns: ['common'],
		resources: { de: { common: de }, en: { common: en } },
		interpolation: { escapeValue: false },
		react: { useSuspense: false }
	});
	const ref = createRef<TipTapComposerRef>();
	const onChange = vi.fn<(html: string) => void>();
	const onSubmitShortcut = vi.fn<() => void>();
	const onFilesSelected = vi.fn<(files: File[]) => void>();
	const onFocusChange = vi.fn<(focused: boolean) => void>();
	let props: React.ComponentProps<typeof TipTapComposer> = {
		value: '<p>Unsent draft</p>',
		placeholder: 'Nachricht an das Team …',
		showToolbar: false,
		readOnly: false,
		onChange,
		onSubmitShortcut,
		onFilesSelected,
		onFocusChange,
		...overrides
	};
	const tree = () => (
		<I18nextProvider i18n={i18n}>
			<TipTapComposer {...props} ref={ref} />
		</I18nextProvider>
	);
	const view = render(tree());
	await waitFor(() => expect(ref.current).toBeTruthy());
	return {
		...view,
		i18n,
		ref,
		onChange,
		onSubmitShortcut,
		onFilesSelected,
		onFocusChange,
		rerenderComposer(
			next: Partial<React.ComponentProps<typeof TipTapComposer>>
		) {
			props = { ...props, ...next };
			view.rerender(tree());
		}
	};
};

// TipTap core intentionally attaches the actual Editor to view.dom for tests
// (installed3.29.2 Editor.ts). Import only its public constructor/API.
const nativeEditor = (textbox: HTMLElement): Editor => {
	if (!('editor' in textbox) || !(textbox.editor instanceof Editor)) {
		throw new Error('The actual TipTap editable node has no native Editor');
	}
	return textbox.editor;
};
const expectInputHandlers = (editor: Editor) => {
	for (const name of [
		'handleTextInput',
		'handlePaste',
		'handleDrop',
		'handleKeyDown'
	] as const) {
		expect(editor.options.editorProps?.[name]).toBeTypeOf('function');
	}
};

describe('TipTapComposer persistent accessible name', () => {
	it.each([
		{ kind: 'empty', value: '', readOnly: false },
		{
			kind: 'populated',
			value: '<p>Private draft contents</p>',
			readOnly: false
		},
		{
			kind: 'readonly',
			value: '<p>Private draft contents</p>',
			readOnly: true
		}
	])(
		'names the $kind real textbox from its contextual placeholder',
		async ({ value, readOnly }) => {
			await renderAccessibleComposer({ value, readOnly });
			const textbox = await screen.findByRole('textbox', {
				name: 'Nachricht an das Team …'
			});
			expect(nativeEditor(textbox).view.dom).toBe(textbox);
			expect(textbox.getAttribute('contenteditable')).toBe(
				String(!readOnly)
			);
			expect(
				screen.queryByRole('textbox', {
					name: 'Private draft contents'
				})
			).toBeNull();
			if (value)
				expect(textbox.textContent).toBe('Private draft contents');
		}
	);

	it.each([
		{ language: 'en', placeholder: '', label: 'Write message' },
		{ language: 'de', placeholder: ' \t\n ', label: 'Nachricht schreiben' }
	])(
		'uses the canonical translated $language fallback for a blank placeholder',
		async ({ language, placeholder, label }) => {
			const view = await renderAccessibleComposer(
				{ placeholder },
				language
			);
			// A missing resource key cannot satisfy a name expectation accidentally.
			expect(
				view.i18n.t('enquiry.write.input.placeholder.groupChat')
			).toBe(label);
			const textbox = await screen.findByRole('textbox', { name: label });
			expect(nativeEditor(textbox).view.dom).toBe(textbox);
		}
	);

	it('renames a changed contextual placeholder without replacing editor, draft, selection, focus or input handlers', async () => {
		const view = await renderAccessibleComposer();
		const textbox = screen.getByRole('textbox');
		const editor = nativeEditor(textbox);
		act(() => {
			textbox.focus();
			editor.commands.setTextSelection({ from: 2, to: 5 });
		});
		const documentBefore = editor.state.doc;
		const selectionBefore = editor.state.selection;
		const htmlBefore = editor.getHTML();
		const editorViewBefore = editor.view;
		view.onChange.mockClear();
		view.rerenderComposer({ placeholder: 'Nachricht nur an diese Person' });
		await waitFor(() =>
			expect(
				screen.getByRole('textbox', {
					name: 'Nachricht nur an diese Person'
				})
			).toBe(textbox)
		);
		expect(
			screen.queryByRole('textbox', { name: 'Nachricht an das Team …' })
		).toBeNull();
		expect(nativeEditor(textbox)).toBe(editor);
		expect(editor.view).toBe(editorViewBefore);
		expect(editor.state.doc).toBe(documentBefore);
		expect(editor.state.selection.eq(selectionBefore)).toBe(true);
		expect(editor.getHTML()).toBe(htmlBefore);
		expect(document.activeElement).toBe(textbox);
		expect(view.onChange).not.toHaveBeenCalled();
		expectInputHandlers(editor);
		fireEvent.keyDown(textbox, {
			key: 'Enter',
			code: 'Enter',
			altKey: true
		});
		expect(view.onSubmitShortcut).toHaveBeenCalledExactlyOnceWith();
	});

	it('updates the blank-name fallback from de to en on the same focused editor and retains real paste and shortcut handlers', async () => {
		const view = await renderAccessibleComposer({ placeholder: '' });
		const textbox = await screen.findByRole('textbox', {
			name: 'Nachricht schreiben'
		});
		const editor = nativeEditor(textbox);
		act(() => {
			textbox.focus();
			editor.commands.setTextSelection({ from: 2, to: 5 });
		});
		const documentBefore = editor.state.doc;
		const selectionBefore = editor.state.selection;
		const htmlBefore = editor.getHTML();
		view.onChange.mockClear();
		await act(async () => {
			await view.i18n.changeLanguage('en');
		});
		await waitFor(() =>
			expect(screen.getByRole('textbox', { name: 'Write message' })).toBe(
				textbox
			)
		);
		expect(
			screen.queryByRole('textbox', { name: 'Nachricht schreiben' })
		).toBeNull();
		expect(nativeEditor(textbox)).toBe(editor);
		expect(editor.state.doc).toBe(documentBefore);
		expect(editor.state.selection.eq(selectionBefore)).toBe(true);
		expect(document.activeElement).toBe(textbox);
		expectInputHandlers(editor);
		const image = new File(['controlled image'], 'draft.png', {
			type: 'image/png'
		});
		fireEvent.paste(textbox, {
			clipboardData: {
				files: [image],
				types: ['Files'],
				getData: () => ''
			}
		});
		expect(view.onFilesSelected).toHaveBeenCalledExactlyOnceWith([image]);
		fireEvent.keyDown(textbox, {
			key: 'Enter',
			code: 'Enter',
			altKey: true
		});
		expect(view.onSubmitShortcut).toHaveBeenCalledExactlyOnceWith();
		expect(view.onFocusChange).toHaveBeenCalledWith(true);
		expect(editor.getHTML()).toBe(htmlBefore);
		expect(view.onChange).not.toHaveBeenCalled();
	});
});
