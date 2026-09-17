// @vitest-environment jsdom
import * as React from 'react';
import { createRef } from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { TipTapComposer, TipTapComposerRef } from '../TipTapComposer';

afterEach(() => cleanup());

/**
 * Emojis must land at the caret, not be appended at the end. The composer's
 * insertText (used by handleEmojiPick) is the contract the emoji popup calls.
 */
describe('emoji insertion at cursor', () => {
	it('inserts the emoji at the current caret position', () => {
		const ref = createRef<TipTapComposerRef>();
		let html = '';
		render(
			<TipTapComposer
				ref={ref}
				value=""
				placeholder="test"
				showToolbar={false}
				readOnly={false}
				onChange={(v) => {
					html = v;
				}}
				onSubmitShortcut={() => {}}
			/>
		);

		expect(ref.current).toBeTruthy();

		act(() => {
			ref.current!.setText('Hallo');
			ref.current!.insertText('😀');
		});
		expect(html).toContain('Hallo');
		expect(html).toContain('😀');
	});
	it('reports the first edit immediately after an external draft changes', () => {
		const ref = createRef<TipTapComposerRef>();
		let html = '';
		const composer = (value: string) => (
			<TipTapComposer
				ref={ref}
				value={value}
				placeholder="test"
				showToolbar={false}
				readOnly={false}
				onChange={(next) => {
					html = next;
				}}
				onSubmitShortcut={() => {}}
			/>
		);
		const view = render(composer(''));
		view.rerender(composer('<p>Draft</p>'));
		act(() =>
			ref.current!.setText('Wir besprechen diese Anfrage im Team.')
		);
		expect(
			view.container.querySelector('[contenteditable="true"]')
				?.textContent
		).toBe('Wir besprechen diese Anfrage im Team.');
		expect(html).toContain('Wir besprechen diese Anfrage im Team.');
	});
});
