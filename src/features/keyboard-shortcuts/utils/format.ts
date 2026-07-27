import type { Platform, ShortcutBinding } from '../types';
import { normalizeBinding } from './binding';

export type FormatShortcutOptions = {
	/** Prefer ⌘ over Cmd for macOS (default true for compact UI). */
	symbolic?: boolean;
	/** Optional localized modifier / key labels from i18n. */
	labels?: Partial<{
		ctrl: string;
		cmd: string;
		alt: string;
		option: string;
		shift: string;
		enter: string;
		escape: string;
		arrowUp: string;
	}>;
};

/**
 * Build a display label from a structured binding. Never store this string
 * as the canonical preference value.
 */
export const formatShortcut = (
	binding: ShortcutBinding | null | undefined,
	platform: Platform,
	options: FormatShortcutOptions = {}
): string => {
	if (!binding || !binding.key) {
		return '';
	}

	const symbolic = options.symbolic !== false;
	const labels = options.labels ?? {};
	const n = normalizeBinding(binding, platform);
	const parts: string[] = [];

	if (n.ctrl) {
		parts.push(labels.ctrl ?? 'Ctrl');
	}
	if (n.meta) {
		parts.push(
			symbolic && platform === 'mac' ? '⌘' : (labels.cmd ?? 'Cmd')
		);
	}
	if (n.alt) {
		parts.push(
			platform === 'mac'
				? (labels.option ?? 'Option')
				: (labels.alt ?? 'Alt')
		);
	}
	if (n.shift) {
		parts.push(symbolic ? '⇧' : (labels.shift ?? 'Shift'));
	}

	const keyLabel =
		n.key === 'Enter'
			? (labels.enter ?? 'Enter')
			: n.key === 'ArrowUp'
				? (labels.arrowUp ?? '↑')
				: n.key === 'Escape'
					? (labels.escape ?? 'Esc')
					: n.key === '/'
						? '/'
						: n.key === '?'
							? '?'
							: n.key.length === 1
								? n.key.toUpperCase()
								: n.key;

	parts.push(keyLabel);
	return parts.join('+');
};
