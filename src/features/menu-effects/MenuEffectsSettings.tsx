import React from 'react';
import { FormControlLabel, Switch, Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useMenuEffects } from './useMenuEffects';

export const MenuEffectsSettings = () => {
	const { t } = useTranslation();
	const { enabled, setEnabled } = useMenuEffects();
	return (
		<Stack spacing={1}>
			<Typography variant="h6" component="h2">
				{t('menuEffects.title')}
			</Typography>
			<FormControlLabel
				control={
					<Switch
						checked={enabled}
						onChange={(_, checked) => setEnabled(checked)}
					/>
				}
				label={t('menuEffects.label')}
			/>
			<Typography variant="body2" color="text.secondary">
				{t('menuEffects.description')}
			</Typography>
			<Typography variant="body2" color="text.secondary">
				{t('menuEffects.scope')}
			</Typography>
		</Stack>
	);
};
