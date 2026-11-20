import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { Box, Button, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { M3Snackbar } from './M3Snackbar';
import { M3Dialog } from '../m3Dialog/M3Dialog';

/**
 * The standing recovery notice (`yieldToOthers`, as `KeyBackupRecoveryPrompt`
 * uses it) next to a dialog. While the dialog is open the notice steps aside,
 * so it cannot rest above the dialog's buttons and take their clicks; it comes
 * back when the dialog closes (#2205).
 */
const NoticeAndDialog = ({ initiallyOpen }: { initiallyOpen: boolean }) => {
	const { t } = useTranslation();
	const [dialogOpen, setDialogOpen] = useState(initiallyOpen);
	return (
		<Box sx={{ minHeight: '100vh', p: 3 }}>
			<Typography sx={{ mb: 2, maxWidth: 540 }}>
				Seiteninhalt. Der Wiederherstellungs-Hinweis steht unten, bis
				ein Dialog aufgeht.
			</Typography>
			<Button variant="outlined" onClick={() => setDialogOpen(true)}>
				Dialog öffnen
			</Button>
			<M3Snackbar
				role="status"
				testId="standing-recovery-notice"
				message={t('encryption.passwordRecovery.needs-recovery-key')}
				action={{
					label: t('encryption.keyBackup.dialog.openVault'),
					onClick: () => undefined
				}}
				actionOnOwnLine
				onClose={() => undefined}
				closeLabel={t('encryption.keyBackup.snackbar.close')}
				yieldToOthers
			/>
			<M3Dialog
				open={dialogOpen}
				onClose={() => setDialogOpen(false)}
				title="Beratung wirklich beenden?"
				description="Der Verlauf bleibt erhalten. Neue Nachrichten sind danach nicht mehr möglich."
				actions={[
					{ label: 'Abbrechen', onClick: () => setDialogOpen(false) },
					{
						label: 'Beenden',
						onClick: () => setDialogOpen(false),
						primary: true
					}
				]}
			/>
		</Box>
	);
};

const meta = {
	title: 'Molecules/M3Snackbar/Yields to dialogs',
	component: NoticeAndDialog,
	parameters: { layout: 'fullscreen' },
	args: { initiallyOpen: false }
} satisfies Meta<typeof NoticeAndDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

const notice = () =>
	within(document.body).queryByTestId('standing-recovery-notice');

/** No dialog: the standing notice is shown. */
export const NoticeWithoutDialog: Story = {
	play: async () => {
		await waitFor(() => expect(notice()).toBeVisible());
	}
};

/** Dialog open: the notice is gone, nothing sits above the dialog's buttons. */
export const DialogOpenNoNotice: Story = {
	args: { initiallyOpen: true },
	play: async () => {
		const page = within(document.body);
		const dialog = await page.findByRole('dialog');
		// The dialog fades in; wait for it to settle.
		await waitFor(() => expect(dialog).toBeVisible());
		await waitFor(() => expect(notice()).toBeNull());
	}
};

/** Open the dialog, close it again: the notice comes back. */
export const NoticeReturnsAfterClose: Story = {
	play: async () => {
		const page = within(document.body);
		await userEvent.click(
			page.getByRole('button', { name: 'Dialog öffnen' })
		);
		const dialog = await page.findByRole('dialog');
		// The dialog fades in; wait for it to settle.
		await waitFor(() => expect(dialog).toBeVisible());
		await waitFor(() => expect(notice()).toBeNull());
		await userEvent.click(page.getByRole('button', { name: 'Abbrechen' }));
		await waitFor(() => expect(notice()).toBeVisible());
	}
};
