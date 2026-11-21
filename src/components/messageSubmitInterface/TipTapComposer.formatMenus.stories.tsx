import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { Editor } from '@tiptap/core';
import { TipTapComposer } from './TipTapComposer';
import { PlatformFormatsProvider } from './__storybook__/PlatformFormatsProvider';
import type { ChatComposerFormat } from '../message/chatMessageConfig';

const Field = ({
	label,
	initialContent,
	onSend
}: {
	label: string;
	initialContent: string;
	onSend: () => void;
}) => {
	const [value, setValue] = useState(initialContent);
	return (
		<div
			style={{
				flex: 1,
				minWidth: 0,
				border: '1px solid var(--m3-outline-variant)'
			}}
		>
			<TipTapComposer
				value={value}
				placeholder={label}
				showToolbar={false}
				readOnly={false}
				onChange={setValue}
				onSubmitShortcut={onSend}
			/>
		</div>
	);
};

const Harness = ({
	initialContent,
	disabledFormats,
	split,
	onSend
}: {
	initialContent: string;
	disabledFormats: ChatComposerFormat[];
	split: boolean;
	onSend: () => void;
}) => (
	<PlatformFormatsProvider disabledFormats={disabledFormats}>
		<div style={{ display: 'flex', gap: 12, padding: '96px 12px 12px' }}>
			<Field
				label="Nachricht"
				initialContent={initialContent}
				onSend={onSend}
			/>
			{split && (
				<Field label="Supervision" initialContent="" onSend={onSend} />
			)}
		</div>
	</PlatformFormatsProvider>
);

const meta = {
	title: 'Components/Composer/Format menus',
	component: Harness,
	globals: { locale: 'de' },
	args: {
		initialContent: '',
		disabledFormats: [],
		split: false,
		onSend: fn()
	}
} satisfies Meta<typeof Harness>;
export default meta;
type Story = StoryObj<typeof meta>;

const select = (element: HTMLElement, from: number, to: number) => {
	if (!('editor' in element) || !(element.editor instanceof Editor)) {
		throw new Error('The story must use the shared TipTap editor');
	}
	element.editor.commands.setTextSelection({ from, to });
};

const selectionToolbar = (document: Document) =>
	within(document.body).findByRole('toolbar', {
		name: 'Auswahl formatieren'
	});
const slashList = (document: Document) =>
	within(document.body).findByRole('listbox', { name: 'Formatbefehle' });

export const AfterSelection: Story = {
	args: { initialContent: '<p>Heute ist morgen.</p><p>Und dann.</p>' },
	play: async ({ canvas, canvasElement }) => {
		const field = await canvas.findByRole('textbox', { name: 'Nachricht' });
		await userEvent.click(field);
		select(field, 7, 10);
		const bar = await selectionToolbar(canvasElement.ownerDocument);
		await userEvent.keyboard('{Alt>}{F10}{/Alt}');
		await expect(
			within(bar).getByRole('button', { name: 'Fett' })
		).toHaveFocus();
		await userEvent.keyboard('{Enter}');
		await waitFor(() =>
			expect(field.querySelector('strong')).toHaveTextContent('ist')
		);
		select(field, 5, 23);
		await userEvent.click(
			within(bar).getByRole('button', { name: 'Aufzählung' })
		);
		await waitFor(() =>
			expect(field.querySelectorAll('ul > li')).toHaveLength(2)
		);
	}
};

export const SlashCommands: Story = {
	play: async ({ args, canvas, canvasElement }) => {
		const field = await canvas.findByRole('textbox', { name: 'Nachricht' });
		await userEvent.type(field, '/fett');
		const list = await slashList(canvasElement.ownerDocument);
		await expect(
			within(list).getByRole('option', { name: 'Fett' })
		).toBeVisible();
		await userEvent.keyboard('{Alt>}{Enter}{/Alt}');
		await userEvent.keyboard('Wichtig');
		await waitFor(() =>
			expect(field.querySelector('strong')).toHaveTextContent('Wichtig')
		);
		await expect(field).not.toHaveTextContent('/fett');
		await expect(args.onSend).not.toHaveBeenCalled();
		await userEvent.keyboard('{Alt>}{Enter}{/Alt}');
		await expect(args.onSend).toHaveBeenCalledTimes(1);
	}
};

