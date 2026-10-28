import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from 'storybook/test';
import { DirectLink } from '../conversationCreate/directLink/directLink';
import { DirectLinkShareDialog } from '../conversationCreate/directLink/DirectLinkShareDialog';
import { DirectLinkEditDialog } from './DirectLinkEditDialog';
import { MyDirectLinksView } from './MyDirectLinksView';
import { DirectLinksLoadState } from './useMyDirectLinks';

const SAMPLE_LINKS: DirectLink[] = [
	{
		id: '1',
		name: 'Flyer Schule',
		topic: 'Schulden',
		topicId: 3,
		medium: 'VIDEO',
		temporary: true,
		active: true,
		url: 'https://app.oriso.org/invite/Ab3dE6gH'
	},
	{
		id: '2',
		name: 'Plakat Rathaus',
		topic: 'Sucht',
		topicId: 4,
		medium: 'CHAT',
		temporary: false,
		active: true,
		url: 'https://app.oriso.org/invite/Zy8xW6vU'
	},
	{
		id: '3',
		name: 'Telefonsprechstunde',
		topic: 'Schulden',
		topicId: 3,
		medium: 'AUDIO',
		temporary: true,
		active: false,
		url: 'https://app.oriso.org/invite/Qr5sT2uV'
	}
];

const TOPICS = [
	{ value: '3', label: 'Schulden' },
	{ value: '4', label: 'Sucht' }
];

/** Same composition as MyDirectLinksPanel, with local state instead of UserService. */
const PageStory = ({
	initial,
	state = 'ready',
	fullScreen = false
}: {
	initial: DirectLink[];
	state?: DirectLinksLoadState;
	fullScreen?: boolean;
}) => {
	const [links, setLinks] = useState(initial);
	const [qr, setQr] = useState<DirectLink | null>(null);
	const [editing, setEditing] = useState<DirectLink | null>(null);
	return (
		<div className="myDirectLinksPage" style={{ minHeight: 640 }}>
			<MyDirectLinksView
				state={state}
				links={links}
				onToggle={(id, active) =>
					setLinks((all) =>
						all.map((link) =>
							link.id === id ? { ...link, active } : link
						)
					)
				}
				onShowQr={setQr}
				onEdit={setEditing}
				onCreate={() => undefined}
				onRetry={() => undefined}
				onCopy={() => undefined}
			/>
			{qr && (
				<DirectLinkShareDialog
					open
					link={qr}
					onClose={() => setQr(null)}
					fullScreen={fullScreen}
					onCopy={() => undefined}
				/>
			)}
			<DirectLinkEditDialog
				link={editing}
				topics={TOPICS}
				fullScreen={fullScreen}
				onClose={() => setEditing(null)}
				onSave={(link, update) => {
					const topic = TOPICS.find(
						(option) => option.value === String(update.topicId)
					);
					setLinks((all) =>
						all.map((item) =>
							item.id === link.id
								? {
										...item,
										...update,
										topicId: update.topicId ?? item.topicId,
										topic: topic?.label ?? item.topic
									}
								: item
						)
					);
					setEditing(null);
				}}
			/>
		</div>
	);
};

const meta: Meta<typeof PageStory> = {
	title: 'DirectLinks/My direct links (clock entry)',
	component: PageStory,
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component:
					'#1894: the clock navigation entry "Meine Direktlinks". Copy, QR, on/off and edit (name, topic, temporary switch). Links are created only in "Create chat"; the round button leads there. Settings → "Meine Links" shows the same list. Sample data; the app reads UserService GET/PATCH /users/directlinks.'
			}
		}
	}
};
export default meta;
type Story = StoryObj<typeof PageStory>;

export const WithLinks: Story = {
	name: 'Links (desktop)',
	args: { initial: SAMPLE_LINKS },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const tile = (await canvas.findByText('Flyer Schule')).closest('li')!;
		await userEvent.click(within(tile).getByRole('switch'));
		await expect(tile.className).toContain('directLinkTile--off');
		await userEvent.click(within(tile).getByRole('switch'));
		await expect(tile.className).not.toContain('directLinkTile--off');
	}
};

export const Empty: Story = {
	name: 'Empty — like the old "Terminübersicht"',
	args: { initial: [] },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			await canvas.findByTestId('direct-links-empty')
		).toBeTruthy();
		await expect(canvas.getByTestId('direct-links-create')).toBeTruthy();
	}
};

export const EditLink: Story = {
	name: 'Edit name, topic and temporary switch',
	args: { initial: SAMPLE_LINKS },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(
			await canvas.findByRole('button', {
				name: /Flyer Schule bearbeiten/
			})
		);
		const dialog = within(document.body).getByTestId(
			'direct-link-edit-dialog'
		);
		const name = within(dialog).getByLabelText('Name');
		await userEvent.clear(name);
		await userEvent.type(name, 'Flyer Gymnasium');
		const save = within(dialog).getByTestId('direct-link-edit-save');
		await expect(save).toBeEnabled();
		await userEvent.click(save);
		await expect(await canvas.findByText('Flyer Gymnasium')).toBeTruthy();
		await expect(
			within(document.body).queryByTestId('direct-link-edit-dialog')
		).toBeNull();
	}
};

export const Loading: Story = {
	args: { initial: [], state: 'loading' }
};

export const LoadFailed: Story = {
	name: 'Load failed',
	args: { initial: [], state: 'failed' }
};

export const Phone: Story = {
	name: 'Links (phone 390)',
	args: { initial: SAMPLE_LINKS, fullScreen: true },
	parameters: { viewport: { defaultViewport: 'mobile1' } },
	decorators: [
		(StoryComponent) => (
			<div style={{ maxWidth: 390 }}>
				<StoryComponent />
			</div>
		)
	]
};
