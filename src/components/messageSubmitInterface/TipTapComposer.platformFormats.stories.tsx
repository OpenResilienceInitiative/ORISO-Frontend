import * as React from 'react';
import { useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import i18next from 'i18next';
import { useTranslation } from 'react-i18next';
import { TipTapComposer, type TipTapComposerRef } from './TipTapComposer';
import { ComposerToolbar } from './inputField/ComposerToolbar';
import { PlatformFormatsProvider } from './__storybook__/PlatformFormatsProvider';
import {
	CHAT_COMPOSER_FORMATS,
	type ChatComposerFormat
} from '../message/chatMessageConfig';

const label = (key: string) => i18next.t(`message.submit.toolbar.${key}`);
const modKey = /Mac|iPhone|iPad/.test(navigator.platform) ? 'Meta' : 'Control';

type Args = {
	disabledFormats: ChatComposerFormat[];
	/** Content already in the composer: a draft, or a message being edited. */
	initialContent: string;
};

/**
 * The real editor and the real toolbar. The checkboxes play the platform admin;
 * `html` below shows what would be sent.
 */
const Harness = ({ disabledFormats, initialContent }: Args) => {
	const { t } = useTranslation();
	const composer = useRef<TipTapComposerRef>(null);
	const [value, setValue] = useState(initialContent);
	const [disabled, setDisabled] = useState(disabledFormats);
	const [, forceToolbar] = useState(0);
	return (
		<div style={{ width: 900, padding: 16 }}>
			<fieldset>
				<legend>Platform offers</legend>
				{(
					[
						'bold',
						'heading',
						'bulletList',
						'blockquote',
						'link'
					] as const
				).map((format) => (
					<label key={format} style={{ marginRight: 12 }}>
						<input
							type="checkbox"
							checked={!disabled.includes(format)}
							onChange={(event) =>
								setDisabled((current) =>
									event.target.checked
										? current.filter((f) => f !== format)
										: [...current, format]
								)
							}
						/>
						{format}
					</label>
				))}
			</fieldset>
			<PlatformFormatsProvider disabledFormats={disabled}>
				<ComposerToolbar
					direction="down"
					isMobile={false}
					isExpanded={false}
					onAction={(action) => {
						composer.current?.runAction(action);
						forceToolbar((n) => n + 1);
					}}
					isActionSelected={(action) =>
						composer.current?.isActionActive(action) ?? false
					}
					onCollapse={() => {}}
					onExpandToggle={() => {}}
					translate={t}
				/>
				<div
					style={{
						minHeight: 120,
						marginTop: 8,
						border: '1px solid var(--m3-outline, #777)'
					}}
				>
					<TipTapComposer
						ref={composer}
						value={value}
						placeholder="Write a reply"
						showToolbar={false}
						readOnly={false}
						onChange={setValue}
						onSubmitShortcut={() => {}}
					/>
				</div>
			</PlatformFormatsProvider>
			<h2>html</h2>
			<pre data-testid="html" style={{ whiteSpace: 'pre-wrap' }}>
				{value}
			</pre>
		</div>
	);
};

const meta = {
	title: 'Components/Composer/Platform formats (real editor)',
	component: Harness,
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component:
					'What a disabled format does in the real TipTap editor. Off: no button, the shortcut ' +
					'does nothing, markdown stays literal text, pasted content keeps its words and loses ' +
					'the format, and content that already has the format keeps it. On again: all of it works, ' +
					'in the same editor, without a reload.'
			}
		}
	},
	argTypes: {
		disabledFormats: {
			control: 'check',
			options: [...CHAT_COMPOSER_FORMATS]
		},
		initialContent: { control: 'text' }
	},
	args: { disabledFormats: [], initialContent: '' }
} satisfies Meta<typeof Harness>;

export default meta;
type Story = StoryObj<typeof meta>;

const editorOf = async (canvasElement: HTMLElement) => {
	const editor = await within(canvasElement).findByRole('textbox');
	await userEvent.click(editor);
	return editor;
};

const htmlOf = (canvasElement: HTMLElement) =>
	within(canvasElement).getByTestId('html').textContent ?? '';

const expectHtml = (canvasElement: HTMLElement, matcher: RegExp) =>
	waitFor(() => expect(htmlOf(canvasElement)).toMatch(matcher));

const setOffered = (canvasElement: HTMLElement, format: string) =>
	userEvent.click(
		within(canvasElement).getByRole('checkbox', { name: format })
	);

const paste = (editor: HTMLElement, html: string, text: string) => {
	const clipboardData = new DataTransfer();
	clipboardData.setData('text/html', html);
	clipboardData.setData('text/plain', text);
	editor.dispatchEvent(
		new ClipboardEvent('paste', {
			clipboardData,
			bubbles: true,
			cancelable: true
		})
	);
};

export const ShortcutFollowsTheSetting: Story = {
	args: { disabledFormats: ['bold'] },
	play: async ({ canvasElement }) => {
		const editor = await editorOf(canvasElement);
		// Reported as handled, or the browser's own Cmd+B would apply bold anyway.
		let nativeBoldPrevented = false;
		editor.addEventListener('keydown', (event) => {
			if (event.key === 'b') {
				nativeBoldPrevented = event.defaultPrevented;
			}
		});
		await userEvent.keyboard(`{${modKey}>}b{/${modKey}}`);
		await userEvent.keyboard('off');
		await expectHtml(canvasElement, /<p[^>]*>off<\/p>/);
		expect(nativeBoldPrevented).toBe(true);

		await setOffered(canvasElement, 'bold');
		await editorOf(canvasElement);
		await userEvent.keyboard(`{${modKey}>}b{/${modKey}}`);
		await userEvent.keyboard('on');
		await expectHtml(canvasElement, /<strong>on<\/strong>/);
	}
};

