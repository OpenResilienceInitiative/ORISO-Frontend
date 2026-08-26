import React, { useContext, useEffect, useState } from 'react';
import { apiPutConsultantData } from '../../api';
import { UserDataContext } from '../../globalState';
import { Button, ButtonItem, BUTTON_TYPES } from '../button/Button';
import { OrisoMultiSelect } from '../form/OrisoSelect';
import { Headline } from '../headline/Headline';
import { Text } from '../text/Text';

import './profile.styles';
import { isUniqueLanguage } from './profileHelpers';
import { LanguagesContext } from '../../globalState/provider/LanguagesProvider';
import { useTranslation } from 'react-i18next';
import { SelectChangeEvent } from '@mui/material/Select';

export const ConsultantSpokenLanguages: React.FC = () => {
	const { t: translate } = useTranslation();
	const { userData, reloadUserData } = useContext(UserDataContext);
	const { fixed: fixedLanguages, spoken: spokenLanguages } =
		useContext(LanguagesContext);

	const [hasError, setHasError] = useState(false);
	const [selectedLanguages, setSelectedLanguages] = useState(fixedLanguages);
	const [previousLanguages, setPreviousLanguages] = useState(fixedLanguages);

	const cancelEditButton: ButtonItem = {
		label: translate('profile.data.edit.button.cancel'),
		type: BUTTON_TYPES.LINK
	};

	const saveEditButton: ButtonItem = {
		label: translate('profile.data.edit.button.save'),
		type: BUTTON_TYPES.LINK
	};

	useEffect(() => {
		setSelectedLanguages([...userData.languages]);
		setPreviousLanguages([...userData.languages]);
	}, [userData]);

	const selectHandler = (event: SelectChangeEvent<string[]>) => {
		const value = event.target.value;
		const selectedValues =
			typeof value === 'string' ? value.split(',') : value;
		const newLanguages = [
			...fixedLanguages,
			...selectedValues.filter(
				(language) => !fixedLanguages.includes(language)
			)
		];

		setSelectedLanguages(newLanguages.filter(isUniqueLanguage));
	};

	const cancelHandler = () => {
		setSelectedLanguages(previousLanguages);
		setHasError(false);
	};

	const saveHandler = () => {
		apiPutConsultantData({
			email: userData.email.trim(),
			firstname: userData.firstName.trim(),
			lastname: userData.lastName.trim(),
			// The generated DTO narrows languages to the LanguageCode union;
			// the picker works with plain ISO 639-1 strings.
			languages: selectedLanguages.filter(
				isUniqueLanguage
			) as UserService.Schemas.LanguageCode[]
		})
			.then(reloadUserData)
			.then(() => {
				setHasError(false);
			})
			.catch(() => {
				setHasError(true);
			});
	};

	const availableLanguages = [...fixedLanguages, ...spokenLanguages].filter(
		isUniqueLanguage
	);

	const languageOptions = availableLanguages.map((language) => {
		return {
			value: language,
			label: translate(`languages.${language}`),
			disabled: fixedLanguages.indexOf(language) !== -1
		};
	});

	return (
		<div className="spokenLanguages">
			<div className="profile__content__title">
				<Headline
					text={translate('profile.spokenLanguages.title')}
					semanticLevel="5"
				/>

				<Text
					text={translate('profile.spokenLanguages.info')}
					type="standard"
					className="tertiary"
				/>
			</div>
			<div className="spokenLanguages__languageSelect">
				<OrisoMultiSelect
					id="spoken-languages-select"
					label={translate('profile.spokenLanguages.title')}
					options={languageOptions}
					value={selectedLanguages}
					searchable
					onChange={selectHandler}
					error={hasError}
					helperText={
						hasError
							? translate(
									'profile.functions.spokenLanguages.saveError'
								)
							: undefined
					}
				/>

				{JSON.stringify(previousLanguages) !==
					JSON.stringify(selectedLanguages) && (
					<div className="spokenLanguages__buttons">
						<Button
							item={cancelEditButton}
							buttonHandle={cancelHandler}
						/>
						<Button
							item={saveEditButton}
							buttonHandle={saveHandler}
						/>
					</div>
				)}
			</div>
		</div>
	);
};
