import * as React from 'react';
import { useMemo } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { Box } from '@mui/material';
import { JoinRequestSnackbar } from './JoinRequestSnackbar';
import { JoinRequestDialog } from './JoinRequestDialog';
import { JoinRequestCenter } from './JoinRequestCenter';
import { M3SnackbarHost } from '../../m3Snackbar/M3SnackbarHost';
import { createSnackbarStack } from '../../m3Snackbar/snackbarStack';
import { createFakeJoinRequestTransport } from './fakeJoinRequestTransport';
import {
	KNOCK_STORY_NOW,
	knockRequest,
	knockRequesters
} from './__storybook__/joinRequestFixtures';
import {
	desktop1440Globals,
	phone390Globals
} from '../../message/messageStoryShell';

/**
 * #1499 item 14 — the child variant of the stacked snackbar: somebody is
 * knocking. Frank (23.09.2026): "Hinweis ist super und dann aber auch
 * Funktion mittels Snackbar … Für aktive Berater/Moderatoren, dass sie die
 * Person auch reinlassen. Bitte gebe dabei ein paar Infos".
 */
const meta = {
	title: 'Molecules/M3Snackbar/Join request',
	component: JoinRequestSnackbar,
	tags: ['autodocs'],
	args: {
		request: knockRequest(knockRequesters.anna, { id: 1, minutesAgo: 3 }),
		now: KNOCK_STORY_NOW,
		onAdmit: fn(),
		onDecline: fn(),
		onDetails: fn()
	},
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component:
					'Kind-Variante der Snackbar: jemand klopft an einen Gesprächskreis. Gleiche Fläche wie `M3Snackbar` (Inverse-Rollen, Elevation 3), reichere Anatomie: wer (Avatar, Name), woher (Berater:in · Beratungsstelle · Träger), wie (über den Einladungslink) und wann — und die Entscheidung direkt: „Reinlassen" (als Teilnehmende:r), „Ablehnen", „Details" öffnet das Popup mit allen Angaben und der Wahl der Rolle. M3 erlaubt einer Snackbar eine Aktion; hier sind es bewusst drei, damit die Moderation im laufenden Gespräch jemanden hereinlassen kann, ohne es zu verlassen.'
			}
		}
	},
	decorators: [
		(Story) => (
			<Box
				sx={{
					minHeight: '100vh',
					p: 3,
					backgroundColor: 'var(--m3-surface-container)'
				}}
			>
				<Box sx={{ maxWidth: 368 }}>
					<Story />
				</Box>
			</Box>
		)
	]
} satisfies Meta<typeof JoinRequestSnackbar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Same Träger, other Beratungsstelle — the common case. */
export const Snackbar: Story = {
	name: 'Snackbar · same Träger',
	globals: desktop1440Globals,
	play: async ({ args, canvas }) => {
		const card = canvas.getByRole('group', { name: 'Anna Berg' });
		await expect(card).toHaveTextContent(
			'möchte in „HIV und Aids“ dazukommen'
		);
		await expect(card).toHaveTextContent(
			'Berater:in · Suchtberatung Köln-Nord · Caritasverband Köln'
		);
		await expect(card).toHaveTextContent(
			'über den Einladungslink · vor 3 Min.'
		);
		await userEvent.click(
			canvas.getByRole('button', { name: 'Reinlassen' })
		);
		await userEvent.click(canvas.getByRole('button', { name: 'Ablehnen' }));
		await userEvent.click(canvas.getByRole('button', { name: 'Details' }));
		await expect(args.onAdmit).toHaveBeenCalledTimes(1);
		await expect(args.onDecline).toHaveBeenCalledTimes(1);
		await expect(args.onDetails).toHaveBeenCalledTimes(1);
	}
};

/** Another Träger, a long Beratungsstelle name: the origin line wraps. */
export const OtherTraeger: Story = {
	name: 'Snackbar · other Träger, long names',
	globals: desktop1440Globals,
	args: {
		request: knockRequest(knockRequesters.yusuf, { id: 4, minutesAgo: 0 })
	},
	play: async ({ canvas }) => {
		await expect(
			canvas.getByRole('group', { name: 'Yusuf Demir-Hoffmann' })
		).toHaveTextContent('gerade eben');
	}
};

/** A decision is on its way: both decisions grey out, nothing disappears. */
export const Busy: Story = {
	name: 'Snackbar · deciding',
	globals: desktop1440Globals,
	args: { busy: true },
	play: async ({ canvas }) => {
		await expect(
			canvas.getByRole('button', { name: 'Reinlassen' })
		).toBeDisabled();
		await expect(
			canvas.getByRole('button', { name: 'Ablehnen' })
		).toBeDisabled();
		await expect(
			canvas.getByRole('button', { name: 'Details' })
		).toBeEnabled();
	}
};

