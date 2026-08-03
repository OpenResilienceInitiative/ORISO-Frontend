/**
 * Element Call, embedded live (Frontend#899).
 *
 * Shows the deployed call UI the way `useElementCallWidget` embeds it,
 * with the theme switchable from the controls.
 *
 * Deliberately an iframe rather than imported components: the call's
 * screens pull `matrix-js-sdk`, `livekit-client` and widget/media state,
 * and the fork runs React 19 while this app does not. Mocking that in
 * would put two React versions and two design systems in one build,
 * break on every upstream merge, and still only show mocks. Component-
 * level coverage belongs in the fork, which already has Playwright.
 */
import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { getElementCallBaseUrl } from '../../resources/scripts/runtimeConfig';

interface EmbedArgs {
	baseUrl: string;
	theme: 'dark' | 'light';
	room: string;
}

const Embed: React.FC<EmbedArgs> = ({ baseUrl, theme, room }) => {
	const origin = (baseUrl || '').replace(/\/+$/, '');
	if (!origin) {
		return (
			<p style={{ padding: 24, maxWidth: '65ch' }}>
				No Element Call origin configured. Set{' '}
				<code>REACT_APP_ELEMENT_CALL_BASE_URL</code>, or type an origin
				into the <code>baseUrl</code> control.
			</p>
		);
	}
	const url = `${origin}/room#?${new URLSearchParams({
		roomId: room,
		theme,
		confineToRoom: 'true',
		header: 'none',
		skipLobby: 'false',
		intent: 'start_call',
		callIntent: 'video'
	}).toString()}`;

	return (
		<div
			style={{
				display: 'flex',
				flexDirection: 'column',
				height: '100vh'
			}}
		>
			<p style={{ margin: 0, padding: '10px 16px', maxWidth: '80ch' }}>
				Live from <code>{origin}</code>. The lobby and the settings
				dialog render without a backend; joining an actual call needs
				Matrix and LiveKit, so an unauthenticated Storybook will stop at
				the join screen. That is enough to judge the colour work, which
				is what this story is for.
			</p>
			<iframe
				title="Element Call"
				src={url}
				style={{ flex: 1, width: '100%', border: 0 }}
				allow="camera; microphone; fullscreen; display-capture; autoplay; clipboard-write"
			/>
		</div>
	);
};

const meta: Meta<EmbedArgs> = {
	title: 'Design System/Element Call (live)',
	parameters: { layout: 'fullscreen' },
	argTypes: {
		theme: { control: 'inline-radio', options: ['dark', 'light'] },
		baseUrl: { control: 'text' },
		room: { control: 'text' }
	},
	args: {
		baseUrl: getElementCallBaseUrl(),
		// The app pins dark; light is here to check the mapping's other half.
		theme: 'dark',
		room: '#storybook-preview:oriso.org'
	},
	render: (args) => <Embed {...args} />
};
export default meta;

export const Live: StoryObj<EmbedArgs> = {};
