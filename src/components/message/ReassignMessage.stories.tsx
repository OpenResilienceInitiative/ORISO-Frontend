import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import {
	HistoricalReassignMessage,
	ReassignRequestAcceptedMessage,
	ReassignRequestDeclinedMessage,
	ReassignRequestMessage,
	ReassignRequestSentMessage
} from './ReassignMessage';
import {
	mobileParameters,
	phone390Globals,
	type MessageStoryParameters,
	withMessageContexts
} from './messageStoryShell';
import './message.styles.scss';

/**
 * The legacy consultant-reassignment records, rendered read-only.
 *
 * Nothing on dev can still create or answer a REASSIGN_CONSULTANT alias:
 * `apiSendAliasMessage` and the old `apiPatchMessage` button handler target
 * `/service/messages/...`, which UserService no longer serves. So every such
 * message is history. The advice seeker's accept/decline buttons are gone, and
 * a blank counsellor name reads as "A former counsellor".
 *
 * The `…Sent`, `…Accepted`, `…Declined` variants resolve consultant names out of
 * `ConsultantListContext`, so they are wrapped in the shared context shell.
 */
const meta = {
	title: 'Components/Chat/ReassignMessage',
	tags: ['autodocs'],
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component:
					'Legacy consultant-reassignment records, read-only. No accept/decline actions — see the docblock.'
			}
		}
	},
	decorators: [
		(Story, ctx) =>
			withMessageContexts(Story, {
				parameters: ctx.parameters as MessageStoryParameters
			})
	]
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Request: Story = {
	name: 'Request (advice-seeker view, read-only)',
	render: () => (
		<ReassignRequestMessage
			fromConsultantName="Karina P"
			toConsultantName="Jonas M"
		/>
	),
	parameters: {
		docs: {
			description: {
				story: 'Formerly asked the advice seeker to accept or decline. The buttons called an endpoint that is not served, so the record is now read-only.'
			}
		}
	}
};

export const RequestMobile: Story = {
	name: 'Request — mobile (390px)',
	render: () => (
		<ReassignRequestMessage
			fromConsultantName="Karina P"
			toConsultantName="absichtslose Schildkröte Andrea"
		/>
	),
	globals: phone390Globals,
	parameters: {
		...mobileParameters
	}
};

export const HistoricalBlankNames: Story = {
	name: 'Historical record — blank counsellor names',
	render: () => (
		<HistoricalReassignMessage
			message={JSON.stringify({
				status: 'CONFIRMED',
				toAskerName: 'sanftes Alpaka Mika',
				toConsultantName: '',
				toConsultantId: 'consultant-gone',
				fromConsultantName: '',
				fromConsultantId: 'consultant-gone-too'
			})}
			isAsker={false}
			isMySession={false}
		/>
	),
	parameters: {
		docs: {
			description: {
				story: 'Neither counsellor resolves any more and the stored names are empty: both read as "A former counsellor".'
			}
		}
	}
};

export const Sent: Story = {
	name: 'Sent (counsellor view)',
	render: () => (
		<ReassignRequestSentMessage
			toAskerName="sanftes Alpaka Mika"
			fromConsultantId="consultant-storybook"
			toConsultantId="consultant-other"
			isMySession={true}
		/>
	)
};

export const Accepted: Story = {
	name: 'Accepted',
	render: () => (
		<ReassignRequestAcceptedMessage
			toAskerName="sanftes Alpaka Mika"
			toConsultantName="Jonas M"
			toConsultantId="consultant-other"
			isAsker={false}
			fromConsultantId="consultant-storybook"
			isMySession={true}
		/>
	)
};

export const AcceptedAskerView: Story = {
	name: 'Accepted (advice-seeker view)',
	render: () => (
		<ReassignRequestAcceptedMessage
			toAskerName="sanftes Alpaka Mika"
			toConsultantName="Jonas M"
			toConsultantId="consultant-other"
			isAsker={true}
			fromConsultantId="consultant-storybook"
			isMySession={false}
		/>
	),
	parameters: {
		docs: {
			description: {
				story: "`isAsker` suppresses the consultant-name lookup, so the advice seeker never learns the previous counsellor's identity from this message."
			}
		}
	}
};

export const Declined: Story = {
	name: 'Declined',
	render: () => (
		<ReassignRequestDeclinedMessage
			isAsker={false}
			isMySession={true}
			toAskerName="sanftes Alpaka Mika"
			fromConsultantName="Karina P"
			fromConsultantId="consultant-storybook"
		/>
	)
};

export const DeclinedAskerView: Story = {
	name: 'Declined (advice-seeker view)',
	render: () => (
		<ReassignRequestDeclinedMessage
			isAsker={true}
			isMySession={false}
			toAskerName="sanftes Alpaka Mika"
			fromConsultantName="Karina P"
			fromConsultantId="consultant-storybook"
		/>
	)
};
