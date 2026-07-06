// @vitest-environment jsdom
import * as React from 'react';
import { createRef } from 'react';
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
	TipTapComposer,
	TipTapComposerRef
} from '../TipTapComposer';

afterEach(() => cleanup());

/**
 * Emojis must land at the caret, not be appended at the end. The composer's
 * insertText (used by handleEmojiPick) is the contract the emoji popup calls.
 */
describe('emoji insertion at cursor', () => {
	it('inserts the emoji at the current caret position', async () => {
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

		await waitFor(() => expect(ref.current).toBeTruthy());

		ref.current!.setText('Hallo');
		ref.current!.focus();

		// The emoji popup drives insertText — the emoji must be added to the
		// existing content, not replace it.
		ref.current!.insertText('😀');

		await waitFor(() => expect(html).toContain('😀'));
		expect(html).toContain('Hallo');
	});
});
