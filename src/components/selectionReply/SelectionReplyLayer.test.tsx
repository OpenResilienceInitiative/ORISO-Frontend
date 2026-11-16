// @vitest-environment oriso-jsdom
import * as React from 'react';
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen
} from '@testing-library/react';

import { SelectionReplyLayer } from './SelectionReplyLayer';
import type { MessageSelection } from './useMessageSelection';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));

const deferred = <T,>() => {
	let resolve!: (value: T) => void;
	let reject!: (reason?: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
};

const selection = (): MessageSelection => {
	const range = document.createRange();
	range.selectNodeContents(document.body);
	return {
		passage: { eventId: '$1', author: 'Anna', text: 'Freiburg' },
		anchor: {
			top: 10,
			bottom: 30,
			centerX: 200,
			layerWidth: 400,
			visibleTop: 0,
			visibleBottom: 600
		},
		range
	};
};

const renderLayer = (
	recorder: {
		start: () => Promise<void>;
		stop: () => Promise<{ src: string; durationSec: number }>;
		cancel: () => void;
	},
	extra: Partial<React.ComponentProps<typeof SelectionReplyLayer>> = {}
) =>
	render(
		<SelectionReplyLayer
			{...extra}
			authorFor={() => 'Anna'}
			onAddToComposer={() => {}}
			onSendNow={() => {}}
			recorder={recorder}
			initialSelection={selection()}
			initialMode="toolbar"
		>
			<div data-message-id="$1">
				<div className="messageItem__message">
					<p data-testid="body">Ich wohne in Freiburg.</p>
				</div>
			</div>
		</SelectionReplyLayer>
	);

const startVoiceFromToolbar = () =>
	fireEvent.click(
		screen.getAllByLabelText('message.selectionReply.replyVoice')[0]
	);

describe('SelectionReplyLayer voice recording', () => {
	afterEach(cleanup);

	it('a start that finishes after the reply closed is cancelled', async () => {
		const start = deferred<void>();
		const recorder = {
			start: vi.fn(() => start.promise),
			stop: vi.fn(),
			cancel: vi.fn()
		};
		renderLayer(recorder);
		startVoiceFromToolbar();
		fireEvent.click(screen.getByLabelText('message.selectionReply.cancel'));
		await act(async () => start.resolve());
		expect(recorder.cancel).toHaveBeenCalled();
		expect(
			document.querySelector('[data-cy="selection-reply-popover"]')
		).toBeNull();
	});

	it('a second press while the microphone starts does not start it again', async () => {
		const start = deferred<void>();
		const recorder = {
			start: vi.fn(() => start.promise),
			stop: vi.fn(),
			cancel: vi.fn()
		};
		renderLayer(recorder);
		startVoiceFromToolbar();
		startVoiceFromToolbar();
		await act(async () => start.resolve());
		expect(recorder.start).toHaveBeenCalledTimes(1);
		expect(recorder.cancel).not.toHaveBeenCalled();
	});

	it('a start from a closed reply does not cancel the next take', async () => {
		const first = deferred<void>();
		const events: string[] = [];
		const recorder = {
			start: vi.fn(() => {
				events.push('start');
				return recorder.start.mock.calls.length === 1
					? first.promise
					: Promise.resolve();
			}),
			stop: vi.fn(),
			cancel: vi.fn(() => events.push('cancel'))
		};
		renderLayer(recorder);
		startVoiceFromToolbar();
		fireEvent.click(screen.getByLabelText('message.selectionReply.cancel'));
		// Mark the passage again and start a new take.
		const text = screen.getByTestId('body').firstChild!;
		const range = document.createRange();
		range.setStart(text, 0);
		range.setEnd(text, 9);
		window.getSelection()!.removeAllRanges();
		window.getSelection()!.addRange(range);
		vi.useFakeTimers();
		await act(async () => {
			screen
				.getByTestId('body')
				.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
			vi.runAllTimers();
		});
		vi.useRealTimers();
		startVoiceFromToolbar();
		await act(async () => first.resolve());
		await act(async () => {
			await new Promise((done) => setTimeout(done, 0));
		});
		expect(events.lastIndexOf('cancel')).toBeLessThan(
			events.lastIndexOf('start')
		);
		expect(recorder.start).toHaveBeenCalledTimes(2);
		expect(screen.getByLabelText('app.stop')).toBeTruthy();
	});

	it('a microphone that fails to start shows an error, the field stays usable', async () => {
		const start = deferred<void>();
		const recorder = {
			start: vi.fn(() => start.promise),
			stop: vi.fn(),
			cancel: vi.fn()
		};
		renderLayer(recorder);
		startVoiceFromToolbar();
		await act(async () => start.reject(new Error('denied')));
		expect(screen.getByRole('alert').textContent).toContain(
			'voice.recording.error.headline'
		);
		expect(
			(
				screen.getByLabelText(
					'message.selectionReply.inputLabel'
				) as HTMLInputElement
			).disabled
		).toBe(false);
	});

	it('a take that fails to save shows an error and unlocks the field', async () => {
		const stop = deferred<{ src: string; durationSec: number }>();
		const recorder = {
			start: vi.fn(async () => {}),
			stop: vi.fn(() => stop.promise),
			cancel: vi.fn()
		};
		renderLayer(recorder);
		startVoiceFromToolbar();
		await act(async () => {});
		const input = screen.getByLabelText(
			'message.selectionReply.inputLabel'
		) as HTMLInputElement;
		expect(input.disabled).toBe(true);
		fireEvent.click(screen.getByLabelText('app.stop'));
		await act(async () => stop.reject(new Error('broken')));
		expect(screen.getByRole('alert')).toBeTruthy();
		expect(input.disabled).toBe(false);
	});
});

describe('SelectionReplyLayer focus on leaving the answer', () => {
	afterEach(cleanup);

	const idleRecorder = () => ({
		start: vi.fn(async () => {}),
		stop: vi.fn(),
		cancel: vi.fn()
	});
	const openAnswer = () =>
		fireEvent.click(
			screen.getAllByLabelText('message.selectionReply.reply')[0]
		);
	const bubble = () =>
		document.querySelector('[data-message-id="$1"] .messageItem__message');
	const field = () =>
		screen.getByLabelText('message.selectionReply.inputLabel');

	it('Escape in the field returns focus to the marked message', () => {
		renderLayer(idleRecorder());
		openAnswer();
		fireEvent.keyDown(field(), { key: 'Escape' });
		expect(document.activeElement).toBe(bubble());
	});

	it('Cancel returns focus to the marked message', () => {
		renderLayer(idleRecorder());
		openAnswer();
		fireEvent.click(screen.getByLabelText('message.selectionReply.cancel'));
		expect(document.activeElement).toBe(bubble());
	});

	it('a voice reply from the bar keeps focus in the dialog, then on Stop', async () => {
		const start = deferred<void>();
		const recorder = {
			start: vi.fn(() => start.promise),
			stop: vi.fn(),
			cancel: vi.fn()
		};
		renderLayer(recorder);
		startVoiceFromToolbar();
		const dialog = document.querySelector(
			'[data-cy="selection-reply-popover"]'
		)!;
		expect(dialog.contains(document.activeElement)).toBe(true);
		// The text field is not focused: no phone keyboard over the take.
		expect(document.activeElement).not.toBe(field());
		await act(async () => start.resolve());
		expect(document.activeElement).toBe(screen.getByLabelText('app.stop'));
		fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
		expect(
			document.querySelector('[data-cy="selection-reply-popover"]')
		).toBeNull();
	});

	it('focus stays in the dialog after Stop and after Discard', async () => {
		const stop = deferred<{ src: string; durationSec: number }>();
		const recorder = {
			start: vi.fn(async () => {}),
			stop: vi.fn(() => stop.promise),
			cancel: vi.fn()
		};
		renderLayer(recorder);
		startVoiceFromToolbar();
		await act(async () => {});
		const stopButton = screen.getByLabelText('app.stop');
		stopButton.focus();
		fireEvent.click(stopButton);
		await act(async () =>
			stop.resolve({ src: 'blob:take', durationSec: 3 })
		);
		// Like the composer: the take under review takes focus.
		expect(document.activeElement).toBe(
			document.querySelector('.voiceNoteRow[role="group"]')
		);
		const discard = document.querySelector<HTMLButtonElement>(
			'.voiceNoteRow__discard'
		)!;
		discard.focus();
		fireEvent.click(discard);
		expect(document.activeElement).toBe(
			screen.getByLabelText('message.selectionReply.replyVoice')
		);
		fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
		expect(
			document.querySelector('[data-cy="selection-reply-popover"]')
		).toBeNull();
	});

	it('collecting an answer hands focus to the composer', () => {
		const focusComposer = vi.fn();
		renderLayer(idleRecorder(), { focusComposer });
		openAnswer();
		fireEvent.change(field(), { target: { value: 'Danke' } });
		fireEvent.keyDown(field(), { key: 'Enter' });
		expect(focusComposer).toHaveBeenCalledTimes(1);
	});
});

describe('SelectionReplyLayer moderator blur bar on scroll', () => {
	beforeEach(() => {
		// jsdom has no CSS.escape; the ids here need no escaping.
		vi.stubGlobal('CSS', { escape: (value: string) => value });
	});
	afterEach(() => {
		cleanup();
		vi.unstubAllGlobals();
	});

	const renderBlurred = () =>
		render(
			<SelectionReplyLayer
				authorFor={() => 'Anna'}
				onAddToComposer={() => {}}
				onSendNow={() => {}}
				onRemoveBlur={() => {}}
				recorder={{ start: vi.fn(), stop: vi.fn(), cancel: vi.fn() }}
			>
				<div data-message-id="$1">
					<div className="messageItem__message">
						<p>
							Ich heiße{' '}
							<span
								className="passageBlur passageBlur--removable"
								data-passage-blur-id="b1"
								data-testid="blurred"
								role="button"
								tabIndex={0}
							>
								xxxx xxxxxx
							</span>
							.
						</p>
					</div>
				</div>
			</SelectionReplyLayer>
		);
	const blurBar = () =>
		document.querySelector('[data-cy="passage-blur-bar"]');
	const placeBlurred = (top: number) =>
		vi
			.spyOn(screen.getByTestId('blurred'), 'getBoundingClientRect')
			.mockReturnValue(new DOMRect(40, top, 80, 20));

	it('stays open on a scroll that keeps its passage in view', () => {
		renderBlurred();
		placeBlurred(100);
		fireEvent.click(screen.getByTestId('blurred'));
		expect(blurBar()).not.toBeNull();

		placeBlurred(140);
		act(() => {
			document.dispatchEvent(new Event('scroll'));
		});
		expect(blurBar()).not.toBeNull();
	});

	it('Remove blur moves focus to the message, not the page', () => {
		renderBlurred();
		placeBlurred(100);
		fireEvent.click(screen.getByTestId('blurred'));
		const remove = document.querySelector<HTMLButtonElement>(
			'[data-cy="passage-blur-remove"]'
		)!;
		remove.focus();
		fireEvent.click(remove);
		expect(blurBar()).toBeNull();
		expect(document.activeElement).toBe(
			document.querySelector(
				'[data-message-id="$1"] .messageItem__message'
			)
		);
	});

	it('Escape from the bar returns focus to the blurred passage', () => {
		renderBlurred();
		placeBlurred(100);
		fireEvent.click(screen.getByTestId('blurred'));
		const remove = document.querySelector<HTMLButtonElement>(
			'[data-cy="passage-blur-remove"]'
		)!;
		remove.focus();
		fireEvent.keyDown(remove, { key: 'Escape' });
		expect(blurBar()).toBeNull();
		expect(document.activeElement).toBe(screen.getByTestId('blurred'));
	});

	it('closes once a scroll moves its passage out of view', () => {
		renderBlurred();
		placeBlurred(100);
		fireEvent.click(screen.getByTestId('blurred'));
		expect(blurBar()).not.toBeNull();

		placeBlurred(window.innerHeight + 200);
		act(() => {
			document.dispatchEvent(new Event('scroll'));
		});
		expect(blurBar()).toBeNull();
	});
});
