// @vitest-environment oriso-jsdom
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { SelectionReplyPopover } from './SelectionReplyPopover';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));

const renderPopover = (draft = 'Danke') => {
	const onAddToComposer = vi.fn();
	const onSendNow = vi.fn();
	const onClose = vi.fn();
	render(
		<SelectionReplyPopover
			passage={{ eventId: '$1', author: 'Anna', text: 'Freiburg' }}
			draft={draft}
			onDraftChange={() => {}}
			voice={{ mode: 'idle' }}
			onStartVoice={() => {}}
			onStopVoice={() => {}}
			onDiscardVoice={() => {}}
			onAddToComposer={onAddToComposer}
			onSendNow={onSendNow}
			onClose={onClose}
		/>
	);
	return { onAddToComposer, onSendNow, onClose };
};

describe('SelectionReplyPopover keyboard', () => {
	afterEach(cleanup);

	it('Enter in the answer field adds the answer, Cmd+Enter sends it', () => {
		const { onAddToComposer, onSendNow } = renderPopover();
		const input = screen.getByLabelText(
			'message.selectionReply.inputLabel'
		);
		fireEvent.keyDown(input, { key: 'Enter' });
		expect(onAddToComposer).toHaveBeenCalledTimes(1);
		fireEvent.keyDown(input, { key: 'Enter', metaKey: true });
		expect(onSendNow).toHaveBeenCalledTimes(1);
	});

	it('Enter on a button keeps the button’s own action', () => {
		const { onAddToComposer, onSendNow } = renderPopover();
		const close = screen.getByLabelText('message.selectionReply.cancel');
		const notPrevented = fireEvent.keyDown(close, { key: 'Enter' });
		expect(notPrevented).toBe(true);
		fireEvent.keyDown(close, { key: 'Enter', metaKey: true });
		expect(onAddToComposer).not.toHaveBeenCalled();
		expect(onSendNow).not.toHaveBeenCalled();
	});

	it('Escape closes from anywhere in the dialog', () => {
		const { onClose } = renderPopover();
		fireEvent.keyDown(
			screen.getByLabelText('message.selectionReply.replyVoice'),
			{ key: 'Escape' }
		);
		expect(onClose).toHaveBeenCalledTimes(1);
	});
});
