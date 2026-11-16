import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import i18n from 'i18next';
import { ActiveSessionContext, buildExtendedSession } from '../../globalState';
import { ChatStageProviders } from '../chatStage/__storybook__/ChatStageProviders';
import {
	stageListItem,
	stageRoute
} from '../chatStage/__storybook__/chatStageFixtures';
import { SessionMenu } from '../sessionMenu/SessionMenu';
import '../session/session.styles.scss';

/** The open conversation as an accepted anonymous live chat (placeholder postcode). */
const liveChatSession = () => {
	const item = stageListItem();
	item.session = {
		...item.session,
		registrationType: 'ANONYMOUS',
		conversationType: 'LIVE_CHAT',
		postcode: 0,
		supervision: undefined
	} as any;
	return buildExtendedSession(item, '');
};

/** Sets the counselling centre's switch on the open conversation's agency answer. */
const CentreSwitch = ({ enabled }: { enabled: boolean }) => {
	const active = React.useContext(ActiveSessionContext);
	if (!active?.activeSession) return null;
	return (
		<ActiveSessionContext.Provider
			value={{
				...active,
				agencyFeaturePolicy: {
					agencyId: active.activeSession.item.agencyId,
					state: 'ready',
					settings: {
						featureLiveChatFurtherCounsellingEnabled: enabled
					}
				}
			}}
		>
			<div
				className="session"
				style={{
					padding: 16,
					display: 'flex',
					justifyContent: 'flex-end'
				}}
			>
				<SessionMenu
					hasUserInitiatedStopOrLeaveRequest={{ current: false }}
					isAskerInfoAvailable
				/>
			</div>
		</ActiveSessionContext.Provider>
	);
};

const renderWith = (enabled: boolean) => () => (
	<ChatStageProviders activeSession={liveChatSession()}>
		<CentreSwitch enabled={enabled} />
	</ChatStageProviders>
);

const meta = {
	title: 'Chat/Session menu/Live chat — recommend further counselling',
	tags: ['autodocs', '!needs-data'],
	parameters: {
		layout: 'fullscreen',
		router: { initialPath: stageRoute },
		docs: {
			description: {
				component:
					'FE#2251. The counsellor who accepted an anonymous live chat sees **Weitere Beratung empfehlen** only when the counselling centre switched on „Weitere Beratung im Live-Chat empfehlen“ in Admin (off by default). The dialog and the card are the same as in the 1:1 conversation.'
			}
		}
	}
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const openMenuAndCheck =
	(visible: boolean) =>
	async ({ canvasElement }: { canvasElement: HTMLElement }) => {
		const canvas = within(canvasElement);
		const triggers = await canvas.findAllByRole('button', {
			name: String(i18n.t('app.menu'))
		});
		// Desktop and mobile each have a trigger; use the one that is shown.
		const trigger =
			triggers.find((button) => button.getClientRects().length > 0) ??
			triggers[0];
		await userEvent.click(trigger);
		await waitFor(() =>
			expect(trigger).toHaveAttribute('aria-expanded', 'true')
		);
		const item = () =>
			canvasElement.ownerDocument.querySelector(
				'[data-cy="session-menu-recommend-further-counselling"]'
			);
		await waitFor(() => expect(Boolean(item())).toBe(visible));
		if (visible) {
			await expect(item()).toHaveTextContent(
				String(i18n.t('furtherCounselling.menu.recommend'))
			);
		}
	};

export const CentreSwitchOn: Story = {
	name: 'Centre switch on — item shown',
	render: renderWith(true),
	play: openMenuAndCheck(true)
};

export const CentreSwitchOff: Story = {
	name: 'Centre switch off (default) — no item',
	render: renderWith(false),
	play: openMenuAndCheck(false)
};
