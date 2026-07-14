// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { getPlatform, getPrimaryModifier } from './platform';
import { normalizeBinding } from './binding';
import { matchesShortcut, type MatchableKeyboardEvent } from './match';
import { formatShortcut } from './format';
import { deriveNewlineBinding } from './deriveNewline';
import { resolveComposerShortcutAction } from './resolveComposerShortcut';
import { resolveMatchedAction } from './resolveAction';
import { validateShortcutPreferences } from './conflicts';
import { isCategoryExpanded, toggleExclusiveAccordion } from './accordion';
import { dispatchComposerAction } from '../hooks/useChatComposerShortcuts';
import {
	SEND_BINDING_ALT_ENTER,
	SEND_BINDING_ENTER,
	SEND_BINDING_PRIMARY_ENTER
} from '../constants/sendOptions';
import type { KeyboardShortcutPreferencesV1, Platform } from '../types';

const evt = (
	partial: Partial<MatchableKeyboardEvent> & { key: string }
): MatchableKeyboardEvent => ({
	ctrlKey: false,
	metaKey: false,
	shiftKey: false,
	altKey: false,
	isComposing: false,
	defaultPrevented: false,
	...partial
});

describe('platform', () => {
	it('detects macOS', () => {
		expect(getPlatform('Mozilla/5.0 (Macintosh)', 'MacIntel')).toBe('mac');
		expect(getPrimaryModifier('mac')).toBe('meta');
	});

	it('detects Windows and Linux', () => {
		expect(getPlatform('Windows NT 10.0', 'Win32')).toBe('windows');
		expect(getPlatform('X11; Linux x86_64', 'Linux x86_64')).toBe('linux');
		expect(getPrimaryModifier('windows')).toBe('ctrl');
		expect(getPrimaryModifier('linux')).toBe('ctrl');
	});
});

describe('normalizeBinding / formatShortcut', () => {
	it('expands primary modifier per platform', () => {
		expect(normalizeBinding(SEND_BINDING_PRIMARY_ENTER, 'mac').meta).toBe(
			true
		);
		expect(
			normalizeBinding(SEND_BINDING_PRIMARY_ENTER, 'windows').ctrl
		).toBe(true);
	});

	it('formats Cmd on mac and Ctrl on Windows', () => {
		expect(formatShortcut(SEND_BINDING_PRIMARY_ENTER, 'mac')).toContain(
			'⌘'
		);
		expect(formatShortcut(SEND_BINDING_PRIMARY_ENTER, 'windows')).toBe(
			'Ctrl+Enter'
		);
	});
});

describe('matchesShortcut', () => {
	const cases: Array<{
		name: string;
		platform: Platform;
		binding: typeof SEND_BINDING_PRIMARY_ENTER;
		event: MatchableKeyboardEvent;
		expected: boolean;
	}> = [
		{
			name: 'Windows Ctrl+Enter',
			platform: 'windows',
			binding: SEND_BINDING_PRIMARY_ENTER,
			event: evt({ key: 'Enter', ctrlKey: true }),
			expected: true
		},
		{
			name: 'Linux Ctrl+Enter',
			platform: 'linux',
			binding: SEND_BINDING_PRIMARY_ENTER,
			event: evt({ key: 'Enter', ctrlKey: true }),
			expected: true
		},
		{
			name: 'macOS Cmd+Enter',
			platform: 'mac',
			binding: SEND_BINDING_PRIMARY_ENTER,
			event: evt({ key: 'Enter', metaKey: true }),
			expected: true
		},
		{
			name: 'plain Enter',
			platform: 'windows',
			binding: SEND_BINDING_ENTER,
			event: evt({ key: 'Enter' }),
			expected: true
		},
		{
			name: 'Shift+Enter for shift binding',
			platform: 'windows',
			binding: { key: 'Enter', shift: true },
			event: evt({ key: 'Enter', shiftKey: true }),
			expected: true
		},
		{
			name: 'Alt+Enter',
			platform: 'windows',
			binding: SEND_BINDING_ALT_ENTER,
			event: evt({ key: 'Enter', altKey: true }),
			expected: true
		},
		{
			name: 'wrong key',
			platform: 'windows',
			binding: SEND_BINDING_ENTER,
			event: evt({ key: 'a' }),
			expected: false
		},
		{
			name: 'extra modifier',
			platform: 'windows',
			binding: SEND_BINDING_ENTER,
			event: evt({ key: 'Enter', ctrlKey: true }),
			expected: false
		},
		{
			name: 'missing modifier',
			platform: 'mac',
			binding: SEND_BINDING_PRIMARY_ENTER,
			event: evt({ key: 'Enter' }),
			expected: false
		},
		{
			name: 'isComposing blocks',
			platform: 'windows',
			binding: SEND_BINDING_ENTER,
			event: evt({ key: 'Enter', isComposing: true }),
			expected: false
		},
		{
			name: 'defaultPrevented blocks',
			platform: 'windows',
			binding: SEND_BINDING_ENTER,
			event: evt({ key: 'Enter', defaultPrevented: true }),
			expected: false
		},
		{
			name: 'case normalization for letter keys',
			platform: 'windows',
			binding: { key: 'a', primaryModifier: true },
			event: evt({ key: 'A', ctrlKey: true }),
			expected: true
		}
	];

	it.each(cases)('$name', ({ platform, binding, event, expected }) => {
		expect(matchesShortcut(event, binding, platform)).toBe(expected);
	});

	it('treats null binding as non-match (disabled)', () => {
		expect(matchesShortcut(evt({ key: 'Enter' }), null, 'windows')).toBe(
			false
		);
	});
});

