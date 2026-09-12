import { describe, expect, it } from 'vitest';
import {
	buildChannelMenu,
	CHANNEL_MENU_PREVIEW_MAX,
	formatChannelPreview,
	moveMenuFocus,
	resolveMenuShortcut
} from './channelMenuModel';
import type { SecondaryChannel } from './channelSwitcherState';

const at = (hhmm: string) => new Date(`2026-09-05T${hhmm}:00+02:00`).getTime();

const supervision: SecondaryChannel = {
	id: 'supervision',
	kind: 'supervision',
	label: 'Bettina B.',
	unread: 2,
	lastMessage: {
		author: 'Elena P.',
		text: 'ich kann nicht sagen das dies bisher passiert ist',
		ts: at('09:20')
	}
};
// "older"/"newer" = the root message, i.e. when the thread was started.
const olderThread: SecondaryChannel = {
	id: '$thread-old',
	kind: 'thread',
	label: 'Briefe',
	createdTs: at('09:00'),
	lastMessage: {
		author: 'baer-mika-343',
		text: 'wissen sie das fällt mir tatsächlich sehr schwer',
		ts: at('09:25')
	}
};
const newerThread: SecondaryChannel = {
	id: '$thread-new',
	kind: 'thread',
	label: 'Vertrag',
	unread: 1,
	createdTs: at('09:10'),
	lastMessage: {
		author: 'Susanne P.',
		text: 'das ist ein sehr gutes Argument',
		ts: at('09:40')
	}
};
const silentThread: SecondaryChannel = {
	id: '$thread-silent',
	kind: 'thread',
	label: 'Ohne Nachricht'
};

describe('buildChannelMenu (T20: "Ableitende Gespräche" card)', () => {
	it('puts the supervision chat first, then the threads by most recent message', () => {
		const rows = buildChannelMenu(
			[olderThread, supervision, newerThread],
			'$thread-old'
		);
		expect(rows.map((row) => row.id)).toEqual([
			'supervision',
			'$thread-new',
			'$thread-old'
		]);
	});

	// Review v6: "Thread #1" must stay "Thread #1" when another thread gets
	// a reply — the number follows the root message, only the ORDER follows
	// the latest message.
	it('numbers the threads by their root message (creation order) and maps ⇧S / ⇧1 / ⇧2 …', () => {
		const rows = buildChannelMenu([olderThread, supervision, newerThread]);
		expect(rows.map((row) => row.id)).toEqual([
			'supervision',
			'$thread-new',
			'$thread-old'
		]);
		expect(rows.map((row) => row.threadNumber)).toEqual([null, 2, 1]);
		expect(rows.map((row) => row.shortcut)).toEqual(['⇧S', '⇧2', '⇧1']);
	});

	it("keeps a thread's number when a fresh reply moves it to the top", () => {
		const replied = {
			...olderThread,
			lastMessage: { author: 'A', text: 'neu', ts: at('10:00') }
		};
		const rows = buildChannelMenu([replied, supervision, newerThread]);
		expect(rows.map((row) => row.id)).toEqual([
			'supervision',
			'$thread-old',
			'$thread-new'
		]);
		expect(rows.map((row) => row.threadNumber)).toEqual([null, 1, 2]);
	});

	it('falls back to the given order for the numbers when threads carry no createdTs', () => {
		const a = { ...olderThread, createdTs: undefined };
		const b = { ...newerThread, createdTs: undefined };
		const rows = buildChannelMenu([b, a]);
		expect(rows.map((row) => row.id)).toEqual([
			'$thread-new',
			'$thread-old'
		]);
		expect(rows.map((row) => row.threadNumber)).toEqual([1, 2]);
	});

	it('keeps threads without a message at the end, in the given order', () => {
		const rows = buildChannelMenu([silentThread, olderThread, newerThread]);
		expect(rows.map((row) => row.id)).toEqual([
			'$thread-new',
			'$thread-old',
			'$thread-silent'
		]);
		expect(rows[2].preview).toBeNull();
	});

	it('marks the shown channel, keeps the unread count and builds the preview', () => {
		const rows = buildChannelMenu(
			[supervision, newerThread],
			'$thread-new'
		);
		expect(rows[0]).toMatchObject({
			id: 'supervision',
			active: false,
			unread: 2,
			preview: {
				author: 'Elena P.',
				text: 'ich kann nicht sagen das dies bisher passiert ist'
			}
		});
		expect(rows[1].active).toBe(true);
	});

	it('gives no shortcut to a tenth thread (only ⇧1–⇧9 exist)', () => {
		const threads = Array.from({ length: 10 }, (_, index) => ({
			id: `$t${index}`,
			kind: 'thread' as const,
			label: `T${index}`,
			lastMessage: { author: 'A', text: 'x', ts: 1000 - index }
		}));
		const rows = buildChannelMenu(threads);
		expect(rows[8].shortcut).toBe('⇧9');
		expect(rows[9].shortcut).toBe('');
	});
});

