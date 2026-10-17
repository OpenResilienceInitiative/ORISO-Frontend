import * as React from 'react';
import { useCallback } from 'react';

import styles from './viewSwitcher.module.scss';

export interface CallView {
	/** Stable key the stage switches on. */
	readonly key: string;
	/** The word the active entry spells out. */
	readonly label: string;
	/** Inherited from the icon library — never drawn here. */
	readonly icon: React.ReactNode;
}

export interface ViewSwitcherProps {
	readonly views: readonly CallView[];
	readonly active: string;
	readonly onChange: (key: string) => void;
	/** Names the group for a screen reader. */
	readonly label: string;
	/**
	 * Which stage the rail is sitting on.
	 *
	 * The handoff gives two fills — `rgb(251,244,211)` on dark stages,
	 * `#a5000a` with white ink on light ones — and the control has no way to
	 * find out which it is on, so it is told.
	 */
	readonly tone?: 'dark' | 'light';
	readonly className?: string;
}

/**
 * The view switcher, ticket 05.
 *
 * A 44px rail of 36px round buttons. Only the active view spells out its
 * name; the rest stay icon-only, which is the design's answer to a room that
 * offers four views instead of three — the control keeps its size.
 *
 * That choice also does the accessibility work for free. The current view is
 * the only one carrying a word, so it survives greyscale, a colour-blind
 * reader and a bad projector, and nothing here depends on telling
 * `rgb(251,244,211)` from transparent.
 *
 * Semantically it is a radio group rather than three toggle buttons, because
 * it is one choice: the arrows move within it and the whole rail is a single
 * tab stop.
 */
export const ViewSwitcher = ({
	views,
	active,
	onChange,
	label,
	tone = 'dark',
	className
}: ViewSwitcherProps) => {
	const move = useCallback(
		(event: React.KeyboardEvent) => {
			const index = views.findIndex((v) => v.key === active);
			if (index < 0) return;
			const last = views.length - 1;
			let next: number;
			switch (event.key) {
				case 'ArrowRight':
				case 'ArrowDown':
					next = index === last ? 0 : index + 1;
					break;
				case 'ArrowLeft':
				case 'ArrowUp':
					next = index === 0 ? last : index - 1;
					break;
				case 'Home':
					next = 0;
					break;
				case 'End':
					next = last;
					break;
				default:
					return;
			}
			// The arrows own these keys inside a radio group; letting them
			// also scroll the stage would move two things at once.
			event.preventDefault();
			if (next === index) return;
			onChange(views[next].key);
			/*
			 * Focus follows the selection, because with a roving tabindex it
			 * has to. `onChange` only changes which button carries
			 * `tabIndex={0}`; the browser keeps focus where it was, and after
			 * the re-render that button is `tabIndex={-1}`. A keyboard user
			 * pressing an arrow then lost their place in the rail and a screen
			 * reader never announced the new view. Every button exists
			 * already, so the one to move to can be taken off the group.
			 */
			event.currentTarget
				.querySelector<HTMLElement>(`[data-view="${views[next].key}"]`)
				?.focus();
		},
		[views, active, onChange]
	);

	return (
		<div
			className={[styles.rail, className].filter(Boolean).join(' ')}
			data-testid="view-switcher"
			data-tone={tone}
			role="radiogroup"
			aria-label={label}
			onKeyDown={move}
		>
			{views.map((view) => {
				const current = view.key === active;
				return (
					<button
						key={view.key}
						type="button"
						role="radio"
						aria-checked={current}
						aria-label={view.label}
						data-view={view.key}
						// Roving tabindex: the group is one tab stop and the
						// arrows move inside it.
						tabIndex={current ? 0 : -1}
						className={styles.view}
						// Picking the view that is already current would
						// re-render the whole stage for nothing.
						onClick={() => {
							if (!current) onChange(view.key);
						}}
					>
						<span className={styles.icon} aria-hidden="true">
							{view.icon}
						</span>
						{current && (
							<span className={styles.label} aria-hidden="true">
								{view.label}
							</span>
						)}
					</button>
				);
			})}
		</div>
	);
};