describe('deriveNewlineBinding', () => {
	it('uses Shift+Enter when Enter sends', () => {
		expect(deriveNewlineBinding(SEND_BINDING_ENTER, 'mac')).toEqual({
			key: 'Enter',
			shift: true
		});
	});

	it('uses Enter when primary, alt, or shift sends', () => {
		expect(deriveNewlineBinding(SEND_BINDING_PRIMARY_ENTER, 'mac')).toEqual(
			{
				key: 'Enter'
			}
		);
		expect(deriveNewlineBinding(SEND_BINDING_ALT_ENTER, 'windows')).toEqual(
			{
				key: 'Enter'
			}
		);
		expect(
			deriveNewlineBinding({ key: 'Enter', shift: true }, 'linux')
		).toEqual({ key: 'Enter' });
	});
});

describe('resolveComposerShortcutAction', () => {
	const prefs = (
		send: typeof SEND_BINDING_PRIMARY_ENTER
	): KeyboardShortcutPreferencesV1 => ({
		version: 1,
		bindings: {
			'chat.sendMessage': send,
			'chat.insertNewLine': deriveNewlineBinding(send, 'windows')
		}
	});

	it('primary mode: Enter newline, Ctrl+Enter send on Windows', () => {
		const p = prefs(SEND_BINDING_PRIMARY_ENTER);
		expect(
			resolveComposerShortcutAction(evt({ key: 'Enter' }), p, 'windows')
		).toBe('newline');
		expect(
			resolveComposerShortcutAction(
				evt({ key: 'Enter', ctrlKey: true }),
				p,
				'windows'
			)
		).toBe('send');
		expect(
			resolveComposerShortcutAction(
				evt({ key: 'Enter', metaKey: true }),
				p,
				'mac'
			)
		).toBe('send');
	});

	it('enter-to-send mode', () => {
		const p = prefs(SEND_BINDING_ENTER);
		expect(
			resolveComposerShortcutAction(evt({ key: 'Enter' }), p, 'mac')
		).toBe('send');
		expect(
			resolveComposerShortcutAction(
				evt({ key: 'Enter', shiftKey: true }),
				p,
				'mac'
			)
		).toBe('newline');
		expect(
			resolveComposerShortcutAction(
				evt({ key: 'Enter', ctrlKey: true }),
				p,
				'windows'
			)
		).toBeNull();
	});

	it('alt-enter mode', () => {
		const p = prefs(SEND_BINDING_ALT_ENTER);
		expect(
			resolveComposerShortcutAction(
				evt({ key: 'Enter', altKey: true }),
				p,
				'linux'
			)
		).toBe('send');
		expect(
			resolveComposerShortcutAction(evt({ key: 'Enter' }), p, 'linux')
		).toBe('newline');
	});

	it('ignores disabled, sending, suggestions, IME', () => {
		const p = prefs(SEND_BINDING_ENTER);
		expect(
			resolveComposerShortcutAction(evt({ key: 'Enter' }), p, 'mac', {
				disabled: true
			})
		).toBeNull();
		expect(
			resolveComposerShortcutAction(evt({ key: 'Enter' }), p, 'mac', {
				isSending: true
			})
		).toBeNull();
		expect(
			resolveComposerShortcutAction(evt({ key: 'Enter' }), p, 'mac', {
				hasOpenSuggestions: true
			})
		).toBeNull();
		expect(
			resolveComposerShortcutAction(
				evt({ key: 'Enter', isComposing: true }),
				p,
				'mac'
			)
		).toBeNull();
	});
});

