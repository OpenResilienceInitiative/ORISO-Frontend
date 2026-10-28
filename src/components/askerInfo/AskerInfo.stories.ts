import { createElement, useEffect, useRef } from 'react';
import { Meta, StoryObj } from '@storybook/react';
import { Route, Routes } from 'react-router-dom';
import { TopicsContext } from '../../globalState/provider/TopicsProvider';
import { AskerInfo } from './AskerInfo';
import { APP_ORISO_FIGMA_URL } from '../storybookDesignLinks';
import {
	CLIENT_ROOM_ID,
	SESSION_ID,
	stageTopic,
	stageListItem
} from '../chatStage/__storybook__/chatStageFixtures';

const PROFILE_ROUTE =
	'/sessions/consultant/sessionView/:groupId/:sessionId/userProfile';

/**
 * The profile loads its session by room id, as in the app (#1338). The answer
 * is installed during render, before the load effect runs, and fetch is
 * restored when the story unmounts.
 */
const AskerInfoRoute = () => {
	const restore = useRef<(() => void) | null>(null);
	if (!restore.current) {
		const originalFetch = globalThis.fetch;
		globalThis.fetch = async (input, init) => {
			const url =
				typeof input === 'string'
					? input
					: input instanceof URL
						? input.toString()
						: input.url;
			if (url.includes('/service/users/sessions/room')) {
				return new Response(
					JSON.stringify({ sessions: [stageListItem()] }),
					{
						status: 200,
						headers: { 'Content-Type': 'application/json' }
					}
				);
			}
			return originalFetch(input, init);
		};
		restore.current = () => {
			globalThis.fetch = originalFetch;
		};
	}
	useEffect(() => () => restore.current?.(), []);

	return createElement(
		Routes,
		null,
		createElement(Route, {
			path: PROFILE_ROUTE,
			element: createElement(
				TopicsContext.Provider,
				{
					value: {
						topics: [stageTopic],
						refreshTopics: () => undefined
					}
				},
				createElement(AskerInfo)
			)
		})
	);
};

const meta = {
	title: 'Organisms/AskerInfo',
	component: AskerInfo,
	tags: ['autodocs'],
	render: () => createElement(AskerInfoRoute),
	parameters: {
		router: {
			initialPath: `/sessions/consultant/sessionView/${encodeURIComponent(
				CLIENT_ROOM_ID
			)}/${SESSION_ID}/userProfile`
		},
		design: {
			type: 'figma',
			url: APP_ORISO_FIGMA_URL
		},
		docs: {
			description: {
				component:
					'Asker profile panel showing the active session user and their info content.'
			}
		}
	}
} satisfies Meta<typeof AskerInfo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
