import * as React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { MessageTimeline } from './MessageTimeline';
import { useThreadFocusReturn } from './useThreadFocusReturn';
import { parseChannel, withChannel } from '../../utils/channelRoute';
import { SidePanel } from '../chatStage/SidePanel';
import { PanelHeader } from '../chatStage/PanelHeader';
import { MessageSubmitInterfaceComponent } from '../messageSubmitInterface/messageSubmitInterfaceComponent';
import { ChatStageProviders } from '../chatStage/__storybook__/ChatStageProviders';
import {
	mainChatMessages,
	threadMessages,
	THREAD_ROOT_ID,
	CLIENT_NAME,
	isCounsellorMessage
} from '../chatStage/__storybook__/chatStageFixtures';
import { mockE2eeParams } from '../message/MessageItemComponent.mocks';
import './session.styles.scss';
import '../message/message.styles.scss';

const noop = () => {};
const handlers = {
	handleDecryptionErrors: noop,
	handleDecryptionSuccess: noop,
	e2eeParams: mockE2eeParams()
};
function ThreadJourney({
	remountMain = false,
	closeViaHistory = false
}: {
	remountMain?: boolean;
	closeViaHistory?: boolean;
}) {
	const location = useLocation();
	const navigate = useNavigate();
	const { channel } = parseChannel(location.search);
	const timelineRef = React.useRef<HTMLDivElement>(null);
	const rememberOpener = useThreadFocusReturn({
		channel,
		sessionId: 'focus-session',
		timelineRef
	});
	const root = mainChatMessages().find(
		(message) => message._id === THREAD_ROOT_ID
	)!;
	const close = () =>
		closeViaHistory
			? navigate(-1)
			: navigate(
					{ search: withChannel(location.search, null) },
					{ replace: true }
				);
	return (
		<div
			className="session"
			style={{ height: 650, width: '100%', maxWidth: 1200 }}
		>
			{(!remountMain || !channel) && (
				<div ref={timelineRef} className="session__content">
					<MessageTimeline
						messages={[root]}
						clientName={CLIENT_NAME}
						isMyMessage={isCounsellorMessage}
						{...handlers}
						threadsEnabled
						threadSummaryFor={() => ({
							replyCount: 2,
							lastReplyText: 'Mona: Das klären wir gemeinsam.'
						})}
						onOpenThread={(message, opener) => {
							rememberOpener(message._id, opener);
							navigate({
								search: withChannel(location.search, {
									kind: 'thread',
									rootId: message._id
								})
							});
						}}
					/>
				</div>
			)}
			{channel?.kind === 'thread' && (
				<SidePanel
					label="Antworten"
					variant={remountMain ? 'fullscreen' : 'inside'}
					header={
						<PanelHeader
							kind="thread"
							title="Thread"
							name={CLIENT_NAME}
							onClose={close}
						/>
					}
					timeline={
						<MessageTimeline
							messages={[root, ...threadMessages()]}
							clientName={CLIENT_NAME}
							isMyMessage={isCounsellorMessage}
							{...handlers}
							renderMode="thread"
							threadsEnabled
							threadRootId={channel.rootId}
							forceShow
						/>
					}
					composer={
						<MessageSubmitInterfaceComponent
							placeholder="Antwort schreiben"
							threadRootId={channel.rootId}
							onCloseThread={close}
							onSendButton={noop}
							isTyping={noop}
							language="de"
						/>
					}
				/>
			)}
		</div>
	);
}
const meta = {
	title: 'Components/Chat/Thread focus return',
	component: ThreadJourney,
	parameters: { layout: 'fullscreen' },
	decorators: [
		(Story) => (
			<ChatStageProviders>
				<Story />
			</ChatStageProviders>
		)
	]
} satisfies Meta<typeof ThreadJourney>;
export default meta;
type Story = StoryObj<typeof meta>;
const exercise: Story['play'] = async ({ canvasElement }) => {
	const canvas = within(canvasElement);
	const opener = await canvas.findByRole('button', { name: /Thread öffnen/ });
	await userEvent.click(opener);
	const panel = await canvas.findByRole('complementary', {
		name: 'Antworten'
	});
	await expect(
		within(panel).getByText(/^Es sind ein paar Briefe gekommen/)
	).toBeInTheDocument();
	await expect(
		within(panel).getByText(/^Okay. Vielleicht nächste Woche/)
	).toBeInTheDocument();
	await userEvent.click(
		within(panel).getByRole('button', { name: /schließen/i })
	);
	const reopenedOpener = await canvas.findByRole('button', {
		name: /Thread öffnen/
	});
	await waitFor(() => expect(reopenedOpener).toHaveFocus());
	await userEvent.keyboard('{Enter}');
	const reopenedPanel = await canvas.findByRole('complementary', {
		name: 'Antworten'
	});
	const editor = within(reopenedPanel).getByRole('textbox');
	await userEvent.click(editor);
	await userEvent.keyboard('{Escape}');
	await waitFor(() =>
		expect(
			canvas.getByRole('button', { name: /Thread öffnen/ })
		).toHaveFocus()
	);
};
export const Desktop: Story = { play: exercise };
export const MobileRemountedTimeline: Story = {
	args: { remountMain: true },
	globals: { viewport: { value: 'phone390', isRotated: false } },
	play: exercise
};

export const HistoryBack: Story = {
	args: { closeViaHistory: true },
	play: exercise
};
