import * as React from 'react';
import type { ThreadSummary } from '../../utils/threadSummaries';

export type ThreadListPanelProps = {
	summaries: ThreadSummary[];
	unreadRootIds?: ReadonlySet<string>;
	unknownRootLabel?: string;
	repliesLabel?: (count: number) => string;
	onSelectRoot: (rootId: string) => void;
};

/**
 * Presentational Threads dropdown list (session chrome).
 * Preview text is expected to already be plain via `computeThreadSummaries`.
 */
export const ThreadListPanel = ({
	summaries,
	unreadRootIds,
	unknownRootLabel = 'Frühere Nachricht',
	repliesLabel = (count) => `${count} replies`,
	onSelectRoot
}: ThreadListPanelProps) => (
	<div className="session__threadListPanel" role="menu">
		{summaries.map((summary) => (
			<button
				key={summary.rootId}
				type="button"
				role="menuitem"
				className="session__threadListEntry"
				onClick={() => onSelectRoot(summary.rootId)}
			>
				{unreadRootIds?.has(summary.rootId) && (
					<span
						className="session__threadListUnreadDot"
						aria-hidden
					/>
				)}
				<span className="session__threadListEntryPreview">
					{summary.rootPreview || unknownRootLabel}
				</span>
				<span className="session__threadListEntryMeta">
					{repliesLabel(summary.replyCount)}
				</span>
			</button>
		))}
	</div>
);
