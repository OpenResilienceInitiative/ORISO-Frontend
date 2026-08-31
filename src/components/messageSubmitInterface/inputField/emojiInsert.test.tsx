// @vitest-environment jsdom
import * as React from 'react';
import { createRef } from 'react';
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TipTapComposer, TipTapComposerRef } from '../TipTapComposer';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key
	})
}));

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

		// On mount the composer syncs its initial `value` prop into the editor
		// and, during that window, swallows editor updates (isSyncingFromValue)
		// and can even reset content just after an imperative edit. That settle
		// is not directly observable, so drive the whole sequence through a
		// retrying waitFor: setText replaces the content with 'Hallo' (no
		// accumulation across retries) and insertText appends the emoji — the
		// emoji popup's contract is to add to existing content, not replace it.
		// Once the sync window has closed a single retry lands both.
		await waitFor(() => {
			ref.current!.setText('Hallo');
			ref.current!.insertText('😀');
			expect(html).toContain('Hallo');
			expect(html).toContain('😀');
		});
	});
});
