import * as React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as TranslateIcon } from '../../resources/img/icons/translate.svg';
import { ReactComponent as GlobeIcon } from '../../resources/img/icons/schedule-language.svg';
import { ReactComponent as CloseIcon } from '../../resources/img/icons/close.svg';
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
	/*
	 * Languages the author dropped from this circle via the chip's remove
	 * control (Figma 8467-27977). Tenant configuration is untouched; only this
	 * draft stops carrying the language.
	 */
	const [excluded, setExcluded] = useState<string[]>([]);
	const languages = useMemo(
		() =>
			normalizeGroupChatLanguages(activeLanguages).filter(
				(language) => !excluded.includes(language)
			),
		[activeLanguages, excluded]
	);
	const [selectedLanguage, setSelectedLanguage] = useState(
		languages.includes(value.sourceLanguage)
			? value.sourceLanguage
			: languages[0] || value.sourceLanguage
	);
	const [isTranslating, setIsTranslating] = useState(false);
	const [translationError, setTranslationError] = useState(false);
	/*
	 * No placeholder entry: the editor used to be handed [''] for a language
	 * with no rules yet, and since it now receives the list unfiltered that
	 * blank would surface as a real, deletable chip before the author had added
	 * anything. The add control creates the first rule.
	 */
	const rules = value.groupChatRulesTranslations?.[selectedLanguage] || [];
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

	/*
	 * The chip's remove control drops the language from this circle: its
	 * drafted welcome text and rules go with it, so the submit no longer
	 * carries a language the author took off the card.
	 */
	const removeLanguage = (language: string) => {
		const nextHints = { ...value.hintMessageTranslations };
		const nextRules = { ...value.groupChatRulesTranslations };
		delete nextHints[language];
		delete nextRules[language];
		setExcluded((current) =>
			current.includes(language) ? current : [...current, language]
		);
		onChange({
			...value,
			hintMessageTranslations: nextHints,
			groupChatRulesTranslations: nextRules
		});
	};

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
		/*
		 * Figma 8467-27977 draws this as one quiet card: a language row with the
		 * translate action pinned right, the welcome box, the rule box, the rule
		 * chips with a bare add glyph. No legend and no field labels — each box
		 * states its own purpose through its placeholder.
		 */
		<div
			className="createChat__authorContent"
			role="group"
			aria-label={t('groupChat.create.authorContent.title')}
		>
			<div className="createChat__languageBar">
				<div className="createChat__languageTabs" role="tablist">
					{languages.map((language, index) => {
						const isSelected = language === selectedLanguage;
						return (
							<span
								className={`createChat__languageChip${
									isSelected
										? ' createChat__languageChip--selected'
										: ''
								}`}
								key={language}
							>
								<button
									type="button"
									role="tab"
									id={tabIdFor(language)}
									aria-controls={panelIdFor(language)}
									aria-selected={isSelected}
									tabIndex={isSelected ? 0 : -1}
									onClick={() =>
										setSelectedLanguage(language)
									}
									onKeyDown={(event) =>
										handleTabKeyDown(event, index)
									}
								>
									{isSelected && <GlobeIcon aria-hidden />}
									{language.toUpperCase()}
								</button>
								{/*
								 * The source language carries the text every
								 * other language is translated from, and the
								 * submit sends `sourceLanguage` separately.
								 * Dropping it would leave the request naming a
								 * language it has no content for.
								 */}
								{!isSelected &&
									language !== value.sourceLanguage &&
									languages.length > 1 && (
									<button
										type="button"
										className="createChat__languageChipRemove"
										aria-label={t(
											'groupChat.create.authorContent.removeLanguage',
											{ language: language.toUpperCase() }
										)}
										onClick={() =>
											removeLanguage(language)
										}
									>
										<CloseIcon aria-hidden />
									</button>
								)}
							</span>
						);
					})}
				</div>
				{translationAvailable && (
					<button
						type="button"
						className="createChat__translateButton"
						aria-busy={isTranslating}
						aria-label={t(
							isTranslating
								? 'groupChat.create.authorContent.translating'
								: 'groupChat.create.authorContent.translate'
						)}
						title={t(
							isTranslating
								? 'groupChat.create.authorContent.translating'
								: 'groupChat.create.authorContent.translate'
						)}
						disabled={isTranslating}
						onClick={translateContent}
					>
						<TranslateIcon aria-hidden />
					</button>
				)}
			</div>
			<div
				className="createChat__authorPanel"
				role="tabpanel"
				id={panelId}
				aria-labelledby={tabId}
			>
				<textarea
					className="createChat__welcomeInput"
					maxLength={120}
					aria-label={t('groupChat.create.authorContent.welcome')}
					placeholder={t('groupChat.create.authorContent.welcome')}
					value={value.hintMessageTranslations?.[selectedLanguage] || ''}
					onChange={(event) => updateHint(event.target.value)}
				/>
				<RuleChipsEditor
					rules={rules}
					onChange={updateRules}
					resetKey={selectedLanguage}
				/>
			</div>
			{translationError && (
				<p role="alert">
					{t('groupChat.create.authorContent.translationError')}
				</p>
			)}
		</div>
	);
};
