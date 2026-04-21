import * as React from 'react';
import clsx from 'clsx';
import type { SessionToolbarChipFilter } from './SessionsListToolbar';

interface EnquiryFilterChipsProps {
	translate: (key: string, defaultValue?: any) => any;
	activeChip: SessionToolbarChipFilter | null;
	onChipToggle: (chip: SessionToolbarChipFilter) => void;
	/** Live-Chat chip is rendered only while the sidebar toggle is ON. */
	showLiveChatChip: boolean;
}

/**
 * Compact filter-chip row for the consultant enquiry tab.
 * Two chips: "Chats" (registered enquiries) and "Live Chat" (anonymous
 * enquiries, shown only when the sidebar live-chat availability toggle is
 * active). Clicking a chip toggles it; clicking the active one again clears
 * the filter so the full list returns.
 */
export const EnquiryFilterChips: React.FC<EnquiryFilterChipsProps> = ({
	translate,
	activeChip,
	onChipToggle,
	showLiveChatChip
}) => {
	const chipClass = (chip: SessionToolbarChipFilter) =>
		clsx(
			'sessionsListToolbar__chip',
			'sessionsListToolbar__chip--text',
			activeChip === chip && 'sessionsListToolbar__chip--active'
		);

	return (
		<div className="sessionsListToolbar sessionsListToolbar--enquiry">
			<div className="sessionsListToolbar__chipRow sessionsListToolbar__chipRow--enquiry">
				<button
					type="button"
					className={chipClass('chats')}
					onClick={() => onChipToggle('chats')}
					aria-pressed={activeChip === 'chats'}
					data-cy="enquiry-list-chip-chats"
				>
					<span className="sessionsListToolbar__chipLabel">
						{translate('sessionList.toolbar.chips.chats', 'Chats')}
					</span>
				</button>
				{showLiveChatChip && (
					<button
						type="button"
						className={chipClass('liveChat')}
						onClick={() => onChipToggle('liveChat')}
						aria-pressed={activeChip === 'liveChat'}
						data-cy="enquiry-list-chip-live-chat"
					>
						<span className="sessionsListToolbar__chipLabel">
							{translate(
								'sessionList.toolbar.chips.liveChat',
								'Live Chat'
							)}
						</span>
					</button>
				)}
			</div>
		</div>
	);
};
