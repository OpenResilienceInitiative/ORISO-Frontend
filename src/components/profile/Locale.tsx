import React, { useContext } from 'react';
import { Headline } from '../headline/Headline';
import { Text } from '../text/Text';
import { useTranslation } from 'react-i18next';
import { ReactComponent as LanguageIcon } from '../../resources/img/icons/language_filled.svg';

import './profile.styles';
import { OrisoSelect } from '../form/OrisoSelect';
import { LocaleContext } from '../../globalState';
import { SelectChangeEvent } from '@mui/material/Select';

export const Locale = () => {
	const { t: translate } = useTranslation(['common', 'languages']);
	const { locale, setLocale, selectableLocales } = useContext(LocaleContext);

	const languageOptions = selectableLocales.map((lng) => ({
		label: translate([lng, lng], { ns: 'languages' }),
		value: lng
	}));

	const handleLanguageSelect = (event: SelectChangeEvent<string>) => {
		setLocale(event.target.value);
	};

	return (
		<div className="appLanguage">
			<div className="profile__content__title">
				<div className="profile__content__header">
					<LanguageIcon className="icon" />
					<Headline
						text={translate('profile.appLanguage.title')}
						semanticLevel="5"
					/>
				</div>
				<Text
					text={translate('profile.appLanguage.info')}
					type="standard"
					className="tertiary"
				/>
			</div>
			<OrisoSelect
				id="languageSelect"
				label={translate('profile.appLanguage.title')}
				options={languageOptions}
				value={locale}
				onChange={handleLanguageSelect}
			/>
		</div>
	);
};
