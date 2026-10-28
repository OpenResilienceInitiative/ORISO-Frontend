import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, waitFor, within } from 'storybook/test';
import { useTranslation } from 'react-i18next';
import i18n from 'i18next';
import { ActiveSessionContext } from '../../globalState';
import { TenantContext } from '../../globalState/provider/TenantProvider';
import { ChatStageProviders } from '../chatStage/__storybook__/ChatStageProviders';
import {
	stageRoute,
	CLIENT_MATRIX_ID
} from '../chatStage/__storybook__/chatStageFixtures';
import { SessionMenu } from './SessionMenu';
import { MessageSubmitInterfaceComponent } from '../messageSubmitInterface/messageSubmitInterfaceComponent';
import { MessageItemComponent } from '../message/MessageItemComponent';
import { mockMessageItemComponentProps } from '../message/MessageItemComponent.mocks';
import { canonicalAgencySettings } from '../../test/fixtures/conversationPolicyFixtures';
import type { TenantDataInterface } from '../../globalState/interfaces/TenantDataInterface';
import type { ConversationFeatureSettings } from '../../globalState/interfaces/ConversationFeatureSettings';
import exampleAttachment from '../../resources/img/illustrations/conversation/internal-team.png';
import '../session/session.styles.scss';

const PARENT_OFF: ConversationFeatureSettings = {
	featureCallsEnabled: false,
	featureAudioCallsEnabled: false,
	featureVideoCallsEnabled: false,
	featureVoiceMessagesEnabled: false,
	featureMediaUploadEnabled: false,
	featureMediaInlineDisplayEnabled: false
};
const fixtureTenant: TenantDataInterface = {
	id: 1,
	name: 'LOCAL fixture',
	theming: {
		logo: '',
		associationLogo: null,
		favicon: '',
		primaryColor: '#a5000a',
		secondaryColor: '#fff'
	},
	content: {
		impressum: '',
		privacy: '',
		termsAndConditions: '',
		claim: '',
		dataPrivacyConfirmation: '',
		termsAndConditionsConfirmation: ''
	}
};
type State = 'legacy-off' | 'suggested-on' | 'enforced-off';

/** Existing components and provider harness; these are explicit synthetic policy fixtures. */
const PolicyFixture = ({ state }: { state: State }) => {
	const active = React.useContext(ActiveSessionContext);
	const tenantContext = React.useContext(TenantContext);
	const { t } = useTranslation();
	if (!active?.activeSession) return null;
	const tenant = tenantContext?.tenant ?? fixtureTenant;
	const agencySettings =
		state === 'legacy-off'
			? null
			: canonicalAgencySettings(
					state === 'enforced-off' ? PARENT_OFF : {},
					state === 'enforced-off' ? 'ENFORCED' : 'SUGGESTED'
				);
	return (
		<TenantContext.Provider
			value={{
				setTenant: tenantContext?.setTenant ?? (() => {}),
				updateTenantSettings:
					tenantContext?.updateTenantSettings ?? (() => {}),
				tenant: {
					...tenant,
					settings: {
						...tenant.settings,
						...PARENT_OFF
					}
				}
			}}
		>
			<ActiveSessionContext.Provider
				value={{
					...active,
					agencyFeaturePolicy: {
						agencyId: active.activeSession.item.agencyId,
						state: 'ready',
						settings: agencySettings
					}
				}}
			>
				<div
					className="session"
					style={{
						width: '100%',
						maxWidth: 960,
						minHeight: 560,
						margin: '0 auto',
						padding: 16,
						boxSizing: 'border-box',
						display: 'flex',
						flexDirection: 'column',
						gap: 16,
						position: 'relative'
					}}
				>
					<p data-qa74-caption="true">
						LOCAL Storybook fixture — parent OFF; {state}. Synthetic
						tenant-public HTTP and server-resolved agency policy
						values; no Dev or backend persistence proof.
					</p>
					<div
						style={{ display: 'flex', justifyContent: 'flex-end' }}
					>
						<SessionMenu
							hasUserInitiatedStopOrLeaveRequest={{
								current: false
							}}
							isAskerInfoAvailable
						/>
					</div>
					<MessageItemComponent
						{...mockMessageItemComponentProps({
							userId: CLIENT_MATRIX_ID,
							readOnly: true,
							message: '',
							attachments: [
								{
									title: 'example-attachment.png',
									downloadUrl: new URL(
										exampleAttachment,
										window.location.origin
									).href,
									type: 'image',
									mediaType: 'image/png'
								}
							],
							file: {
								name: 'example-attachment.png',
								type: 'image/png'
							}
						})}
					/>
					<MessageSubmitInterfaceComponent
						placeholder={t('enquiry.write.input.placeholder.asker')}
						autoFocusEditor={false}
					/>
				</div>
			</ActiveSessionContext.Provider>
		</TenantContext.Provider>
	);
};
const renderState = (state: State) => () => (
	<ChatStageProviders>
		<PolicyFixture state={state} />
	</ChatStageProviders>
);
const meta = {
	title: 'Permissions/Conversation runtime',
	tags: ['autodocs', '!needs-data'],
	parameters: {
		layout: 'fullscreen',
		router: { initialPath: stageRoute },
		tenantSettings: PARENT_OFF
	}
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;
const assertState =
	(enabled: boolean) =>
	async ({ canvasElement }: { canvasElement: HTMLElement }) => {
		const canvas = within(canvasElement);
		await waitFor(() => {
			const microphone = canvas.queryByRole('button', {
				name: String(
					i18n.t('message.submit.toolbar.voiceRecording.label')
				)
			});
			expect(Boolean(microphone)).toBe(enabled);
			if (enabled) {
				expect(microphone).toBeEnabled();
				const image = canvas.getByRole<HTMLImageElement>('img', {
					name: 'example-attachment.png'
				});
				expect(image.complete && image.naturalWidth > 0).toBe(true);
			}
			expect(
				Boolean(
					canvasElement.querySelector(
						'[data-cy="session-header-video-call-buttons"]'
					)
				)
			).toBe(enabled);
			expect(
				Boolean(canvasElement.querySelector('input[type="file"]'))
			).toBe(enabled);
			expect(
				Boolean(
					canvas.queryByRole('img', {
						name: 'example-attachment.png'
					})
				)
			).toBe(enabled);
		});
	};
export const LegacyParentOff: Story = {
	render: renderState('legacy-off'),
	play: assertState(false)
};
export const SuggestedAgencyOn: Story = {
	render: renderState('suggested-on'),
	play: assertState(true)
};
export const EnforcedOff: Story = {
	render: renderState('enforced-off'),
	play: assertState(false)
};
