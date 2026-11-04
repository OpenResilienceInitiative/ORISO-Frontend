import * as React from 'react';
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import type { MentionCandidate } from './mentionFiltering';
import './mentionList.styles.scss';

/**
 * Why the list is empty (#993). Without this the popup rendered nothing at
 * all, so "nobody matches what you typed" and "the directory never loaded"
 * looked identical — the user just saw the @ do nothing.
 */
export type MentionDirectoryState =
	| 'loading'
	| 'ready'
	| 'error'
	| 'unavailable';

export interface MentionPick {
	id: string;
	label: string;
	matrixUserId: string | null;
}

export interface MentionListProps {
	items: MentionCandidate[];
	command: (item: MentionPick) => void;
	/** Inserts several people at once, in the order they were ticked. */
	commandMany?: (items: MentionPick[]) => void;
	/** A person was ticked or unticked, so the next search can start empty. */
	onCheckedChange?: () => void;
	notInChatLabel: string;
	directoryState?: MentionDirectoryState;
	emptyLabel?: string;
	unavailableLabel?: string;
	loadingLabel?: string;
	listLabel?: string;
	/** Accessible name of a person's tick box. */
	getCheckLabel?: (name: string) => string;
	/** Says how many are ticked and how they get inserted. */
	getCheckedLabel?: (count: number) => string;
}

export interface MentionListRef {
	onKeyDown: (event: KeyboardEvent) => boolean;
	/** Who is ticked right now, for the click beside the list. */
	getChecked: () => MentionPick[];
}

const toPick = (item: MentionCandidate): MentionPick => ({
	id: item.id,
	label: item.displayName,
	matrixUserId: item.matrixUserId || null
});

/**
 * The @-mention suggestion popup. Lists agency consultants; those not in the
 * current chat are visually flagged (they can still be mentioned, which pulls
 * them into the conversation). Keyboard-navigable per TipTap's suggestion API.
 *
 * A name inserts at once. The box beside it collects several people and keeps
 * the list open; a click beside the list inserts them. Ticked people stay on
 * top while the search below them changes.
 */
export const MentionList = forwardRef<MentionListRef, MentionListProps>(
	(
		{
			items,
			command,
			commandMany,
			onCheckedChange,
			notInChatLabel,
			directoryState = 'ready',
			emptyLabel,
			unavailableLabel,
			loadingLabel,
			listLabel,
			getCheckLabel,
			getCheckedLabel
		},
		ref
	) => {
		const [activeIndex, setActiveIndex] = useState(0);
		const [checked, setChecked] = useState<MentionCandidate[]>([]);

		useEffect(() => setActiveIndex(0), [items]);

		const isChecked = (item: MentionCandidate) =>
			checked.some((person) => person.id === item.id);
		const rows = [...checked, ...items.filter((item) => !isChecked(item))];

		const selectItem = (index: number) => {
			const item = rows[index];
			if (!item) {
				return;
			}
			const people = isChecked(item) ? checked : [...checked, item];
			if (people.length > 1 && commandMany) {
				commandMany(people.map(toPick));
			} else {
				command(toPick(item));
			}
		};

		const toggleItem = (index: number) => {
			const item = rows[index];
			if (!item) {
				return;
			}
			setChecked((people) =>
				people.some((person) => person.id === item.id)
					? people.filter((person) => person.id !== item.id)
					: [...people, item]
			);
			setActiveIndex(0);
			onCheckedChange?.();
		};

		useImperativeHandle(ref, () => ({
			onKeyDown: (event: KeyboardEvent) => {
				if (!rows.length) {
					// The list says it is loading: Enter must not send the
					// half-typed name past it.
					return (
						event.key === 'Enter' && directoryState === 'loading'
					);
				}
				if (event.key === 'ArrowUp') {
					setActiveIndex(
						(index) => (index + rows.length - 1) % rows.length
					);
					return true;
				}
				if (event.key === 'ArrowDown') {
					setActiveIndex((index) => (index + 1) % rows.length);
					return true;
				}
				if (event.key === 'Enter') {
					selectItem(activeIndex);
					return true;
				}
				// Not Space: it has to stay able to end a plain "@ " in the text.
				if (event.key === 'Tab') {
					toggleItem(activeIndex);
					return true;
				}
				return false;
			},
			getChecked: () => checked.map(toPick)
		}));

		if (!rows.length) {
			// 'unavailable' is by design (asker, anonymous chat): stay silent.
			if (directoryState === 'unavailable') {
				return null;
			}
			const message =
				directoryState === 'error'
					? unavailableLabel
					: directoryState === 'loading'
						? loadingLabel
						: emptyLabel;
			if (!message) {
				return null;
			}
			// No options to pick yet, so no listbox: only the status line (#1338).
			return (
				<div className="mentionList">
					<p
						className={[
							'mentionList__status',
							directoryState === 'error' &&
								'mentionList__status--error'
						]
							.filter(Boolean)
							.join(' ')}
						role="status"
					>
						{message}
					</p>
				</div>
			);
		}

		return (
			// Keeps the caret in the editor, so typing goes on searching.
			<div
				className="mentionList"
				onMouseDown={(event) => event.preventDefault()}
			>
				{listLabel && (
					<p className="mentionList__title" aria-hidden="true">
						{listLabel}
					</p>
				)}
				<div
					className="mentionList__options"
					role="group"
					aria-label={listLabel}
				>
					{rows.map((item, index) => (
						<div
							key={item.id}
							className={[
								'mentionList__row',
								index === activeIndex &&
									'mentionList__row--active'
							]
								.filter(Boolean)
								.join(' ')}
						>
							<button
								type="button"
								aria-current={
									index === activeIndex || undefined
								}
								className={[
									'mentionList__item',
									!item.isInRoom &&
										'mentionList__item--notInChat'
								]
									.filter(Boolean)
									.join(' ')}
								onClick={() => selectItem(index)}
							>
								<span
									className="mentionList__initial"
									aria-hidden="true"
								>
									{item.displayName
										.trim()
										.charAt(0)
										.toUpperCase()}
								</span>
								<span className="mentionList__name">
									{item.displayName}
								</span>
								{!item.isInRoom && (
									<span className="mentionList__badge">
										{notInChatLabel}
									</span>
								)}
							</button>
							<label className="mentionList__check">
								<input
									type="checkbox"
									checked={isChecked(item)}
									aria-label={
										getCheckLabel?.(item.displayName) ??
										item.displayName
									}
									onChange={() => toggleItem(index)}
								/>
							</label>
						</div>
					))}
				</div>
				{checked.length > 0 && getCheckedLabel && (
					<p className="mentionList__hint" role="status">
						{getCheckedLabel(checked.length)}
					</p>
				)}
			</div>
		);
	}
);

MentionList.displayName = 'MentionList';
