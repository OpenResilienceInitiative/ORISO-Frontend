import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useTranslation } from 'react-i18next';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import {
	DeletedAskerArchiveState,
	DeletedAskerNotice
} from './DeletedAskerNotice';

/**
 * ORISO-Frontend#1159: the main chat window of a deleted advice-seeker chat.
 * The backend does not record who deleted it, so the notice says only that
 * and when (Frank, 2026-11-17).
 */
const meta = {
	title: 'Components/Session/DeletedAskerNotice',
	component: DeletedAskerNotice,
	tags: ['autodocs'],
	parameters: { layout: 'fullscreen' }
} satisfies Meta<typeof DeletedAskerNotice>;
export default meta;

type Story = StoryObj<typeof meta>;

const Frame = ({
	initial = 'idle',
	deletedOn = '12. November 2026',
	onArchive,
	fail = false
}: {
	initial?: DeletedAskerArchiveState;
	deletedOn?: string | null;
	onArchive?: () => void;
	fail?: boolean;
}) => {
	const { t } = useTranslation();
	const [state, setState] = useState<DeletedAskerArchiveState>(initial);
	return (
		<div style={{ height: 560, maxWidth: 720 }}>
			<DeletedAskerNotice
				translate={t}
				deletedOn={deletedOn}
				archiveState={state}
				backPath="/sessions/consultant/sessionView"
				onArchive={
					state === 'archived'
						? undefined
						: () => {
								onArchive?.();
								setState('busy');
								setTimeout(
									() =>
										setState(fail ? 'failed' : 'archived'),
									50
								);
							}
				}
			/>
		</div>
	);
};

const baseArgs = {
	translate: (key: string) => key,
	deletedOn: '12. November 2026',
	archiveState: 'idle' as const,
	backPath: '/sessions/consultant/sessionView'
};

export const Default: Story = {
	args: baseArgs,
	render: () => <Frame />
};

/** A chat whose advice seeker is only marked for deletion: no date yet. */
export const DateUnknown: Story = {
	args: baseArgs,
	render: () => <Frame deletedOn={null} />
};

export const InTheArchive: Story = {
	args: baseArgs,
	render: () => <Frame initial="archived" />
};

export const ArchiveFailed: Story = {
	args: baseArgs,
	render: () => <Frame initial="failed" />
};

export const OnPhone: Story = {
	args: baseArgs,
	globals: { viewport: { value: 'phone390' } },
	render: () => <Frame />
};

/** One click on the existing archive action moves it into the archive. */
export const ArchivesTheEntry: Story = {
	args: { ...baseArgs, onArchive: fn() },
	render: (args) => <Frame onArchive={args.onArchive} />,
	play: async ({ args, canvasElement }) => {
		const canvas = within(canvasElement);
		await waitFor(() =>
			expect(
				canvas.getByText(
					/Dieser Chat wurde gelöscht|This chat was deleted/
				)
			).toBeVisible()
		);
		await userEvent.click(
			canvas.getByRole('button', { name: /Archivieren|Archive/ })
		);
		await expect(args.onArchive).toHaveBeenCalledTimes(1);
		await waitFor(() =>
			expect(
				canvas.queryByRole('button', { name: /Archivieren|Archive/ })
			).not.toBeInTheDocument()
		);
		await expect(
			canvas.getByText(
				/Dieser Eintrag ist im Archiv|This entry is in the archive/
			)
		).toBeVisible();
	}
};

/** A failed request keeps the action and says so. */
export const ArchiveFailsVisibly: Story = {
	args: baseArgs,
	render: () => <Frame fail />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(
			canvas.getByRole('button', { name: /Archivieren|Archive/ })
		);
		await expect(await canvas.findByRole('alert')).toBeVisible();
		await expect(
			canvas.getByRole('button', { name: /Archivieren|Archive/ })
		).toBeEnabled();
	}
};
