import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useKeyboardShortcuts } from '../context/KeyboardShortcutsProvider';
import {
	getImplementedShortcuts,
	SETTINGS_CATEGORY_ORDER
} from '../constants/registry';
import { formatShortcut } from '../utils/format';
import { resolveEffectiveBinding } from '../utils/resolveAction';
import type { ShortcutActionId, ShortcutCategory } from '../types';
import './CommandPaletteDialog.styles.scss';

type PaletteCommand = {
	id: ShortcutActionId | 'nav.settingsShortcuts';
	labelKey: string;
	run: () => void;
};

export const CommandPaletteDialog = () => {
	const { t: translate } = useTranslation();
	const navigate = useNavigate();
	const { isPaletteOpen, closePalette, openHelp, preferences, platform } =
		useKeyboardShortcuts();
	const dialogRef = useRef<HTMLDialogElement>(null);
	const previousFocus = useRef<HTMLElement | null>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	const titleId = useId();
	const [query, setQuery] = useState('');
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
		if (isPaletteOpen) {
			previousFocus.current = document.activeElement as HTMLElement;
			setQuery('');
			if (!dialog.open) {
				dialog.showModal();
			}
			requestAnimationFrame(() => inputRef.current?.focus());
		} else if (dialog.open) {
			dialog.close();
			previousFocus.current?.focus?.();
		}
	}, [isPaletteOpen]);

	const commands = useMemo<PaletteCommand[]>(() => {
		const runAndClose = (fn: () => void) => () => {
			closePalette();
			fn();
		};
		return [
			{
				id: 'app.showShortcutHelp',
				labelKey: 'shortcuts.actions.showShortcutHelp.label',
				run: runAndClose(() => openHelp())
			},
			{
				id: 'chat.openEmojiPicker',
				labelKey: 'shortcuts.actions.openEmojiPicker.label',
				run: runAndClose(() => {
					window.dispatchEvent(
						new CustomEvent('oriso:shortcut:openEmoji')
					);
				})
			},
			{
				id: 'chat.uploadFile',
				labelKey: 'shortcuts.actions.uploadFile.label',
				run: runAndClose(() => {
					window.dispatchEvent(
						new CustomEvent('oriso:shortcut:uploadFile')
					);
				})
			},
			{
				id: 'nav.settingsShortcuts',
				labelKey: 'shortcuts.title',
				run: runAndClose(() => navigate('/profile/tastatur'))
			}
		];
	}, [closePalette, navigate, openHelp]);

	const filtered = useMemo(() => {
		const q = query.trim().toLowerCase();
		if (!q) {
			return commands;
		}
		return commands.filter((cmd) =>
			translate(cmd.labelKey).toLowerCase().includes(q)
		);
	}, [commands, query, translate]);

	const shortcutLabel = (actionId: ShortcutActionId | string) => {
		if (!actionId.startsWith('chat.') && !actionId.startsWith('app.')) {
			return null;
		}
		const binding = resolveEffectiveBinding(
			preferences,
			actionId as ShortcutActionId,
			platform
		);
		return binding
			? formatShortcut(binding, platform, { labels: keyLabels })
			: null;
	};

	const implementedByCategory = SETTINGS_CATEGORY_ORDER.map((category) => ({
		category: category as ShortcutCategory,
		items: getImplementedShortcuts().filter((d) => d.category === category)
	})).filter((g) => g.items.length > 0);

	return (
		<dialog
			ref={dialogRef}
			className="commandPaletteDialog"
			aria-labelledby={titleId}
			aria-modal="true"
			onClose={closePalette}
			onCancel={(event) => {
				event.preventDefault();
				closePalette();
			}}
		>
			{isPaletteOpen && (
				<div className="commandPaletteDialog__panel">
					<header className="commandPaletteDialog__header">
						<h2 id={titleId}>
							{translate('shortcuts.palette.title')}
						</h2>
						<button
							type="button"
							className="commandPaletteDialog__close"
							onClick={closePalette}
							aria-label={translate('shortcuts.palette.close')}
						>
							×
						</button>
					</header>
					<input
						ref={inputRef}
						className="commandPaletteDialog__search"
						type="search"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder={translate(
							'shortcuts.palette.searchPlaceholder'
						)}
						aria-label={translate(
							'shortcuts.palette.searchPlaceholder'
						)}
					/>
					<div className="commandPaletteDialog__scroll">
						<ul
							className="commandPaletteDialog__list"
							role="listbox"
						>
							{filtered.map((cmd) => {
								const keys = shortcutLabel(cmd.id);
								return (
									<li key={cmd.id}>
										<button
											type="button"
											className="commandPaletteDialog__item"
											onClick={cmd.run}
										>
											<span>
												{translate(cmd.labelKey)}
											</span>
											{keys && <kbd>{keys}</kbd>}
										</button>
									</li>
								);
							})}
						</ul>
						<details className="commandPaletteDialog__bindings">
							<summary>
								{translate('shortcuts.palette.allShortcuts')}
							</summary>
							{implementedByCategory.map(
								({ category, items }) => (
									<section key={category}>
										<h3>
											{translate(
												`shortcuts.categories.${category}`
											)}
										</h3>
										<ul>
											{items.map((def) => {
												const binding =
													resolveEffectiveBinding(
														preferences,
														def.id,
														platform
													);
												if (!binding) {
													return null;
												}
												return (
													<li key={def.id}>
														<span>
															{translate(
																def.labelTranslationKey
															)}
														</span>
														<kbd>
															{formatShortcut(
																binding,
																platform,
																{
																	labels: keyLabels
																}
															)}
														</kbd>
													</li>
												);
											})}
										</ul>
									</section>
								)
							)}
						</details>
					</div>
				</div>
			)}
		</dialog>
	);
};
