/** Source-bound real session composition; synthetic HTTP and Matrix SDK ports. */
import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { MatrixEvent, SyncState } from 'matrix-js-sdk';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SessionStream } from './SessionStream';
import { SESSION_LIST_TYPES } from './sessionHelpers';
import {
	ActiveSessionContext,
	UserDataContext,
	SessionTypeContext,
	buildExtendedSession
} from '../../globalState';
import { MatrixClientContext } from '../../globalState/context/MatrixClientContext';
import { setMatrixClientServiceRef } from '../../services/matrixClientRegistry';
import { ChatStageProviders } from '../chatStage/__storybook__/ChatStageProviders';
import {
	stageSession,
	counsellorUserData
} from '../chatStage/__storybook__/chatStageFixtures';
import type { ListItemInterface } from '../../globalState/interfaces';

const ROOM = '!enquiry-rejection:storybook.invalid';
const sessionFor = (status: number) => {
	const original = stageSession();
	return buildExtendedSession({
		user: original.user,
		session: {
			...original.item,
			id: 4711,
			status,
			matrixRoomId: ROOM,
			conversationType: 'AGENCY_COUNSELLING',
			registrationType: 'REGISTERED',
			agencyId: 1,
			askerMatrixUserId: '@asker:storybook.invalid'
		}
	} as ListItemInterface);
};
const timeline = [
	new MatrixEvent({
		event_id: '$original',
		room_id: ROOM,
		sender: '@asker:storybook.invalid',
		type: 'm.room.message',
		origin_server_ts: Date.now(),
		content: {
			msgtype: 'm.text',
			body: 'Ich habe eine Anfrage eingereicht und möchte den bisherigen Verlauf weiter lesen können.'
		}
	})
];
const room = {
	roomId: ROOM,
	timeline,
	getMyMembership: () => 'join',
	getMembers: () => [],
	getJoinedMembers: () => [],
	getMember: () => null,
	getLiveTimeline: () => ({ getEvents: () => timeline }),
	currentState: { getStateEvents: () => null, maySendEvent: () => true },
	getUnreadNotificationCount: () => 0
};
const client = {
	getRoom: (id: string) => (id === ROOM ? room : null),
	getRooms: () => [room],
	getUserId: () => '@consultant:storybook.invalid',
	getSyncState: () => SyncState.Prepared,
	getAccountData: () => null,
	setAccountData: async () => {},
	on: () => {},
	off: () => {},
	addListener: () => {},
	removeListener: () => {}
};
const matrix = {
	getClient: () => client,
	getRoom: () => room,
	getRoomMessages: () => timeline,
	onClientChange: () => () => {},
	sendTyping: async () => {}
} as any;
type Scenario =
	| 'confirmation'
	| 'pending'
	| 'incomplete'
	| 'confirmed'
	| 'history';
