import React from 'react';
import { Stack, Typography } from '@mui/material';
import { Switch } from '../../components/Switch';
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
			<Switch
				checked={enabled}
				onChange={setEnabled}
				titleKey="menuEffects.label"
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
