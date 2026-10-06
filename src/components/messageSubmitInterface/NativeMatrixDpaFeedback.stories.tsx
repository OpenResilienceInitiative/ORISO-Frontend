import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { MatrixError } from 'matrix-js-sdk';
import { MessageSubmitInterfaceComponent } from './messageSubmitInterfaceComponent';
import { MatrixClientContext } from '../../globalState/context/MatrixClientContext';
import {
	buildMockGroupSession,
	buildMockMatrixClientService,
	ComposerStoryDecorator
} from './__storybook__/composerStoryDecorator';
import './messageSubmitInterface.styles.scss';
import '../session/session.styles.scss';

const DRAFT = 'Synthetic message stays here';

function NativeJoinFeedback({ unavailable }: { unavailable: boolean }) {
	const [failedMessage, setFailedMessage] = useState(false);
	const [session] = useState(buildMockGroupSession);
	// Synthetic SDK error injection, not a running Synapse module. The public
	// SDK HTTP parser and production transport are covered by the integration test.
	const [transport] = useState(() =>
		Object.assign(buildMockMatrixClientService([]), {
			sendMessage: async () => {
				throw new MatrixError(
					{
						'errcode': unavailable ? 'M_UNKNOWN' : 'M_FORBIDDEN',
						'error': 'Synthetic native join failure',
						'org.oriso.reason': unavailable
							? 'DPA_POLICY_UNAVAILABLE'
							: 'DPA_NEW_COUNSELLING_NOT_ALLOWED'
					},
					unavailable ? 502 : 403
				);
			}
		})
	);
	return (
		<div
			className="session"
			style={{
				minHeight: 560,
				padding: 24,
				position: 'relative',
				boxSizing: 'border-box',
				display: 'flex',
				flexDirection: 'column',
				justifyContent: 'flex-end'
			}}
		>
			<ComposerStoryDecorator activeSession={session}>
				<MatrixClientContext.Provider
					value={{
						matrixClientService: transport,
						setMatrixClientService: () => {}
					}}
				>
					<MessageSubmitInterfaceComponent
						placeholder="Synthetic draft"
						autoFocusEditor={false}
						onSendError={() => setFailedMessage(true)}
					/>
					{failedMessage && (
						<output aria-label="Failed message" hidden>
							Synthetic failed-message callback
						</output>
					)}
				</MatrixClientContext.Provider>
			</ComposerStoryDecorator>
		</div>
	);
}

const meta = {
	title: 'Components/Message/Native Matrix AVV feedback',
	parameters: { layout: 'fullscreen' },
	tags: ['autodocs']
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const verifyFeedback =
	(title: string) =>
	async ({ canvasElement }: { canvasElement: HTMLElement }) => {
		const canvas = within(canvasElement);
		const editor = await canvas.findByRole('textbox');
		await userEvent.click(editor);
		await userEvent.type(editor, DRAFT);
		const send = canvas.getByRole('button', {
			name: /Nachricht senden|Send message|Envoyer un message/
		});
		send.focus();
		await userEvent.keyboard('{Enter}');
		const alert = await canvas.findByRole('alert');
		expect(alert).toHaveTextContent(title);
		expect(editor).toHaveTextContent(DRAFT);
		expect(canvas.queryByLabelText('Failed message')).toBeNull();
		await waitFor(() => expect(send).toBeEnabled());
	};

export const RestrictedGerman: Story = {
	globals: { locale: 'de' },
	render: () => <NativeJoinFeedback unavailable={false} />,
	play: verifyFeedback('Neue Beratung derzeit gesperrt')
};
export const RestrictedEnglish: Story = {
	globals: { locale: 'en' },
	render: () => <NativeJoinFeedback unavailable={false} />,
	play: verifyFeedback('New counselling is currently restricted')
};
export const UnavailableGerman: Story = {
	globals: { locale: 'de' },
	render: () => <NativeJoinFeedback unavailable />,
	play: verifyFeedback('Beratung derzeit nicht prüfbar')
};
export const UnavailableEnglish: Story = {
	globals: { locale: 'en' },
	render: () => <NativeJoinFeedback unavailable />,
	play: verifyFeedback('Counselling availability cannot be checked')
};

/** The longest supported restriction title is the narrow-viewport stress case. */
export const RestrictedFrench: Story = {
	globals: { locale: 'fr' },
	render: () => <NativeJoinFeedback unavailable={false} />,
	play: verifyFeedback(
		'Les nouvelles consultations sont actuellement suspendues'
	)
};
