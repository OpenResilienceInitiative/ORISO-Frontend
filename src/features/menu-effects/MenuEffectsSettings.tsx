import React from 'react';
import { Stack, Typography } from '@mui/material';
import { Switch } from '../../components/Switch';
import { useTranslation } from 'react-i18next';
import { Headline } from '../../components/headline/Headline';
import { useMenuEffects } from './useMenuEffects';

export const MenuEffectsSettings = () => {
	const { t } = useTranslation();
	const { enabled, setEnabled } = useMenuEffects();
	return (
		<Stack spacing={1}>
			<div className="profile__content__title">
				<Headline text={t('menuEffects.title')} semanticLevel="5" />
			</div>
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