describe('formatChannelPreview (one line "Autor: Text…")', () => {
	it('collapses whitespace and returns author and text separately', () => {
		expect(
			formatChannelPreview({
				author: ' Elena P. ',
				text: 'ich  kann\nnicht sagen ',
				ts: 1
			})
		).toEqual({ author: 'Elena P.', text: 'ich kann nicht sagen' });
	});

	it('truncates the text with an ellipsis at the preview maximum', () => {
		const long = 'a'.repeat(CHANNEL_MENU_PREVIEW_MAX + 20);
		const preview = formatChannelPreview({
			author: 'A',
			text: long,
			ts: 1
		});
		expect(preview?.text.length).toBe(CHANNEL_MENU_PREVIEW_MAX);
		expect(preview?.text.endsWith('…')).toBe(true);
	});

	it('returns null without a message', () => {
		expect(formatChannelPreview(undefined)).toBeNull();
		expect(formatChannelPreview({ author: '', text: '  ', ts: 1 })).toBe(
			null
		);
	});
});

describe('resolveMenuShortcut (⇧S, ⇧1 … from a keydown)', () => {
	const rows = buildChannelMenu([olderThread, supervision, newerThread]);

	it('resolves shift + S to the supervision chat', () => {
		expect(
			resolveMenuShortcut(
				{ key: 'S', code: 'KeyS', shiftKey: true },
				rows
			)?.id
		).toBe('supervision');
	});

	it('resolves shift + digit by the physical key even when the layout yields a symbol', () => {
		expect(
			resolveMenuShortcut(
				{ key: '!', code: 'Digit1', shiftKey: true },
				rows
			)?.id
		).toBe('$thread-old');
		expect(
			resolveMenuShortcut(
				{ key: '"', code: 'Digit2', shiftKey: true },
				rows
			)?.id
		).toBe('$thread-new');
	});

	it('ignores keys without shift, unknown digits and modifier combinations', () => {
		expect(
			resolveMenuShortcut(
				{ key: 's', code: 'KeyS', shiftKey: false },
				rows
			)
		).toBeNull();
		expect(
			resolveMenuShortcut(
				{ key: '9', code: 'Digit9', shiftKey: true },
				rows
			)
		).toBeNull();
		expect(
			resolveMenuShortcut(
				{ key: 'S', code: 'KeyS', shiftKey: true, ctrlKey: true },
				rows
			)
		).toBeNull();
	});
});

describe('moveMenuFocus (arrow keys, Home, End)', () => {
	it('steps down and up with wrap-around', () => {
		expect(moveMenuFocus(0, 'ArrowDown', 3)).toBe(1);
		expect(moveMenuFocus(2, 'ArrowDown', 3)).toBe(0);
		expect(moveMenuFocus(0, 'ArrowUp', 3)).toBe(2);
	});

	it('jumps to the ends with Home and End', () => {
		expect(moveMenuFocus(1, 'Home', 3)).toBe(0);
		expect(moveMenuFocus(1, 'End', 3)).toBe(2);
	});

	it('returns the current index for other keys and clamps into range', () => {
		expect(moveMenuFocus(1, 'Tab', 3)).toBe(1);
		expect(moveMenuFocus(-1, 'ArrowDown', 3)).toBe(0);
		expect(moveMenuFocus(5, 'ArrowUp', 3)).toBe(1);
	});
});