export const MarkdownInputFollowsTheSetting: Story = {
	args: { disabledFormats: ['bold'] },
	play: async ({ canvasElement }) => {
		await editorOf(canvasElement);
		await userEvent.keyboard('**off** ');
		await expectHtml(canvasElement, /\*\*off\*\*/);
		expect(htmlOf(canvasElement)).not.toContain('<strong>');

		await setOffered(canvasElement, 'bold');
		await editorOf(canvasElement);
		await userEvent.keyboard('**on** ');
		await expectHtml(canvasElement, /<strong>on<\/strong>/);
	}
};

export const BlockMarkdownInputFollowsTheSetting: Story = {
	args: { disabledFormats: ['heading', 'bulletList', 'blockquote'] },
	play: async ({ canvasElement }) => {
		await editorOf(canvasElement);
		await userEvent.keyboard('## off');
		await expectHtml(canvasElement, /<p[^>]*>## off<\/p>/);
		await userEvent.keyboard('{Enter}- off');
		await expectHtml(canvasElement, /<p[^>]*>- off<\/p>/);
		await userEvent.keyboard('{Enter}> off');
		await expectHtml(canvasElement, /<p[^>]*>(&gt;|>) off<\/p>/);

		await setOffered(canvasElement, 'heading');
		await editorOf(canvasElement);
		await userEvent.keyboard('{Enter}## on');
		await expectHtml(canvasElement, /<h2[^>]*>on<\/h2>/);
	}
};

export const PasteFollowsTheSetting: Story = {
	args: { disabledFormats: ['bold', 'heading', 'bulletList', 'link'] },
	play: async ({ canvasElement }) => {
		const editor = await editorOf(canvasElement);
		paste(
			editor,
			'<h2>Title</h2><p><strong>strong</strong> and <em>kept</em> and <a href="https://example.org">site</a></p><ul><li><p>item</p></li></ul>',
			'Title strong and kept and site item'
		);
		await expectHtml(canvasElement, /kept/);
		const off = htmlOf(canvasElement);
		for (const word of ['Title', 'strong', 'site', 'item']) {
			expect(off).toContain(word);
		}
		expect(off).toContain('<em>kept</em>');
		for (const tag of ['<h2', '<strong', '<a ', '<ul', '<li']) {
			expect(off).not.toContain(tag);
		}

		await setOffered(canvasElement, 'bold');
		await editorOf(canvasElement);
		paste(editor, '<p><strong>back</strong></p>', 'back');
		await expectHtml(canvasElement, /<strong>back<\/strong>/);
	}
};

export const AutolinkFollowsTheSetting: Story = {
	args: { disabledFormats: ['link'] },
	play: async ({ canvasElement }) => {
		await editorOf(canvasElement);
		await userEvent.keyboard('https://off.example.org ');
		await expectHtml(canvasElement, /https:\/\/off\.example\.org/);
		expect(htmlOf(canvasElement)).not.toContain('<a ');

		await setOffered(canvasElement, 'link');
		await editorOf(canvasElement);
		await userEvent.keyboard('https://on.example.org ');
		await expectHtml(
			canvasElement,
			/<a [^>]*href="https:\/\/on\.example\.org/
		);
	}
};

/**
 * The hard requirement. A draft or edited message that already holds the format
 * keeps it while the format is off, because the capability is never removed.
 */
export const ExistingContentKeepsDisabledFormats: Story = {
	args: {
		disabledFormats: [...CHAT_COMPOSER_FORMATS],
		initialContent:
			'<h2>Title</h2><p><strong>bold</strong> <em>italic</em> <u>under</u> <s>strike</s> <code>code</code> <sup>sup</sup> <sub>sub</sub> <a href="https://example.org">link</a></p><ul><li><p>bullet</p></li></ul><ol><li><p>number</p></li></ol><blockquote><p>quote</p></blockquote><pre><code>block</code></pre>'
	},
	play: async ({ canvasElement }) => {
		const editor = await within(canvasElement).findByRole('textbox');
		for (const selector of [
			'h2',
			'strong',
			'em',
			'u',
			's',
			'code',
			'sup',
			'sub',
			'a[href]',
			'ul li',
			'ol li',
			'blockquote',
			'pre code'
		]) {
			await expect(editor.querySelector(selector)).not.toBeNull();
		}
	}
};

/** Enter inside an existing code block is editing, not creating: it keeps working. */
export const EditingAnExistingBlockStillWorks: Story = {
	args: {
		disabledFormats: ['codeBlock'],
		initialContent: '<pre><code>line one</code></pre>'
	},
	play: async ({ canvasElement }) => {
		const editor = await editorOf(canvasElement);
		await userEvent.keyboard('{Enter}line two');
		await waitFor(() =>
			expect(editor.querySelector('pre')?.textContent).toContain(
				'line two'
			)
		);
	}
};

/** Both directions on one editor instance: the button and the format come back. */
export const ButtonOffAndOnAgainInTheSameEditor: Story = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await editorOf(canvasElement);
		await userEvent.keyboard('text');
		await expectHtml(canvasElement, /<p[^>]*>text<\/p>/);
		const editorBefore = canvas.getByRole('textbox');

		await setOffered(canvasElement, 'bold');
		await expect(
			canvas.queryByRole('button', { name: label('bold') })
		).toBeNull();

		await setOffered(canvasElement, 'bold');
		expect(canvas.getByRole('textbox')).toBe(editorBefore);
		await editorOf(canvasElement);
		await userEvent.keyboard(`{${modKey}>}a{/${modKey}}`);
		await userEvent.click(
			canvas.getByRole('button', { name: label('bold') })
		);
		await expectHtml(canvasElement, /<strong>text<\/strong>/);
	}
};
