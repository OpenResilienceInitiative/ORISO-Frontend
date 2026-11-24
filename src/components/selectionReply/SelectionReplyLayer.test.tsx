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
		pause?: () => void;
		resume?: () => void;
		cancel: () => void;
	},
	extra: Partial<React.ComponentProps<typeof SelectionReplyLayer>> = {}
) =>
	render(
		<SelectionReplyLayer
			authorFor={() => 'Anna'}
			onAddToComposer={() => {}}
			onSendNow={() => {}}
			recorder={recorder}
			initialSelection={selection()}
			initialMode="toolbar"
			{...extra}
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
		// FE#2494 (Frank, 24 Nov): the take plays in its own second row; the
		// text field stays, so text can go with the voice note.
		expect(
			screen.getByLabelText('message.selectionReply.inputLabel')
		).toHaveProperty(
			'placeholder',
			'message.selectionReply.placeholderWithVoice'
		);
		fireEvent.click(screen.getByLabelText('app.stop'));
		await act(async () => stop.reject(new Error('broken')));
		expect(screen.getByRole('alert')).toBeTruthy();
		const input = screen.getByLabelText(
			'message.selectionReply.inputLabel'
		) as HTMLTextAreaElement;
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

describe('SelectionReplyLayer selection bar on scroll', () => {
	let passageTop = 100;
	beforeEach(() => {
		passageTop = 100;
		vi.spyOn(Range.prototype, 'getBoundingClientRect').mockImplementation(
			() => new DOMRect(40, passageTop, 80, 20)
		);
		vi.spyOn(Range.prototype, 'getClientRects').mockImplementation(
			() => [new DOMRect(40, passageTop, 80, 20)] as any
		);
	});
	afterEach(() => {
		cleanup();
		vi.restoreAllMocks();
		window.getSelection()?.removeAllRanges();
	});

	const markFreiburg = async () => {
		render(
			<SelectionReplyLayer
				authorFor={() => 'Anna'}
				onAddToComposer={() => {}}
				onSendNow={() => {}}
			>
				<div data-message-id="$1">
					<div className="messageItem__message">
						<p data-testid="body">Ich wohne in Freiburg.</p>
					</div>
				</div>
			</SelectionReplyLayer>
		);
		const text = screen.getByTestId('body').firstChild!;
		const range = document.createRange();
		range.setStart(text, 13);
		range.setEnd(text, 21);
		window.getSelection()!.removeAllRanges();
		window.getSelection()!.addRange(range);
		await act(async () => {
			fireEvent.mouseUp(
				document.querySelector('[data-cy="selection-reply-layer"]')!
			);
			// The layer reads the selection once the browser settled it.
			await new Promise((resolve) => setTimeout(resolve, 0));
		});
	};
	const bar = () =>
		document.querySelector('[data-cy="selection-reply-toolbar"]');

	it('stays open when the chat scrolls by itself and the passage stays in view', async () => {
		await markFreiburg();
		expect(bar()).not.toBeNull();

		passageTop = 140;
		act(() => {
			document.dispatchEvent(new Event('scroll'));
		});

		expect(bar()).not.toBeNull();
	});

	it('closes once a scroll moves the passage out of view', async () => {
		await markFreiburg();
		expect(bar()).not.toBeNull();

		passageTop = window.innerHeight + 200;
		act(() => {
			document.dispatchEvent(new Event('scroll'));
		});

		expect(bar()).toBeNull();
	});
});

describe('SelectionReplyLayer voice: stack and send stop the take (FE#2494)', () => {
	afterEach(cleanup);

	it('Stack while recording stops the take first and stacks it', async () => {
		const take = { src: 'blob:take', durationSec: 3 };
		const recorder = {
			start: vi.fn(async () => {}),
			stop: vi.fn(async () => take),
			pause: vi.fn(),
			resume: vi.fn(),
			cancel: vi.fn()
		};
		const onAddToComposer = vi.fn();
		renderLayer(recorder, { onAddToComposer });
		startVoiceFromToolbar();
		await act(async () => {});
		// Pause, not Stop: the same button pauses and records on.
		fireEvent.click(screen.getByLabelText('voice.recording.pause'));
		expect(recorder.pause).toHaveBeenCalledTimes(1);
		fireEvent.click(screen.getByLabelText('voice.recording.resume'));
		expect(recorder.resume).toHaveBeenCalledTimes(1);
		fireEvent.click(
			screen.getByLabelText('message.selectionReply.addToComposer')
		);
		await act(async () => {});
		expect(recorder.stop).toHaveBeenCalledTimes(1);
		expect(onAddToComposer).toHaveBeenCalledWith(
			expect.objectContaining({ voice: take })
		);
	});
});

describe('SelectionReplyLayer review fixes (#2505)', () => {
	afterEach(cleanup);

	it('a failed stop while sending keeps the typed text and sends nothing', async () => {
		const recorder = {
			start: vi.fn(async () => {}),
			stop: vi.fn(async () => {
				throw new Error('broken');
			}),
			pause: vi.fn(),
			resume: vi.fn(),
			cancel: vi.fn()
		};
		const onSendNow = vi.fn();
		const onAddToComposer = vi.fn();
		renderLayer(recorder, { onSendNow, onAddToComposer });
		startVoiceFromToolbar();
		await act(async () => {});
		const input = screen.getByLabelText(
			'message.selectionReply.inputLabel'
		) as HTMLTextAreaElement;
		fireEvent.change(input, { target: { value: 'Dazu noch:' } });
		fireEvent.click(
			screen.getByLabelText('message.selectionReply.addToComposer')
		);
		await act(async () => {});
		expect(recorder.stop).toHaveBeenCalledTimes(1);
		expect(onAddToComposer).not.toHaveBeenCalled();
		expect(onSendNow).not.toHaveBeenCalled();
		expect(screen.getByRole('alert')).toBeTruthy();
		expect(
			(
				screen.getByLabelText(
					'message.selectionReply.inputLabel'
				) as HTMLTextAreaElement
			).value
		).toBe('Dazu noch:');
	});

	it('without a right to write here, only the side-room entries are offered', () => {
		renderLayer(
			{
				start: vi.fn(async () => {}),
				stop: vi.fn(),
				cancel: vi.fn()
			},
			{
				canReplyHere: false,
				onReplyInSideRoom: {
					supervision: { onCollect: vi.fn(), onSend: vi.fn() }
				}
			}
		);
		expect(
			screen.queryByLabelText('message.selectionReply.reply')
		).toBeNull();
		expect(
			screen.queryByLabelText('message.selectionReply.replyVoice')
		).toBeNull();
		expect(
			screen.getAllByLabelText(
				'message.selectionReply.replyInSupervision'
			).length
		).toBeGreaterThan(0);
	});
});

describe('SelectionReplyLayer keeps a side-chat answer when the side chat closed (FE#2494 review)', () => {
	afterEach(cleanup);

	it('never falls back to this chat', () => {
		const onAddToComposer = vi.fn();
		const onSendNow = vi.fn();
		renderLayer(
			{
				start: async () => {},
				stop: async () => ({ src: 'blob:x', durationSec: 1 }),
				cancel: () => {}
			},
			{
				onAddToComposer,
				onSendNow,
				// Team-Chat closed: its handler is gone, the target stays.
				onReplyInSideRoom: {},
				initialTarget: 'team',
				initialMode: 'popover'
			}
		);
		const field = screen.getByLabelText(
			'message.selectionReply.inputLabel'
		) as HTMLTextAreaElement;
		fireEvent.change(field, { target: { value: 'Nur fürs Team' } });
		fireEvent.click(
			screen.getByLabelText('message.selectionReply.addToComposer')
		);
		fireEvent.keyDown(field, { key: 'Enter', metaKey: true });
		expect(onAddToComposer).not.toHaveBeenCalled();
		expect(onSendNow).not.toHaveBeenCalled();
		expect(
			(
				screen.getByLabelText(
					'message.selectionReply.inputLabel'
				) as HTMLTextAreaElement
			).value
		).toBe('Nur fürs Team');
	});
});

describe('SelectionReplyLayer: side chat closes while the take stops (#2505)', () => {
	afterEach(cleanup);

	it.each(['collect', 'send'] as const)(
		'%s: sends to no room and keeps the text and the finished take',
		async (action) => {
			const stop = deferred<{ src: string; durationSec: number }>();
			const recorder = {
				start: vi.fn(async () => {}),
				stop: vi.fn(() => stop.promise),
				pause: vi.fn(),
				resume: vi.fn(),
				cancel: vi.fn()
			};
			const team = { onCollect: vi.fn(), onSend: vi.fn() };
			const onAddToComposer = vi.fn();
			const onSendNow = vi.fn();
			const props = {
				onAddToComposer,
				onSendNow,
				initialTarget: 'team' as const,
				initialMode: 'popover' as const
			};
			const view = renderLayer(recorder, {
				...props,
				onReplyInSideRoom: { team }
			});
			fireEvent.click(
				screen.getAllByLabelText('message.selectionReply.replyVoice')[0]
			);
			await act(async () => {});
			fireEvent.change(
				screen.getByLabelText('message.selectionReply.inputLabel'),
				{ target: { value: 'Nur fürs Team' } }
			);
			if (action === 'collect') {
				fireEvent.click(
					screen.getByLabelText(
						'message.selectionReply.addToComposer'
					)
				);
			} else {
				fireEvent.keyDown(
					screen.getByLabelText('message.selectionReply.inputLabel'),
					{ key: 'Enter', metaKey: true }
				);
			}
			expect(recorder.stop).toHaveBeenCalledTimes(1);

			// Team-Chat closes while the take is still being finished.
			view.rerender(
				<SelectionReplyLayer
					authorFor={() => 'Anna'}
					recorder={recorder}
					initialSelection={selection()}
					{...props}
					onReplyInSideRoom={{}}
				>
					<div data-message-id="$1">
						<div className="messageItem__message">
							<p data-testid="body">Ich wohne in Freiburg.</p>
						</div>
					</div>
				</SelectionReplyLayer>
			);
			await act(async () =>
				stop.resolve({ src: 'blob:t', durationSec: 2 })
			);

			expect(team.onCollect).not.toHaveBeenCalled();
			expect(team.onSend).not.toHaveBeenCalled();
			expect(onAddToComposer).not.toHaveBeenCalled();
			expect(onSendNow).not.toHaveBeenCalled();
			expect(
				(
					screen.getByLabelText(
						'message.selectionReply.inputLabel'
					) as HTMLTextAreaElement
				).value
			).toBe('Nur fürs Team');
			// The finished take is kept for review, not thrown away.
			expect(recorder.cancel).not.toHaveBeenCalled();
			expect(
				screen.getByLabelText('voice.recording.preview')
			).toBeTruthy();
		}
	);
});

describe('SelectionReplyLayer: one delivery per take (#2505)', () => {
	afterEach(cleanup);

	it('a second Stack while the take stops neither stops twice nor delivers twice', async () => {
		const stop = deferred<{ src: string; durationSec: number }>();
		const recorder = {
			start: vi.fn(async () => {}),
			stop: vi.fn(() => stop.promise),
			pause: vi.fn(),
			resume: vi.fn(),
			cancel: vi.fn()
		};
		const onAddToComposer = vi.fn();
		renderLayer(recorder, { onAddToComposer });
		startVoiceFromToolbar();
		await act(async () => {});
		const stack = screen.getByLabelText(
			'message.selectionReply.addToComposer'
		);
		fireEvent.click(stack);
		fireEvent.click(stack);
		await act(async () => stop.resolve({ src: 'blob:t', durationSec: 2 }));

		expect(recorder.stop).toHaveBeenCalledTimes(1);
		expect(onAddToComposer).toHaveBeenCalledTimes(1);
	});
});
