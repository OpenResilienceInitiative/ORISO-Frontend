import * as React from 'react';
import { useTranslation } from 'react-i18next';
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
	unknownRootLabel,
	repliesLabel,
	onSelectRoot
}: ThreadListPanelProps) => {
	const { t } = useTranslation();
	const resolvedUnknown = unknownRootLabel ?? t('message.thread.unknownRoot');
	const resolvedReplies =
		repliesLabel ??
		((count: number) => t('message.thread.replies', { count }));

	return (
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
						{summary.rootPreview || resolvedUnknown}
					</span>
					<span className="session__threadListEntryMeta">
						{resolvedReplies(summary.replyCount)}
					</span>
				</button>
			))}
		</div>
	);
};
