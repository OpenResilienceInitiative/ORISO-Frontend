import * as React from 'react';
import { chipSpan } from '../chipLayout';

/**
 * Selected-person chips overlaying the card's media area (Figma node
 * 8480-27986, states 2–5). Chips split the row evenly, labels truncate
 * instead of wrapping, an uneven amount gives the last chip the full row,
 * and the grid scrolls vertically inside the media area when it overflows.
 */

export interface PersonChipEntry {
	id: string;
	label: string;
}

interface PersonChipGridProps {
	entries: PersonChipEntry[];
	onRemove: (id: string) => void;
	removeLabel: (label: string) => string;
}

export const PersonChipGrid = ({
	entries,
	onRemove,
	removeLabel
}: PersonChipGridProps) => {
	if (!entries.length) {
		return null;
	}
	return (
		<ul className="personChipGrid" aria-live="polite">
			{entries.map((entry, index) => (
				<li
					key={entry.id}
					className={`personChipGrid__chip personChipGrid__chip--${chipSpan(
						index,
						entries.length
					)}`}
				>
					<span
						className="personChipGrid__label"
						title={entry.label}
					>
						{entry.label}
					</span>
					<button
						type="button"
						className="personChipGrid__remove"
						onClick={() => onRemove(entry.id)}
						aria-label={removeLabel(entry.label)}
					>
						<svg
							width="18"
							height="18"
							viewBox="0 0 24 24"
							fill="none"
							aria-hidden
						>
							<path
								d="M6 6L18 18M18 6L6 18"
								stroke="currentColor"
								strokeWidth="2"
								strokeLinecap="round"
							/>
						</svg>
					</button>
				</li>
			))}
		</ul>
	);
};
