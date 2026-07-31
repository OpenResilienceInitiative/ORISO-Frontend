import * as React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as GlobeIcon } from '../../resources/img/icons/schedule-language.svg';
import { ReactComponent as TranslateIcon } from '../../resources/img/icons/translate.svg';
import { apiTranslateGroupChatAuthorContent } from '../../api/apiGroupChatAuthorTranslation';
import {
	applyGroupChatAuthorTranslations,
	buildGroupChatAuthorTranslationRequest,
	GroupChatAuthorContentDraft,
	normalizeGroupChatLanguages
} from './groupChatAuthorContent';
import { RuleChipsEditor } from './RuleChipsEditor';
import '../button/button.styles.scss';

interface GroupChatAuthorContentFieldsProps {
	activeLanguages: string[];
	value: GroupChatAuthorContentDraft;
	onChange: (value: GroupChatAuthorContentDraft) => void;
	/**
	 * Hide the translate action when no translation API key is configured
	 * in the background (Figma flow 8482-30552). Defaults to true.
	 */
	translationAvailable?: boolean;
}

export const GroupChatAuthorContentFields = ({
	activeLanguages,
	value,
	onChange,
	translationAvailable = true
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
		<section className="authorCard">
			<div className="authorCard__topRow">
				<div className="authorCard__chips" role="tablist">
					{languages.map((language, index) => (
						<button
							type="button"
							role="tab"
							className="authorCard__chip"
							id={tabIdFor(language)}
							aria-controls={panelIdFor(language)}
							aria-selected={language === selectedLanguage}
							tabIndex={language === selectedLanguage ? 0 : -1}
							key={language}
							onClick={() => setSelectedLanguage(language)}
							onKeyDown={(event) =>
								handleTabKeyDown(event, index)
							}
						>
							{language === selectedLanguage && (
								<GlobeIcon
									className="authorCard__chipIcon"
									aria-hidden
								/>
							)}
							{language.toUpperCase()}
						</button>
					))}
				</div>
				{translationAvailable && (
					<button
						type="button"
						className="authorCard__iconButton authorCard__iconButton--filled"
						disabled={isTranslating}
						onClick={translateContent}
						title={t('groupChat.create.authorContent.translate')}
						aria-label={
							isTranslating
								? t(
										'groupChat.create.authorContent.translating'
									)
								: t('groupChat.create.authorContent.translate')
						}
					>
						<TranslateIcon aria-hidden />
					</button>
				)}
			</div>
			<div
				className="authorCard__panel"
				role="tabpanel"
				id={panelId}
				aria-labelledby={tabId}
			>
				<textarea
					className="authorCard__field"
					maxLength={120}
					placeholder={t('groupChat.create.authorContent.welcome')}
					aria-label={t('groupChat.create.authorContent.welcome')}
					value={
						value.hintMessageTranslations?.[selectedLanguage] || ''
					}
					onChange={(event) => updateHint(event.target.value)}
				/>
				<RuleChipsEditor
					rules={rules.filter((rule) => rule.trim().length > 0)}
					onChange={updateRules}
					resetKey={selectedLanguage}
				/>
			</div>
			{translationError && (
				<p role="alert" className="authorCard__error">
					{t('groupChat.create.authorContent.translationError')}
				</p>
			)}
		</section>
	);
};
