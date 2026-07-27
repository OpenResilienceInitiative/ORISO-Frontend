// @vitest-environment jsdom
import * as React from 'react';
import { createRef } from 'react';
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
	const commands = {
		setTextAlign: vi.fn(),
		setContent: vi.fn(),
		clearContent: vi.fn(),
		focus: vi.fn()
	};
	const editor: any = {
		isDestroyed: false,
		setEditable: vi.fn(),
		getHTML: vi.fn(() => '')
	};
	Object.defineProperty(editor, 'commands', {
		get() {
			if (!editor.isDestroyed) {
				return commands;
			}
			throw new TypeError(
				"Cannot read properties of null (reading 'commands')"
			);
		}
	});
	return { editor, options: null as any };
});

vi.mock('@tiptap/react', () => ({
	EditorContent: () => null,
	useEditor: (options: any) => {
		mocks.options = options;
		return mocks.editor;
	}
}));

// The component import must follow the hoisted module mock in this lifecycle test.
// eslint-disable-next-line import/first
import { TipTapComposer, TipTapComposerRef } from './TipTapComposer';

afterEach(() => cleanup());

describe('TipTapComposer destroyed editor lifecycle', () => {
	it('ignores imperative clear after the editor was destroyed during a room transition', async () => {
		const ref = createRef<TipTapComposerRef>();
		const onChange = vi.fn();

		const view = render(
			<TipTapComposer
				ref={ref}
				value=""
				placeholder="test"
				showToolbar={false}
				readOnly={false}
				onChange={onChange}
				onSubmitShortcut={() => {}}
			/>
		);

		await waitFor(() => expect(ref.current).toBeTruthy());
		mocks.editor.isDestroyed = true;
		expect(() => ref.current!.clear()).not.toThrow();
		expect(() => ref.current!.isActionActive('bold')).not.toThrow();
		expect(ref.current!.isActionActive('bold')).toBe(false);
		expect(() =>
			mocks.options.onUpdate({ editor: mocks.editor })
		).not.toThrow();
		expect(onChange).not.toHaveBeenCalled();

		view.rerender(
			<TipTapComposer
				ref={ref}
				value=""
				placeholder="test"
				showToolbar={true}
				readOnly={false}
				onChange={onChange}
				onSubmitShortcut={() => {}}
			/>
		);
		expect(
			view.container.querySelector('.tiptap-composer__loading')
		).toBeTruthy();
		expect(view.container.querySelector('.tiptap-composer')).toBeNull();
		expect(
			view.container.querySelector('.tiptap-composer__toolbar')
		).toBeNull();
	});
});
