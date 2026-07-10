import * as React from 'react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiTranslateGroupChatAuthorContent } from '../../api/apiGroupChatAuthorTranslation';
import {
	applyGroupChatAuthorTranslations,
	buildGroupChatAuthorTranslationRequest,
	GroupChatAuthorContentDraft
} from './groupChatAuthorContent';

interface GroupChatAuthorContentFieldsProps {
	activeLanguages: string[];
	value: GroupChatAuthorContentDraft;
	onChange: (value: GroupChatAuthorContentDraft) => void;
}

export const GroupChatAuthorContentFields = ({
	activeLanguages,
	value,
	onChange
}: GroupChatAuthorContentFieldsProps) => {
	const { t } = useTranslation();
	const languages = useMemo(
		() =>
			Array.from(
				new Set(
					activeLanguages.map((language) => language.split('-')[0])
				)
			),
		[activeLanguages]
	);
	const [selectedLanguage, setSelectedLanguage] = useState(
		languages.includes(value.sourceLanguage)
			? value.sourceLanguage
			: languages[0] || value.sourceLanguage
	);
	const [isTranslating, setIsTranslating] = useState(false);
	const [translationError, setTranslationError] = useState(false);
	const rules = value.groupChatRulesTranslations[selectedLanguage] || [''];

	const updateHint = (hintMessage: string) =>
		onChange({
			...value,
			hintMessageTranslations: {
				...value.hintMessageTranslations,
				[selectedLanguage]: hintMessage
			}
		});

	const updateRules = (nextRules: string[]) =>
		onChange({
			...value,
			groupChatRulesTranslations: {
				...value.groupChatRulesTranslations,
				[selectedLanguage]: nextRules
			}
		});

	const translateContent = async () => {
		const request = buildGroupChatAuthorTranslationRequest({
			...value,
			activeLanguages: languages
		});
		if (
			request.targetLangs.length === 0 ||
			Object.values(request.texts).every((text) => !text.trim())
		) {
			return;
		}
		setIsTranslating(true);
		setTranslationError(false);
		try {
			const response = await apiTranslateGroupChatAuthorContent(request);
			onChange(
				applyGroupChatAuthorTranslations(value, response.translations)
			);
		} catch {
			setTranslationError(true);
		} finally {
			setIsTranslating(false);
		}
	};

	return (
		<fieldset className="createChat__authorContent">
			<legend>{t('groupChat.create.authorContent.title')}</legend>
			<div className="createChat__languageTabs" role="tablist">
				{languages.map((language) => (
					<button
						type="button"
						role="tab"
						aria-selected={language === selectedLanguage}
						key={language}
						onClick={() => setSelectedLanguage(language)}
					>
						{language.toUpperCase()}
					</button>
				))}
			</div>
			<label>
				{t('groupChat.create.authorContent.sourceLanguage')}
				<select
					value={value.sourceLanguage}
					onChange={(event) =>
						onChange({
							...value,
							sourceLanguage: event.target.value
						})
					}
				>
					{languages.map((language) => (
						<option key={language} value={language}>
							{language.toUpperCase()}
						</option>
					))}
				</select>
			</label>
			<label>
				{t('groupChat.create.authorContent.welcome')}
				<textarea
					maxLength={120}
					value={
						value.hintMessageTranslations[selectedLanguage] || ''
					}
					onChange={(event) => updateHint(event.target.value)}
				/>
			</label>
			<div className="createChat__rules">
				<span>{t('groupChat.create.authorContent.rules')}</span>
				{rules.map((rule, index) => (
					<div key={`${selectedLanguage}-rule-${index}`}>
						<textarea
							aria-label={`${t(
								'groupChat.create.authorContent.rule'
							)} ${index + 1}`}
							maxLength={120}
							value={rule}
							onChange={(event) =>
								updateRules(
									rules.map((current, ruleIndex) =>
										ruleIndex === index
											? event.target.value
											: current
									)
								)
							}
						/>
						<button
							type="button"
							onClick={() =>
								updateRules(
									rules.filter(
										(_, ruleIndex) => ruleIndex !== index
									)
								)
							}
						>
							{t('groupChat.create.authorContent.removeRule')}
						</button>
					</div>
				))}
				{rules.length < 10 && (
					<button
						type="button"
						onClick={() => updateRules([...rules, ''])}
					>
						{t('groupChat.create.authorContent.addRule')}
					</button>
				)}
			</div>
			<button
				type="button"
				disabled={isTranslating}
				onClick={translateContent}
			>
				{isTranslating
					? t('groupChat.create.authorContent.translating')
					: t('groupChat.create.authorContent.translate')}
			</button>
			{translationError && (
				<p role="alert">
					{t('groupChat.create.authorContent.translationError')}
				</p>
			)}
		</fieldset>
	);
};
