import React from 'react';
import { Box, Chip, Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { M3Dialog } from '../m3Dialog/M3Dialog';

export interface GroupChatInfoDialogProps {
	title: string;
	active?: boolean;
	onClose: () => void;
	settings: Array<{ label: string; value: React.ReactNode }>;
	participants: React.ReactNode;
	invitation?: React.ReactNode;
	actions?: React.ReactNode;
	editAction?: React.ReactNode;
}

/** The same information hierarchy is used by the routed dialog and Storybook. */
export const GroupChatInfoDialog = ({
	title,
	active = false,
	onClose,
	settings,
	participants,
	invitation,
	actions,
	editAction
}: GroupChatInfoDialogProps) => {
	const { t } = useTranslation();
	const sectionSx = {
		p: 2,
		borderRadius: 3,
		bgcolor: 'var(--m3-surface-container-low)',
		minWidth: 0
	};
	return (
		<M3Dialog
			title={t('groupChat.info.headline')}
			description={title}
			onClose={onClose}
			closeLabel={t('app.close')}
			width={880}
		>
			<Stack spacing={2}>
				{(active || actions) && (
					<Stack
						direction="row"
						spacing={1}
						useFlexGap
						flexWrap="wrap"
						alignItems="center"
					>
						{active && (
							<Chip
								label={t('groupChat.listItem.activeLabel')}
								size="small"
							/>
						)}
						{actions}
					</Stack>
				)}
				<Box
					sx={{
						display: 'grid',
						gridTemplateColumns: {
							xs: 'minmax(0, 1fr)',
							md: 'minmax(0, 1fr) minmax(0, 1fr)'
						},
						gap: 2
					}}
				>
					<Stack spacing={2} sx={{ minWidth: 0 }}>
						<Box component="section" sx={sectionSx}>
							<Typography
								component="h3"
								variant="subtitle1"
								sx={{ mb: 2 }}
							>
								{t('groupChat.info.subscribers.headline')}
							</Typography>
							{participants}
						</Box>
						{invitation && (
							<Box component="section" sx={sectionSx}>
								{invitation}
							</Box>
						)}
					</Stack>
					<Box component="section" sx={sectionSx}>
						<Typography
							component="h3"
							variant="subtitle1"
							sx={{ mb: 2 }}
						>
							{t('groupChat.info.settings.headline')}
						</Typography>
						<Stack component="dl" spacing={2} sx={{ m: 0 }}>
							{settings.map(({ label, value }) => (
								<Box key={label}>
									<Typography
										component="dt"
										variant="caption"
										color="text.secondary"
									>
										{label}
									</Typography>
									<Typography
										component="dd"
										variant="body2"
										sx={{ m: 0, overflowWrap: 'anywhere' }}
									>
										{value || '—'}
									</Typography>
								</Box>
							))}
						</Stack>
						{editAction && <Box sx={{ mt: 2 }}>{editAction}</Box>}
					</Box>
				</Box>
			</Stack>
		</M3Dialog>
	);
};
