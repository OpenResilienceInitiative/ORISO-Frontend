import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { CaseHandoverReadOnlyNotice } from './CaseHandoverReadOnlyNotice';
import './session.styles.scss';

const meta: Meta<typeof CaseHandoverReadOnlyNotice> = {
	title: 'Organisms/CaseHandover/CaseHandoverReadOnlyNotice',
	component: CaseHandoverReadOnlyNotice,
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component:
					'Takes the composer\'s place for a colleague with **co-access** ("advice needed" handover): they can read the case until the grant expires, but never write to the advice seeker. `expiresAt` is naive UTC from the server and shown in local time.'
			}
		}
	}
};

export default meta;
type Story = StoryObj<typeof meta>;

export const WithExpiry: Story = {
	args: { expiresAt: '2026-09-25T07:36:21' },
	play: async ({ canvasElement }) => {
		const notice = within(canvasElement).getByRole('status');
		await expect(notice.textContent).toMatch(/\d{2}:\d{2}/);
	}
};

/** A legacy grant without a stored expiry. */
export const WithoutExpiry: Story = {};

/** The server allows the one extension: it adds the granted duration to the current end. */
export const CanExtend: Story = {
	args: {
		expiresAt: '2026-09-25T07:36:21',
		sessionId: 5,
		canExtend: true,
		onStatusChange: fn()
	},
	play: async ({ canvasElement }) => {
		const button = within(canvasElement).getByRole('button');
		await expect(button).toBeEnabled();
	}
};

/**
 * Click-through: the server answers with the end moved by the granted 180
 * minutes and no second extension, so the new time shows and the button goes.
 */
export const AfterExtend: Story = {
	args: { expiresAt: '2026-09-25T07:36:21', sessionId: 5, canExtend: true },
	beforeEach: () => {
		const originalFetch = globalThis.fetch;
		globalThis.fetch = async (
			input: RequestInfo | URL,
			init?: RequestInit
		) =>
			String(input instanceof Request ? input.url : input).endsWith(
				'/sessions/5/case-handover/extend'
			)
				? new Response(
						JSON.stringify({
							sessionId: 5,
							status: 'GRANTED',
							canViewContent: true,
							clientConsentRequired: false,
							accessType: 'CO_ACCESS',
							auditOutcome: 'ACCESS_EXTENDED',
							expiresAt: '2026-09-25T10:36:21',
							canExtend: false
						}),
						{
							status: 200,
							headers: { 'content-type': 'application/json' }
						}
					)
				: originalFetch(input, init);
		return () => {
			globalThis.fetch = originalFetch;
		};
	},
	render: function AfterExtendRender(args) {
		const [status, setStatus] = useState<{
			expiresAt?: string;
			canExtend?: boolean;
		}>(args);
		return (
			<CaseHandoverReadOnlyNotice
				{...args}
				expiresAt={status.expiresAt}
				canExtend={status.canExtend}
				onStatusChange={setStatus}
			/>
		);
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(canvas.getByRole('button'));
		await waitFor(() => expect(canvas.queryByRole('button')).toBeNull());
	}
};