export const Phone: Story = {
	globals: { viewport: { value: 'phone390' } },
	args: { initialContent: '<p>Vorhandener Text.</p>' },
	beforeEach: () => {
		const nativeMatchMedia = window.matchMedia;
		window.matchMedia = (query) => {
			const result = nativeMatchMedia.call(window, query);
			if (query === '(hover: hover) and (pointer: fine)') {
				Object.defineProperty(result, 'matches', { value: false });
			}
			return result;
		};
		return () => {
			window.matchMedia = nativeMatchMedia;
		};
	},
	play: async ({ canvas, canvasElement }) => {
		const field = await canvas.findByRole('textbox', { name: 'Nachricht' });
		await userEvent.click(field);
		select(field, 1, 18);
		await expect(field).not.toHaveAttribute('aria-keyshortcuts', 'Alt+F10');
		await expect(
			within(canvasElement.ownerDocument.body).queryByRole('toolbar', {
				name: 'Auswahl formatieren'
			})
		).toBeNull();
		await userEvent.keyboard('{Backspace}/liste');
		const list = await slashList(canvasElement.ownerDocument);
		await userEvent.click(
			within(list).getByRole('option', { name: 'Aufzählung' })
		);
		await userEvent.keyboard('Erster Punkt');
		await waitFor(() =>
			expect(field.querySelector('ul > li')).toHaveTextContent(
				'Erster Punkt'
			)
		);
	}
};

export const DisabledFormats: Story = {
	args: {
		initialContent: '<p>Vorhandener Text.</p>',
		disabledFormats: ['bold']
	},
	play: async ({ canvas, canvasElement }) => {
		const field = await canvas.findByRole('textbox', { name: 'Nachricht' });
		await userEvent.click(field);
		select(field, 1, 12);
		const bar = await selectionToolbar(canvasElement.ownerDocument);
		await expect(
			within(bar).queryByRole('button', { name: 'Fett' })
		).toBeNull();
		select(field, 1, 17);
		await userEvent.keyboard('/fett');
		await expect(
			within(canvasElement.ownerDocument.body).queryByRole('option', {
				name: 'Fett'
			})
		).toBeNull();
		await expect(field).toHaveTextContent('/fett');
	}
};

export const Split: Story = {
	args: { initialContent: '<p>Entwurf im Hauptchat.</p>', split: true },
	play: async ({ args, canvas, canvasElement }) => {
		const main = await canvas.findByRole('textbox', { name: 'Nachricht' });
		const side = await canvas.findByRole('textbox', {
			name: 'Supervision'
		});
		await userEvent.click(main);
		select(main, 1, 8);
		const selection = await selectionToolbar(canvasElement.ownerDocument);
		await userEvent.keyboard('{Alt>}{F10}{/Alt}');
		await expect(
			within(selection).getByRole('button', { name: 'Fett' })
		).toHaveFocus();
		await userEvent.type(side, '/');
		const list = await slashList(canvasElement.ownerDocument);
		await userEvent.keyboard('{ArrowDown}{Escape}');
		await waitFor(() => expect(list).not.toBeInTheDocument());
		await expect(main).toHaveTextContent('Entwurf im Hauptchat.');
		await expect(side).toHaveTextContent('/');
		await expect(args.onSend).not.toHaveBeenCalled();
		await expect(
			within(canvasElement.ownerDocument.body).queryByRole('toolbar', {
				name: 'Auswahl formatieren'
			})
		).toBeNull();
	}
};
