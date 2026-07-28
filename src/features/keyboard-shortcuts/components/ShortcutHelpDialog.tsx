import React, { useEffect, useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useKeyboardShortcuts } from '../context/KeyboardShortcutsProvider';
import { getImplementedShortcuts } from '../constants/registry';
import { formatShortcut } from '../utils/format';
import { resolveEffectiveBinding } from '../utils/resolveAction';
import type { ShortcutCategory } from '../types';
import './ShortcutHelpDialog.styles.scss';

const CATEGORY_ORDER: ShortcutCategory[] = [
	'messaging',
	'attachments',
	'emoji',
	'application'
];

export const ShortcutHelpDialog = () => {
	const { t: translate } = useTranslation();
	const { isHelpOpen, closeHelp, preferences, platform } =
		useKeyboardShortcuts();
	const dialogRef = useRef<HTMLDialogElement>(null);
	const previousFocus = useRef<HTMLElement | null>(null);
	const titleId = useId();
	const keyLabels = {
		ctrl: translate('shortcuts.keys.ctrl'),
		cmd: translate('shortcuts.keys.cmd'),
		alt: translate('shortcuts.keys.alt'),
		option: translate('shortcuts.keys.option'),
		shift: translate('shortcuts.keys.shift'),
		enter: translate('shortcuts.keys.enter'),
		escape: translate('shortcuts.keys.escape'),
		arrowUp: translate('shortcuts.keys.arrowUp')
	};

	useEffect(() => {
		const dialog = dialogRef.current;
		if (!dialog) {
			return;
		}
		if (isHelpOpen) {
			previousFocus.current = document.activeElement as HTMLElement;
			if (!dialog.open) {
				dialog.showModal();
			}
		} else if (dialog.open) {
			dialog.close();
			previousFocus.current?.focus?.();
		}
	}, [isHelpOpen]);

	const grouped = CATEGORY_ORDER.map((category) => ({
		category,
		items: getImplementedShortcuts().filter((d) => d.category === category)
	})).filter((g) => g.items.length > 0);

	return (
		<dialog
			ref={dialogRef}
			className="shortcutHelpDialog"
			aria-labelledby={titleId}
			aria-modal="true"
			onClose={closeHelp}
			onCancel={(event) => {
				event.preventDefault();
				closeHelp();
			}}
		>
			{isHelpOpen && (
				<div className="shortcutHelpDialog__panel">
					<header className="shortcutHelpDialog__header">
						<h2 id={titleId}>
							{translate('shortcuts.help.title')}
						</h2>
						<button
							type="button"
							className="shortcutHelpDialog__close"
							onClick={closeHelp}
							aria-label={translate('shortcuts.help.close')}
						>
							×
						</button>
					</header>
					<div className="shortcutHelpDialog__body">
						{grouped.map(({ category, items }) => (
							<section
								key={category}
								className="shortcutHelpDialog__group"
								aria-labelledby={`shortcut-cat-${category}`}
							>
								<h3 id={`shortcut-cat-${category}`}>
									{translate(
										`shortcuts.categories.${category}`
									)}
								</h3>
								<ul className="shortcutHelpDialog__list">
									{items.map((def) => {
										const binding = resolveEffectiveBinding(
											preferences,
											def.id,
											platform
										);
										if (!binding) {
											return null;
										}
										const label = formatShortcut(
											binding,
											platform,
											{ labels: keyLabels }
										);
										return (
											<li key={def.id}>
												<span>
													{translate(
														def.labelTranslationKey
													)}
												</span>
												<kbd aria-label={label}>
													{label}
												</kbd>
											</li>
										);
									})}
								</ul>
							</section>
						))}
					</div>
				</div>
			)}
		</dialog>
	);
};
