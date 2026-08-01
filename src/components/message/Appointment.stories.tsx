import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import { ALIAS_MESSAGE_TYPES } from '../../api/apiSendAliasMessage';
import { Appointment } from './Appointment';
import {
	mobileParameters,
	withMessageShell,
	type MessageStoryParameters
} from './messageStoryShell';
import './message.styles.scss';

/**
 * The appointment card. Four alias message types share one component and one
 * payload shape; the type selects the wording (set / cancelled / rescheduled /
 * initial appointment defined).
 *
 * Note the API: `data` is a **JSON string**, parsed unguarded with
 * `JSON.parse` at render time, so malformed data throws inside render rather
 * than degrading. There is deliberately no story for that case — it would only
 * ever render Storybook's error boundary. It is noted here because a backend
 * payload change would surface as a blank conversation, not as an error.
 *
 * Like the other alias-based messages, this path is currently not reachable —
 * see `ReassignMessage.stories.tsx` for the routing detail.
 */
const meta = {
	title: 'Components/Chat/Appointment',
	component: Appointment,
	tags: ['autodocs'],
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component:
					'Appointment card for the four appointment alias types. `data` is a JSON string; `messageType` picks the wording. Times are converted from UTC to local, so the rendered hour depends on the viewer’s timezone.'
			}
		}
	},
	decorators: [
		(Story, ctx) =>
			withMessageShell(Story, {
				parameters: ctx.parameters as MessageStoryParameters
			})
	]
} satisfies Meta<typeof Appointment>;

export default meta;
type Story = StoryObj<typeof meta>;

const appointment = (overrides: Record<string, unknown> = {}) =>
	JSON.stringify({
		title: 'Beratungstermin',
		user: 'sanftes Alpaka Mika',
		counselor: 'Karina P',
		date: '2026-08-12T09:00:00.000Z',
		duration: 50,
		location: 'Video',
		...overrides
	});

export const Set: Story = {
	name: 'Appointment set',
	args: {
		data: appointment(),
		messageType: ALIAS_MESSAGE_TYPES.APPOINTMENT_SET
	}
};

export const Cancelled: Story = {
	name: 'Appointment cancelled',
	args: {
		data: appointment(),
		messageType: ALIAS_MESSAGE_TYPES.APPOINTMENT_CANCELLED
	}
};

export const Rescheduled: Story = {
	name: 'Appointment rescheduled',
	args: {
		data: appointment({ date: '2026-08-19T13:30:00.000Z' }),
		messageType: ALIAS_MESSAGE_TYPES.APPOINTMENT_RESCHEDULED
	}
};

export const InitialAppointmentDefined: Story = {
	name: 'Initial appointment defined',
	args: {
		data: appointment(),
		messageType: ALIAS_MESSAGE_TYPES.INITIAL_APPOINTMENT_DEFINED
	}
};

export const WithNote: Story = {
	name: 'With a note (expandable)',
	args: {
		data: appointment({
			note: 'Bitte bringen Sie, wenn möglich, Ihre Unterlagen mit. Falls Ihnen der Termin nicht passt, melden Sie sich gern vorher.'
		}),
		messageType: ALIAS_MESSAGE_TYPES.APPOINTMENT_SET
	},
	parameters: {
		docs: {
			description: {
				story: 'The note is behind an expand toggle. Collapsed is the default state — click to expand.'
			}
		}
	}
};

export const LongTitleAndNames: Story = {
	name: 'Long title and generated name',
	args: {
		data: appointment({
			title: 'Ausführliches Erstgespräch zur Klärung der weiteren Begleitung',
			user: 'außerordentlich nachdenkliches Schnabeltier Alexandra'
		}),
		messageType: ALIAS_MESSAGE_TYPES.APPOINTMENT_SET
	}
};

export const Mobile: Story = {
	name: 'Mobile (390px) — with note',
	args: {
		data: appointment({
			note: 'Bitte bringen Sie, wenn möglich, Ihre Unterlagen mit.',
			user: 'außerordentlich nachdenkliches Schnabeltier Alexandra'
		}),
		messageType: ALIAS_MESSAGE_TYPES.APPOINTMENT_SET
	},
	parameters: mobileParameters
};
