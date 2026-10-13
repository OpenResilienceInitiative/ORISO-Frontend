import * as React from 'react';
import { useMemo } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box } from '@mui/material';
import { fn } from 'storybook/test';
import { JoinRequestCenter } from './JoinRequestCenter';
import {
	createHttpJoinRequestTransport,
	JoinRequestApi
} from './httpJoinRequestTransport';
import { useOwnJoinRequest } from './useOwnJoinRequest';
import { GroupChatJoinRequestOwnStatus } from './joinRequestModel';
import { GroupChatNotMember } from '../GroupChatNotMember';
import { M3SnackbarHost } from '../../m3Snackbar/M3SnackbarHost';
import { createSnackbarStack } from '../../m3Snackbar/snackbarStack';
import {
	KNOCK_SERIES_ID,
	KNOCK_STORY_NOW,
	knockRequest,
	knockRequesters
} from './__storybook__/joinRequestFixtures';

/** External API fixture: admission is accepted, while actual group access is still queued. */
interface AdmissionFailure {
	status: 403 | 502;
	reason: 'DPA_NEW_COUNSELLING_NOT_ALLOWED' | 'DPA_POLICY_UNAVAILABLE';
}

const queuedApi = (
	alreadyAccepted: boolean,
	failure?: AdmissionFailure
): JoinRequestApi => {
	let accepted = alreadyAccepted;
	const request = knockRequest(knockRequesters.anna, {
		id: 1,
		minutesAgo: 3
	});
	const own = (): GroupChatJoinRequestOwnStatus => ({
		id: request.id,
		status: accepted ? 'ADMITTING' : 'PENDING',
		requestedAt: request.requestedAt
	});
	return {
		knock: async () => own(),
		getMine: async () => own(),
		cancelMine: async () => undefined,
		listPending: async () => (accepted ? [] : [request]),
		admit: async () => {
			if (failure)
				throw new Response('synthetic-private-admission-detail', {
					status: failure.status,
					headers: { 'X-Reason': failure.reason }
				});
			accepted = true;
		},
		decline: async () => undefined
	};
};

const Moderator = ({ failure }: { failure?: AdmissionFailure }) => {
	const stack = useMemo(createSnackbarStack, []);
	const transport = useMemo(
		() =>
			createHttpJoinRequestTransport({ api: queuedApi(false, failure) }),
		[failure]
	);
	return (
		<>
			<JoinRequestCenter
				transport={transport}
				stack={stack}
				now={KNOCK_STORY_NOW}
			/>
			<M3SnackbarHost stack={stack} />
		</>
	);
};

const Requester = () => {
	const transport = useMemo(
		() => createHttpJoinRequestTransport({ api: queuedApi(true) }),
		[]
	);
	const request = useOwnJoinRequest(
		KNOCK_SERIES_ID,
		'synthetic-current-invite',
		transport,
		{ onOpenGroup: fn() }
	);
	return <GroupChatNotMember onBack={fn()} joinRequest={request} />;
};

const meta = {
	title: 'Group chat/Queued admission',
	component: Moderator,
	parameters: { layout: 'fullscreen' },
	decorators: [
		(Story) => (
			<Box
				sx={{
					minHeight: '100vh',
					backgroundColor: 'var(--m3-surface-container-lowest)'
				}}
			>
				<Story />
			</Box>
		)
	]
} satisfies Meta<typeof Moderator>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Click Let in: 204 accepts the intent, not completed membership. */
export const ModeratorParticipant: Story = { render: () => <Moderator /> };
/** Open Details and choose co-moderation before accepting the intent. */
export const ModeratorCoModerator: Story = { render: () => <Moderator /> };
/** The public own-status resource returns ADMITTING; no second request or withdrawal is valid. */
export const RequesterAdmitting: Story = { render: () => <Requester /> };

/** Only the exact public refusal/reason pair is rendered through the shared classifier. */
export const ModeratorRestricted: Story = {
	render: () => (
		<Moderator
			failure={{ status: 403, reason: 'DPA_NEW_COUNSELLING_NOT_ALLOWED' }}
		/>
	)
};
export const ModeratorUnavailable: Story = {
	render: () => (
		<Moderator
			failure={{ status: 502, reason: 'DPA_POLICY_UNAVAILABLE' }}
		/>
	)
};