function EnquiryRejectionStory({ scenario }: { scenario: Scenario }) {
	const { t } = useTranslation();
	const history = scenario === 'history';
	const [session, setSession] = React.useState(() =>
		sessionFor(history ? 5 : 1)
	);
	const statusRef = React.useRef(history ? 5 : 1);
	const requests = React.useRef(0);
	const [requestCount, setRequestCount] = React.useState(0);
	const { pathname } = useLocation();
	React.useLayoutEffect(() => {
		const previous = window.fetch;
		setMatrixClientServiceRef(matrix);
		window.fetch = async (input, init) => {
			const url =
				typeof input === 'string'
					? input
					: input instanceof URL
						? input.href
						: input.url;
			const method =
				init?.method ??
				(input instanceof Request ? input.method : 'GET');
			if (/\/sessions\/4711\/rejection$/.test(url)) {
				if (method !== 'POST')
					throw new Error('The synthetic command must use POST');
				requests.current += 1;
				setRequestCount(requests.current);
				statusRef.current = 5;
				if (scenario === 'pending')
					return new Promise<Response>(() => {});
				if (scenario === 'incomplete' && requests.current === 1)
					return new Response(null, { status: 503 });
				return new Response(null, { status: 204 });
			}
			const json = (body: unknown) =>
				new Response(JSON.stringify(body), {
					status: 200,
					headers: { 'Content-Type': 'application/json' }
				});
			if (/\/sessions\/room\/4711/.test(url))
				return json({
					sessions: [
						{
							user: sessionFor(statusRef.current).user,
							session: sessionFor(statusRef.current).item
						}
					]
				});
			if (/\/supervisors$/.test(url) || /\/consultants(?:\?|$)/.test(url))
				return json([]);
			if (/\/team-discussion/.test(url))
				return new Response(null, { status: 204 });
			return previous(input, init);
		};
		return () => {
			window.fetch = previous;
			setMatrixClientServiceRef(null);
		};
	}, [scenario]); // Session state is served through statusRef, independent of renders.
	const user = history
		? {
				...counsellorUserData,
				userId: 'asker',
				grantedAuthorities: ['AUTHORIZATION_USER_DEFAULT'],
				userRoles: ['USER']
			}
		: { ...counsellorUserData, agencies: [{ id: 1 }] };
	return (
		<ChatStageProviders activeSession={session}>
			<UserDataContext.Provider
				value={{
					userData: user as any,
					setUserData: () => {},
					reloadUserData: async () => user as any
				}}
			>
				<SessionTypeContext.Provider
					value={{
						type: history
							? SESSION_LIST_TYPES.MY_SESSION
							: SESSION_LIST_TYPES.ENQUIRY,
						path: '/sessions/consultant/sessionPreview'
					}}
				>
					<ActiveSessionContext.Provider
						value={{
							activeSession: session,
							reloadActiveSession: () =>
								setSession(sessionFor(statusRef.current)),
							readActiveSession: () => {}
						}}
					>
						<MatrixClientContext.Provider
							value={{
								matrixClientService: matrix,
								setMatrixClientService: () => {}
							}}
						>
							<main
								style={{
									height: 'calc(100vh - 40px)',
									minHeight: 400,
									padding: 12
								}}
							>
								<SessionStream
									readonly={history}
									bannedUsers={[]}
									checkMutedUserForThisSession={() => {}}
								/>
								<output data-testid="rejection-proof">
									{requestCount}:{pathname}
								</output>
								{pathname ===
									'/sessions/consultant/sessionPreview' &&
									requestCount > 0 && (
										<p role="status">
											{t('enquiry.rejection.closed')}
										</p>
									)}
							</main>
						</MatrixClientContext.Provider>
					</ActiveSessionContext.Provider>
				</SessionTypeContext.Provider>
			</UserDataContext.Provider>
		</ChatStageProviders>
	);
}
const meta = {
	title: 'Organisms/Session/EnquiryRejection',
	component: EnquiryRejectionStory,
	tags: ['autodocs'],
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component:
					'Actual SessionStream, AcceptAssign, header, menu and shared confirmation dialog. Synthetic no-body POST and Matrix SDK history only. Local source proof; this is not deployed or remote Matrix closure acceptance.'
			}
		}
	}
} satisfies Meta<typeof EnquiryRejectionStory>;
export default meta;
type Story = StoryObj<typeof meta>;
const openConfirmation: NonNullable<Story['play']> = async ({
	canvasElement
}) => {
	const canvas = within(canvasElement);
	const document = within(canvasElement.ownerDocument.body);
	await userEvent.click(
		await canvas.findByRole('button', {
			name: /Anfrage ablehnen|Decline request|Refuser la demande|Отклонить запрос|Talebi reddet|ሕቶ ንጸግ/
		})
	);
	await waitFor(() => expect(document.getByRole('dialog')).toBeVisible());
	await expect(
		document.getByRole('dialog').querySelector('textarea')
	).toBeNull();
};
export const Confirmation: Story = {
	args: { scenario: 'confirmation' },
	play: openConfirmation
};
export const Pending: Story = {
	args: { scenario: 'pending' },
	play: async (ctx) => {
		await openConfirmation(ctx);
		const dialog = within(ctx.canvasElement.ownerDocument.body).getByRole(
			'dialog'
		);
		const buttons = within(dialog).getAllByRole('button');
		await userEvent.click(buttons.at(-1)!);
		await waitFor(() => expect(buttons.at(-1)).toBeDisabled());
		await expect(within(dialog).getByRole('status')).toBeVisible();
	}
};
export const IncompleteRetry: Story = {
	args: { scenario: 'incomplete' },
	play: async (ctx) => {
		await openConfirmation(ctx);
		const dialog = within(ctx.canvasElement.ownerDocument.body).getByRole(
			'dialog'
		);
		await userEvent.click(within(dialog).getAllByRole('button').at(-1)!);
		await expect(await within(dialog).findByRole('alert')).toBeVisible();
		await expect(
			within(dialog).getAllByRole('button').at(-1)
		).toBeEnabled();
		await expect(
			within(ctx.canvasElement).getByTestId('rejection-proof')
		).toHaveTextContent('1:');
	}
};
export const Confirmed: Story = {
	args: { scenario: 'confirmed' },
	play: async (ctx) => {
		await openConfirmation(ctx);
		const doc = within(ctx.canvasElement.ownerDocument.body);
		await userEvent.click(
			within(doc.getByRole('dialog')).getAllByRole('button').at(-1)!
		);
		await waitFor(() => expect(doc.queryByRole('dialog')).toBeNull());
		await waitFor(() =>
			expect(
				within(ctx.canvasElement).getByTestId('rejection-proof')
			).toHaveTextContent('1:/sessions/consultant/sessionPreview')
		);
	}
};
export const SeekerReadOnlyHistory: Story = {
	args: { scenario: 'history' },
	play: async ({ canvasElement }) => {
		await waitFor(() =>
			expect(canvasElement.textContent).toContain(
				'Ich habe eine Anfrage eingereicht'
			)
		);
		await expect(
			canvasElement.querySelector('[contenteditable="true"]')
		).toBeNull();
		await expect(
			within(canvasElement).getAllByRole('status').length
		).toBeGreaterThan(0);
	}
};
