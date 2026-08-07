import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import {
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
 * The four states of the legacy consultant-reassignment exchange.
 *
 * `ReassignRequestMessage` is the only in-chat system message in the codebase
 * that carries **accept/decline buttons pressed by the advice seeker**, which
 * makes it the closest existing precedent for an action Baustein (ADR-018).
 *
 * ## Status: dead path
 *
 * Neither end of this exchange runs today. `apiSendAliasMessage` (producer) and
 * `apiPatchMessage` (the button handler) both target `/service/messages/...`,
 * which no ingress rule routes to a backend, and UserService has no
 * `PATCH /messages/{id}` handler. Both call sites swallow their errors
 * silently, so the failure is invisible in the product — the message simply
 * never appears.
 *
 * These stories therefore document a **design reference**, not live behaviour.
 * Treat them as the visual answer to "what did an actionable system message
 * look like", and do not infer that pressing the buttons does anything.
 *
 * The three `…Sent`, `…Accepted`, `…Declined` variants resolve consultant names
 * out of `ConsultantListContext`, so they are wrapped in the shared context
 * shell rather than driven purely by args.
 */
const meta = {
	title: 'Components/Chat/ReassignMessage',
	tags: ['autodocs'],
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component:
					'Four states of consultant reassignment. **Dead path** — see the docblock; kept as the precedent for in-chat action buttons.'
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

export const RequestWithButtons: Story = {
	name: 'Request — accept / decline buttons',
	render: () => (
		<ReassignRequestMessage
			fromConsultantName="Karina P"
			toConsultantName="Jonas M"
			onClick={() => {
				/* no-op: the real handler targets an unrouted endpoint */
			}}
		/>
	),
	parameters: {
		docs: {
			description: {
				story: 'The advice seeker is asked to approve a change of counsellor. Both buttons are inert here **and in production** — the handler PATCHes an endpoint that is not served.'
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
			onClick={() => {}}
		/>
	),
	globals: phone390Globals,
	parameters: {
		...mobileParameters,
		docs: {
			description: {
				story: 'Two buttons plus a long name at 390px — the case where an action Baustein is most likely to break. Buttons should stack rather than shrink below a comfortable touch target.'
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
