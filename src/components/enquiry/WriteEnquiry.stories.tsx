import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { Route, Routes } from 'react-router-dom';
import { LanguagesProvider } from '../../globalState/provider/LanguagesProvider';
import { SessionsDataProvider } from '../../globalState/provider/SessionsDataProvider';
import { SessionTypeProvider } from '../../globalState/provider/SessionTypeProvider';
import { STATUS_EMPTY } from '../../globalState/interfaces/SessionsDataInterface';
import { endpoints } from '../../resources/scripts/endpoints';
import { SESSION_LIST_TYPES } from '../session/sessionHelpers';
import {
	buildMockActiveSession,
	ComposerStoryDecorator,
	mockComposerAskerData
} from '../messageSubmitInterface/__storybook__/composerStoryDecorator';
import { WriteEnquiry } from './WriteEnquiry';

const entryRoute = '/sessions/user/view/write';
const enquiryId = 16101;
const emptyDraftScopes = [`scope:${enquiryId}|thread:main`];
const enquiry = buildMockActiveSession(
	{},
	{
		id: enquiryId,
		status: STATUS_EMPTY,
		messageDate: null,
		matrixRoomId: '!new-enquiry:matrix.storybook.test'
	}
);

const installEnquiryList = (failFirst = false) => {
	const originalFetch = globalThis.fetch;
	const enquiryList = new URL(endpoints.askerSessions);
	let shouldFail = failFirst;
	const fixture: typeof fetch = async (input, init) => {
		const method =
			init?.method ?? (input instanceof Request ? input.method : 'GET');
		const url = new URL(
			input instanceof Request ? input.url : input,
			window.location.href
		);
		if (method !== 'GET' || url.href !== enquiryList.href) {
			return originalFetch(input, init);
		}
		if (shouldFail) {
			shouldFail = false;
			return new Response(null, { status: 503 });
		}
		return Response.json({
			sessions: [{ session: enquiry.item, user: enquiry.user }]
		});
	};
	globalThis.fetch = fixture;
	return () => {
		if (globalThis.fetch === fixture) globalThis.fetch = originalFetch;
	};
};

const meta = {
	title: 'Templates/WriteEnquiry',
	component: WriteEnquiry,
	parameters: { layout: 'fullscreen', router: { initialPath: entryRoute } },
	render: () => (
		<ComposerStoryDecorator
			userData={mockComposerAskerData}
			emptyDraftScopes={emptyDraftScopes}
		>
			<LanguagesProvider fixed={['de']} spoken={[]}>
				<SessionsDataProvider>
					<SessionTypeProvider type={SESSION_LIST_TYPES.ENQUIRY}>
						<main>
							<Routes>
								<Route
									path={entryRoute + '/:sessionId?'}
									element={<WriteEnquiry />}
								/>
							</Routes>
						</main>
					</SessionTypeProvider>
				</SessionsDataProvider>
			</LanguagesProvider>
		</ComposerStoryDecorator>
	)
} satisfies Meta<typeof WriteEnquiry>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FirstEnquiry: Story = {
	beforeEach: () => installEnquiryList(),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const editor = await canvas.findByRole(
			'textbox',
			{},
			{ timeout: 6000 }
		);
		await expect(editor).toHaveAttribute('contenteditable', 'true');
		await userEvent.click(editor);
		await userEvent.keyboard('Ich möchte eine Beratung anfragen.');
		await expect(editor).toHaveTextContent(
			'Ich möchte eine Beratung anfragen.'
		);
		await expect(
			canvas.getByRole('button', {
				name: /Nachricht senden|Send message/i
			})
		).toBeEnabled();
	}
};

export const RetryFailedLoad: Story = {
	beforeEach: () => installEnquiryList(true),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const reload = await canvas.findByRole('button', {
			name: /erneut laden|reload/i
		});
		await expect(canvas.queryByRole('textbox')).not.toBeInTheDocument();
		await userEvent.click(reload);
		await expect(
			await canvas.findByRole('textbox', {}, { timeout: 6000 })
		).toHaveAttribute('contenteditable', 'true');
	}
};
