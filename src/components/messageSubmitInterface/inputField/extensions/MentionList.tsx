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

export interface MentionListProps {
	items: MentionCandidate[];
	command: (item: {
		id: string;
		label: string;
		matrixUserId: string | null;
	}) => void;
	notInChatLabel: string;
	directoryState?: MentionDirectoryState;
	emptyLabel?: string;
	unavailableLabel?: string;
	loadingLabel?: string;
}

export interface MentionListRef {
	onKeyDown: (event: KeyboardEvent) => boolean;
}

/**
 * The @-mention suggestion popup. Lists agency consultants; those not in the
 * current chat are visually flagged (they can still be mentioned, which pulls
 * them into the conversation). Keyboard-navigable per TipTap's suggestion API.
 */
export const MentionList = forwardRef<MentionListRef, MentionListProps>(
	(
		{
			items,
			command,
			notInChatLabel,
			directoryState = 'ready',
			emptyLabel,
			unavailableLabel,
			loadingLabel
		},
		ref
	) => {
		const [selectedIndex, setSelectedIndex] = useState(0);

		useEffect(() => setSelectedIndex(0), [items]);

		const selectItem = (index: number) => {
			const item = items[index];
			if (item) {
				command({
					id: item.id,
					label: item.displayName,
					matrixUserId: item.matrixUserId || null
				});
			}
		};

		useImperativeHandle(ref, () => ({
			onKeyDown: (event: KeyboardEvent) => {
				if (event.key === 'ArrowUp') {
					setSelectedIndex(
						(index) => (index + items.length - 1) % items.length
					);
					return true;
				}
				if (event.key === 'ArrowDown') {
					setSelectedIndex((index) => (index + 1) % items.length);
					return true;
				}
				if (event.key === 'Enter') {
					selectItem(selectedIndex);
					return true;
				}
				return false;
			}
		}));

		if (!items.length) {
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
			return (
				<div className="mentionList" role="listbox">
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
			<div className="mentionList" role="listbox">
				{items.map((item, index) => (
					<button
						type="button"
						role="option"
						aria-selected={index === selectedIndex}
						key={item.id}
						className={[
							'mentionList__item',
							index === selectedIndex &&
								'mentionList__item--active',
							!item.isInRoom && 'mentionList__item--notInChat'
						]
							.filter(Boolean)
							.join(' ')}
						onClick={() => selectItem(index)}
					>
						<span className="mentionList__name">
							{item.displayName}
						</span>
						{!item.isInRoom && (
							<span className="mentionList__badge">
								{notInChatLabel}
							</span>
						)}
					</button>
				))}
			</div>
		);
	}
);

MentionList.displayName = 'MentionList';