describe('validateShortcutPreferences', () => {
	it('flags send/newline conflict when forced equal', () => {
		const conflicts = validateShortcutPreferences(
			{
				version: 1,
				bindings: {
					'chat.sendMessage': SEND_BINDING_ENTER,
					'chat.insertNewLine': SEND_BINDING_ENTER
				}
			},
			'windows'
		);
		// derive forces Shift+Enter so defaults should not conflict
		expect(conflicts.some((c) => c.type === 'send-newline')).toBe(false);
	});

	it('flags reserved shortcuts', () => {
		const conflicts = validateShortcutPreferences(
			{
				version: 1,
				bindings: {
					'chat.sendMessage': { key: 'W', primaryModifier: true }
				}
			},
			'mac'
		);
		expect(
			conflicts.some(
				(c) => c.type === 'reserved' || c.type === 'unsupported'
			)
		).toBe(true);
	});

	it('allows default preferences including Alt+Enter send', () => {
		const conflicts = validateShortcutPreferences(
			{
				version: 1,
				bindings: {
					'chat.sendMessage': SEND_BINDING_ALT_ENTER,
					'app.showShortcutHelp': {
						key: '/',
						primaryModifier: true
					}
				}
			},
			'mac'
		);
		expect(conflicts.filter((c) => c.type === 'send-newline')).toHaveLength(
			0
		);
		expect(conflicts.filter((c) => c.type === 'reserved')).toHaveLength(0);
	});
});

describe('accordion helpers', () => {
	it('toggles exclusive accordion', () => {
		expect(toggleExclusiveAccordion('messaging', 'attachments')).toBe(
			'attachments'
		);
		expect(toggleExclusiveAccordion('messaging', 'messaging')).toBeNull();
		expect(isCategoryExpanded('messaging', 'messaging')).toBe(true);
		expect(isCategoryExpanded(null, 'messaging')).toBe(false);
	});
});

describe('resolveMatchedAction', () => {
	it('matches palette bindings by scope', () => {
		const preferences: KeyboardShortcutPreferencesV1 = {
			version: 1,
			bindings: {
				'app.openCommandPalette': { key: 'K', primaryModifier: true }
			}
		};
		expect(
			resolveMatchedAction(
				evt({ key: 'k', ctrlKey: true }),
				preferences,
				'windows',
				{ scopes: ['global'], inTextInput: false }
			)
		).toBe('app.openCommandPalette');
	});

	it('matches edit-last ArrowUp in composer scope', () => {
		const preferences: KeyboardShortcutPreferencesV1 = {
			version: 1,
			bindings: {
				'chat.editLastMessage': { key: 'ArrowUp' }
			}
		};
		expect(
			resolveMatchedAction(evt({ key: 'ArrowUp' }), preferences, 'mac', {
				scopes: ['composer'],
				inTextInput: true
			})
		).toBe('chat.editLastMessage');
	});
});

describe('dispatchComposerAction', () => {
	it('guards edit-last when composer is not empty', () => {
		expect(
			dispatchComposerAction('chat.editLastMessage', {
				isComposerEmpty: false,
				onEditLast: () => true
			})
		).toBe(false);
		expect(
			dispatchComposerAction('chat.editLastMessage', {
				isComposerEmpty: true,
				onEditLast: () => true
			})
		).toBe(true);
	});

	it('handles cancel reply/edit', () => {
		expect(
			dispatchComposerAction('chat.cancelReplyOrEdit', {
				onCancel: () => true
			})
		).toBe(true);
		expect(dispatchComposerAction('chat.cancelReplyOrEdit', {})).toBe(
			false
		);
	});
});
