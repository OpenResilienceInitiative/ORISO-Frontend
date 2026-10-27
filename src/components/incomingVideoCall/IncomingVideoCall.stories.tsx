import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { NotificationsContext } from '../../globalState';
import { MatrixClientContext } from '../../globalState/context/MatrixClientContext';
import {
	IncomingVideoCall,
	IncomingVideoCallProps,
	NOTIFICATION_TYPE_CALL
} from './IncomingVideoCall';
import '../notifications/notifications.styles.scss';
import '../notifications/notification.styles.scss';

/**
 * The header's reject control exists only where the browser cannot join an
 * encrypted call. Chrome can, so these stories hide the two WebRTC features
 * the check looks for (`RTCRtpSender.prototype.createEncodedStreams`,
 * `RTCRtpScriptTransform`) for as long as the story runs, and put them back
 * afterwards.
 */
const hideEncryptedCallSupport = () => {
	const win = window as unknown as Record<string, unknown>;
	const sender = window.RTCRtpSender?.prototype as unknown as
		| Record<string, unknown>
		| undefined;
	const encodedStreams = sender?.createEncodedStreams;
	const scriptTransform = win.RTCRtpScriptTransform;
	if (sender) delete sender.createEncodedStreams;
	delete win.RTCRtpScriptTransform;
	return () => {
		if (sender && encodedStreams)
			sender.createEncodedStreams = encodedStreams;
		if (scriptTransform) win.RTCRtpScriptTransform = scriptTransform;
	};
};

const call = {
	notificationType: NOTIFICATION_TYPE_CALL,
	id: '!room:demo',
	videoCall: {
		matrixRoomId: '!room:demo',
		initiatorMatrixUserId: '@beraterin:demo',
		initiatorUsername: 'Maria Beraterin',
		videoCallUrl: 'https://call.demo'
	}
} as unknown as IncomingVideoCallProps;

const meta = {
	title: 'Video call/Incoming call',
	component: IncomingVideoCall,
	args: call,
	parameters: { layout: 'fullscreen' },
	decorators: [
		(Story) => (
			<NotificationsContext.Provider
				value={{ removeNotification: () => undefined } as never}
			>
				<MatrixClientContext.Provider
					value={
						{
							matrixClientService: {
								getClient: () => ({
									callEventHandler: { calls: new Map() }
								})
							}
						} as never
					}
				>
					<div className="notifications">
						<Story />
					</div>
				</MatrixClientContext.Provider>
			</NotificationsContext.Provider>
		)
	],
	beforeEach: () => hideEncryptedCallSupport()
} satisfies Meta<typeof IncomingVideoCall>;
export default meta;

type Story = StoryObj<typeof meta>;

/** A browser without encrypted-call support: the call can only be declined. */
export const UnsupportedBrowser: Story = {};

/**
 * Keyboard: the reject control is the first tab stop and shows the shared
 * focus ring (`$focus-outline`).
 */
export const UnsupportedBrowserRejectFocused: Story = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.tab();
		await expect(
			canvas.getByRole('button', { name: /ablehnen|reject/i })
		).toHaveFocus();
	}
};
