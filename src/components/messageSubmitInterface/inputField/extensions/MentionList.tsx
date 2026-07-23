import * as React from 'react';
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import type { MentionCandidate } from './mentionFiltering';
import './mentionList.styles.scss';

export interface MentionListProps {
	items: MentionCandidate[];
	command: (item: {
		id: string;
		label: string;
		matrixUserId: string | null;
	}) => void;
	notInChatLabel: string;
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
	({ items, command, notInChatLabel }, ref) => {
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
			return null;
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
