import * as React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiTranslateGroupChatAuthorContent } from '../../api/apiGroupChatAuthorTranslation';
import {
	applyGroupChatAuthorTranslations,
	buildGroupChatAuthorTranslationRequest,
	GroupChatAuthorContentDraft,
	normalizeGroupChatLanguages
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
		() => normalizeGroupChatLanguages(activeLanguages),
		[activeLanguages]
	);
	const [selectedLanguage, setSelectedLanguage] = useState(
		languages.includes(value.sourceLanguage)
			? value.sourceLanguage
			: languages[0] || value.sourceLanguage
	);
	const [isTranslating, setIsTranslating] = useState(false);
	const [translationError, setTranslationError] = useState(false);
	const rules = value.groupChatRulesTranslations?.[selectedLanguage] || [''];
	const inputSignature = JSON.stringify({ languages, value });
	const latestInputSignature = useRef(inputSignature);
	latestInputSignature.current = inputSignature;
	const idPrefix = React.useId().replace(/:/g, '');
	const tabIdFor = (language: string) =>
		`${idPrefix}-group-chat-author-tab-${language}`;
	const panelIdFor = (language: string) =>
		`${idPrefix}-group-chat-author-panel-${language}`;
	const tabId = tabIdFor(selectedLanguage);
	const panelId = panelIdFor(selectedLanguage);

	useEffect(() => {
		setSelectedLanguage((current) =>
			languages.includes(current)
				? current
				: languages[0] || value.sourceLanguage
		);
	}, [languages, value.sourceLanguage]);

	const handleTabKeyDown = (
		event: React.KeyboardEvent<HTMLButtonElement>,
		index: number
	) => {
		let nextIndex: number | undefined;
		if (event.key === 'ArrowRight') {
			nextIndex = (index + 1) % languages.length;
		} else if (event.key === 'ArrowLeft') {
			nextIndex = (index - 1 + languages.length) % languages.length;
		} else if (event.key === 'Home') {
			nextIndex = 0;
		} else if (event.key === 'End') {
			nextIndex = languages.length - 1;
		}
		if (nextIndex === undefined || !languages[nextIndex]) {
			return;
		}
		event.preventDefault();
		const nextLanguage = languages[nextIndex];
		setSelectedLanguage(nextLanguage);
		document.getElementById(tabIdFor(nextLanguage))?.focus();
	};

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
		setTranslationError(false);
		try {
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
			const requestInputSignature = inputSignature;
			const response = await apiTranslateGroupChatAuthorContent(request);
			if (latestInputSignature.current !== requestInputSignature) {
				return;
			}
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
				{languages.map((language, index) => (
					<button
						type="button"
						role="tab"
						id={tabIdFor(language)}
						aria-controls={panelIdFor(language)}
						aria-selected={language === selectedLanguage}
						tabIndex={language === selectedLanguage ? 0 : -1}
						key={language}
						onClick={() => setSelectedLanguage(language)}
						onKeyDown={(event) => handleTabKeyDown(event, index)}
					>
						{language.toUpperCase()}
					</button>
				))}
			</div>
			<div role="tabpanel" id={panelId} aria-labelledby={tabId}>
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
							value.hintMessageTranslations?.[selectedLanguage] ||
							''
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
											(_, ruleIndex) =>
												ruleIndex !== index
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
