import { describe, expect, it } from 'vitest';
import {
	applyGroupChatAuthorTranslations,
	buildGroupChatAuthorTranslationRequest,
	resolveGroupChatAuthorContent
} from './groupChatAuthorContent';

describe('resolveGroupChatAuthorContent', () => {
	it('prefers the requested language', () => {
		expect(
			resolveGroupChatAuthorContent({
				language: 'fr-FR',
				sourceLanguage: 'de',
				hintMessageTranslations: {
					fr: 'Bienvenue',
					en: 'Welcome',
					de: 'Willkommen'
				},
				groupChatRulesTranslations: {
					fr: ['Respectez-vous'],
					en: ['Be respectful'],
					de: ['Respektvoll bleiben']
				},
				legacyHintMessage: 'Legacy',
				legacyRules: ['Legacy rule']
			})
		).toEqual({ hintMessage: 'Bienvenue', rules: ['Respectez-vous'] });
	});

	it('falls back independently through English, source language, then legacy', () => {
		expect(
			resolveGroupChatAuthorContent({
				language: 'it',
				sourceLanguage: 'de',
				hintMessageTranslations: { en: 'Welcome' },
				groupChatRulesTranslations: {
					de: ['Respektvoll bleiben']
				},
				legacyHintMessage: 'Legacy',
				legacyRules: ['Legacy rule']
			})
		).toEqual({
			hintMessage: 'Welcome',
			rules: ['Respektvoll bleiben']
		});
	});
});

describe('group-chat author translation draft', () => {
	it('maps welcome and rules to stable translation keys', () => {
		expect(
			buildGroupChatAuthorTranslationRequest({
				sourceLanguage: 'de',
				activeLanguages: ['de', 'en', 'fr'],
				hintMessageTranslations: { de: 'Willkommen' },
				groupChatRulesTranslations: {
					de: ['Respektvoll bleiben', 'Keine Werbung']
				}
			})
		).toEqual({
			sourceLang: 'de',
			targetLangs: ['en', 'fr'],
			texts: {
				'welcome': 'Willkommen',
				'rule-0': 'Respektvoll bleiben',
				'rule-1': 'Keine Werbung'
			}
		});
	});

	it('merges translated fields into editable per-language content', () => {
		expect(
			applyGroupChatAuthorTranslations(
				{
					sourceLanguage: 'de',
					hintMessageTranslations: { de: 'Willkommen' },
					groupChatRulesTranslations: {
						de: ['Respektvoll bleiben']
					}
				},
				{
					en: {
						'welcome': 'Welcome',
						'rule-0': 'Be respectful'
					}
				}
			)
		).toMatchObject({
			hintMessageTranslations: { de: 'Willkommen', en: 'Welcome' },
			groupChatRulesTranslations: {
				de: ['Respektvoll bleiben'],
				en: ['Be respectful']
			}
		});
	});
});
