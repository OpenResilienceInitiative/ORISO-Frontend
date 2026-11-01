import { Meta, StoryObj } from '@storybook/react-vite';
import * as React from 'react';
import { useEffect, useRef } from 'react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { ActiveSessionContext, UserDataContext } from '../../globalState';
import { APP_ORISO_FIGMA_URL } from '../storybookDesignLinks';
import { resetCaseHandoverOperationStoreForTests } from '../caseHandover/caseHandoverOperationStore';
import { AskerInfoAssign } from './AskerInfoAssign';

const openOffer = {
	requestId: 501,
	sessionId: 41,
	status: 'PENDING_RECIPIENT_ACCEPTANCE',
	direction: 'PUSH',
	recipientConsultantId: 'recipient-1',
	canViewContent: true,
	clientConsentRequired: false,
	ownershipRevision: 7
};

const ownerStatus = {
	sessionId: 41,
	status: 'GRANTED',
	canViewContent: true,
	clientConsentRequired: false,
	ownershipRevision: 7,
	openOffer
};

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json' }
	});

/**
 * The owner opened the handover panel after a reload, so the offer made
 * earlier is still pending. Fetch is answered here and restored on unmount.
 */
const BackendStub = ({ children }: { children: React.ReactNode }) => {
	const restore = useRef<(() => void) | null>(null);
	if (!restore.current) {
		resetCaseHandoverOperationStoreForTests();
		const originalFetch = globalThis.fetch;
		globalThis.fetch = async (input, init) => {
			const url =
				typeof input === 'string'
					? input
					: input instanceof URL
						? input.toString()
						: input.url;
			if (url.endsWith('/case-handover/501/withdraw')) {
				return json({ ...openOffer, status: 'WITHDRAWN' });
			}
			if (url.endsWith('/sessions/41/case-handover')) {
				return json(ownerStatus);
			}
			if (url.endsWith('/sessions/41/case-handover/recipients')) {
				return json([
					{
						consultantId: 'recipient-1',
						displayName: 'Jonas Lehmann'
					}
				]);
			}
			if (url.endsWith('/case-handover/reasons')) {
				return json([
					{
						code: 'PLANNED_ABSENCE',
						label: 'Freistellung',
						clientConsentRequired: false
					}
				]);
			}
			return originalFetch(input, init);
		};
		restore.current = () => {
			globalThis.fetch = originalFetch;
		};
	}
	useEffect(() => () => restore.current?.(), []);
	return <>{children}</>;
};

const activeSession = {
	isGroup: false,
	consultant: { id: 'owner-1' },
	item: { id: 41, agencyId: 9 }
} as any;

const meta = {
	title: 'Organisms/AskerInfoAssign',
	component: AskerInfoAssign,
	tags: ['autodocs'],
	args: { showLegacyAssignment: false, handoverEnabled: true },
	decorators: [
		(Story) => (
			<BackendStub>
				<UserDataContext.Provider
					value={
						{
							userData: {
								userId: 'owner-1',
								grantedAuthorities: []
							}
						} as any
					}
				>
					<ActiveSessionContext.Provider
						value={{
							activeSession,
							reloadActiveSession: () => undefined
						}}
					>
						<div style={{ maxWidth: 420, padding: 16 }}>
							<Story />
						</div>
					</ActiveSessionContext.Provider>
				</UserDataContext.Provider>
			</BackendStub>
		)
	],
	parameters: {
		design: { type: 'figma', url: APP_ORISO_FIGMA_URL },
		docs: {
			description: {
				component:
					'Hand a consultation over to a colleague. While the offer is open the owner ' +
					'sees its state and can withdraw it, also after a reload.'
			}
		}
	}
} satisfies Meta<typeof AskerInfoAssign>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Offer made earlier, panel opened again: the offer can be taken back. */
export const PendingOfferCanBeWithdrawn: Story = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(
			await canvas.findByRole('button', {
				name: /offer\.open|Übergeben|Hand over/i
			})
		);
		await expect(
			await canvas.findByRole('button', {
				name: /offer\.withdraw|Angebot zurückziehen|Withdraw offer/i
			})
		).toBeInTheDocument();
	}
};

/** After the withdrawal the state says so and the button is gone. */
export const OfferWithdrawn: Story = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(
			await canvas.findByRole('button', {
				name: /offer\.open|Übergeben|Hand over/i
			})
		);
		await userEvent.click(
			await canvas.findByRole('button', {
				name: /offer\.withdraw|Angebot zurückziehen|Withdraw offer/i
			})
		);
		await waitFor(() =>
			expect(canvas.getByRole('status')).toHaveTextContent(
				/WITHDRAWN|zurückgezogen|withdrawn/i
			)
		);
		await expect(
			canvas.queryByRole('button', {
				name: /offer\.withdraw|Angebot zurückziehen|Withdraw offer/i
			})
		).toBeNull();
	}
};