const dialogRender = (
	request = knockRequest(knockRequesters.anna, { id: 1, minutesAgo: 3 })
) =>
	function DialogStory(args: {
		onAdmit: (...values: unknown[]) => void;
		onDecline: () => void;
	}) {
		return (
			<JoinRequestDialog
				open
				request={request}
				now={KNOCK_STORY_NOW}
				onAdmit={args.onAdmit}
				onDecline={args.onDecline}
				onClose={() => undefined}
			/>
		);
	};

const body = () => within(document.body);

/** The popup for the owner: full picture, both roles on offer. */
export const DetailsPopupOwner: Story = {
	name: 'Popup · owner admits as co-moderator',
	globals: desktop1440Globals,
	render: (args) => dialogRender()(args),
	play: async ({ args }) => {
		const dialog = await body().findByRole('dialog', {
			name: 'Anna Berg möchte dazukommen'
		});
		const scope = within(dialog);
		await expect(dialog).toHaveTextContent('Suchtberatung Köln-Nord');
		await expect(dialog).toHaveTextContent('andere Beratungsstelle');
		await expect(dialog).toHaveTextContent('Caritasverband Köln');
		await expect(dialog).toHaveTextContent('vor 3 Min.');
		await userEvent.click(
			scope.getByRole('radio', { name: 'Co-Moderation' })
		);
		await userEvent.click(
			scope.getByRole('button', { name: 'Reinlassen' })
		);
		await expect(args.onAdmit).toHaveBeenCalledWith('CO_MODERATOR');
	}
};

/** A co-moderator sees co-moderation, greyed out, with the reason. */
export const DetailsPopupCoModerator: Story = {
	name: 'Popup · co-moderator (co-moderation disabled)',
	globals: desktop1440Globals,
	render: (args) =>
		dialogRender(
			knockRequest(knockRequesters.anna, {
				id: 1,
				minutesAgo: 3,
				viewerRole: 'CO_MODERATOR'
			})
		)(args),
	play: async ({ args }) => {
		const dialog = await body().findByRole('dialog');
		const scope = within(dialog);
		await expect(
			scope.getByRole('radio', { name: 'Co-Moderation' })
		).toBeDisabled();
		await expect(dialog).toHaveTextContent(
			'Co-Moderation vergibt nur die Leitung des Gesprächskreises.'
		);
		await userEvent.click(scope.getByRole('button', { name: 'Ablehnen' }));
		await expect(args.onDecline).toHaveBeenCalledTimes(1);
	}
};

/** Another Träger: may be let in as participant, never as co-moderator. */
export const DetailsPopupOtherTraeger: Story = {
	name: 'Popup · other Träger',
	globals: desktop1440Globals,
	render: (args) =>
		dialogRender(
			knockRequest(knockRequesters.mira, { id: 3, minutesAgo: 2 })
		)(args),
	play: async () => {
		const dialog = await body().findByRole('dialog');
		await expect(dialog).toHaveTextContent('anderer Träger');
		await expect(
			within(dialog).getByRole('radio', { name: 'Co-Moderation' })
		).toBeDisabled();
		await expect(dialog).toHaveTextContent(
			'Co-Moderation ist Fachkräften des eigenen Trägers vorbehalten.'
		);
	}
};

export const DetailsPopupPhone: Story = {
	name: 'Popup · 390',
	globals: phone390Globals,
	render: (args) => dialogRender()(args),
	play: async () => {
		const dialog = await body().findByRole('dialog');
		const actions = within(dialog).getAllByRole('button', {
			name: /Reinlassen|Ablehnen/
		});
		const [decline, admit] = actions.map((button) =>
			button.getBoundingClientRect()
		);
		// Two short actions stay one row on a phone (dialog rule 2).
		await expect(Math.abs(decline.top - admit.top)).toBeLessThan(2);
	}
};

/** Snackbar → Details → Escape: the popup closes and nothing was decided. */
export const SnackbarToPopupAndBack: Story = {
	name: 'Flow · details popup, Escape returns focus',
	globals: desktop1440Globals,
	render: function Flow() {
		const stack = useMemo(() => createSnackbarStack(), []);
		const transport = useMemo(() => {
			const fake = createFakeJoinRequestTransport();
			fake.setPending([
				knockRequest(knockRequesters.anna, { id: 1, minutesAgo: 3 })
			]);
			return fake;
		}, []);
		return (
			<>
				<M3SnackbarHost stack={stack} />
				<JoinRequestCenter
					transport={transport}
					stack={stack}
					now={KNOCK_STORY_NOW}
				/>
			</>
		);
	},
	play: async () => {
		const details = await body().findByRole('button', { name: 'Details' });
		await userEvent.click(details);
		await body().findByRole('dialog');

		await userEvent.keyboard('{Escape}');

		await waitFor(() => expect(body().queryByRole('dialog')).toBeNull());
		await waitFor(() =>
			expect(
				body().getByRole('button', { name: 'Details' })
			).toHaveFocus()
		);
		await expect(
			body().getAllByTestId('join-request-snackbar')
		).toHaveLength(1);
	}
};
