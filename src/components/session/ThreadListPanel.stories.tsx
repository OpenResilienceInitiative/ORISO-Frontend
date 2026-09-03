import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { computeThreadSummaries } from '../../utils/threadSummaries';
import { ThreadListPanel } from './ThreadListPanel';
import './session.styles.scss';

type StoryArgs = {
	messages: Array<{
		_id: string;
		message: string;
		messageTime: string;
		threadRootEventId?: string | null;
	}>;
	unreadRootIds?: string[];
};

const meta: Meta<StoryArgs> = {
	title: 'Components/Chat/ThreadListPanel',
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component:
					'Threads dropdown root previews (#834). Fixtures cover transport markup, HTML, highlights, visibility prefixes, and plain text.'
			}
		}
	},
	decorators: [
		(Story) => (
			<div
				style={{
					padding: 24,
					background: 'var(--m3-surface, #f5f3f4)',
					minHeight: 280,
					position: 'relative'
				}}
			>
				<div className="session__threadListBar">
					<button
						type="button"
						className="session__threadListToggle session__threadListToggle--active"
					>
						Threads
					</button>
					<div style={{ position: 'relative' }}>
						<Story />
					</div>
				</div>
			</div>
		)
	]
};

export default meta;
type Story = StoryObj<StoryArgs>;

const renderPanel = (args: StoryArgs) => {
	const summaries = Array.from(
		computeThreadSummaries(args.messages).values()
	).sort((a, b) => b.lastReplyTs - a.lastReplyTs);

	return (
		<ThreadListPanel
			summaries={summaries}
			unreadRootIds={new Set(args.unreadRootIds || [])}
			onSelectRoot={() => undefined}
		/>
	);
};

/**
 * Before (#834): previews showed `[[align:left]]<p>…</p>[[/align]]`.
 * After: plain readable text (`hello testing`, `okay`, `hello`).
 */
export const TransportMarkupPreviews: Story = {
	name: 'Transport markup → plain preview (#834)',
	args: {
		unreadRootIds: ['$root-align:hs'],
		messages: [
			{
				_id: '$root-align:hs',
				message: '[[align:left]]<p>hello testing</p>[[/align]]',
				messageTime: '2026-08-01T10:00:00.000Z'
			},
			{
				_id: '$reply-align:hs',
				message: 'reply',
				messageTime: '2026-08-01T10:05:00.000Z',
				threadRootEventId: '$root-align:hs'
			},
			{
				_id: '$root-plain:hs',
				message: 'okay',
				messageTime: '2026-08-01T09:00:00.000Z'
			},
			{
				_id: '$reply-plain:hs',
				message: 'reply',
				messageTime: '2026-08-01T09:01:00.000Z',
				threadRootEventId: '$root-plain:hs'
			},
			{
				_id: '$root-hl:hs',
				message: '[[hl:#ffff00]]hello[[/hl]]',
				messageTime: '2026-08-01T08:00:00.000Z'
			},
			{
				_id: '$reply-hl:hs',
				message: 'reply',
				messageTime: '2026-08-01T08:02:00.000Z',
				threadRootEventId: '$root-hl:hs'
			},
			{
				_id: '$root-visible:hs',
				message:
					'[VISIBLE_TO:user-a][[align:left]]<p>private note</p>[[/align]]',
				messageTime: '2026-08-01T07:00:00.000Z'
			},
			{
				_id: '$reply-visible:hs',
				message: 'reply',
				messageTime: '2026-08-01T07:03:00.000Z',
				threadRootEventId: '$root-visible:hs'
			}
		]
	},
	render: (args) => renderPanel(args)
};

/** Long preview exercises ellipsis truncation in `.session__threadListEntryPreview`. */
export const LongPreviewEllipsis: Story = {
	args: {
		messages: [
			{
				_id: '$root-long:hs',
				message:
					'[[align:left]]<p>This is a deliberately long thread root message that should truncate with an ellipsis in the Threads list preview row.</p>[[/align]]',
				messageTime: '2026-08-01T12:00:00.000Z'
			},
			{
				_id: '$reply-long:hs',
				message: 'reply',
				messageTime: '2026-08-01T12:01:00.000Z',
				threadRootEventId: '$root-long:hs'
			}
		]
	},
	render: (args) => renderPanel(args)
};
