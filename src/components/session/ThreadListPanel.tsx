import * as React from 'react';
import { useRef } from 'react';
import type { ThreadSummary } from '../../utils/threadSummaries';
import { ResizableHandle } from '../sessionsList/ResizableHandle';

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
 *
 * The entries live in their own scroll container so the drag bar can sit
 * beside them: the bar is positioned against the panel, and anything inside a
 * scrolling box would scroll away with the content it is meant to control
 * (ORISO-Frontend#1196 job 2). The panel is a fixed-width dropdown, so the bar
 * runs in scroll-only mode — there is no width here to drag.
 */
export const ThreadListPanel = ({
	summaries,
	unreadRootIds,
	unknownRootLabel = 'Frühere Nachricht',
	repliesLabel = (count) => `${count} replies`,
	onSelectRoot
}: ThreadListPanelProps) => {
	const scrollRef = useRef<HTMLDivElement | null>(null);

	return (
		<div className="session__threadListPanel">
			<div className="session__threadListScroll" ref={scrollRef} role="menu">
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
			<ResizableHandle
				mode="scroll"
				scrollTargetRef={scrollRef}
				className="sessionsList__resizeHandle--inset"
			/>
		</div>
	);
};
