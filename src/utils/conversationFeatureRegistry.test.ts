import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vite-plus/test';
import {
	CONVERSATION_FEATURE_KEYS,
	type ConversationFeatureKey
} from '../globalState/interfaces/ConversationFeatureSettings';
import { resolveConversationFeatureSettings } from './conversationFeatureSettings';

/**
 * OpenResilienceInitiative/ORISO-TenantService#363: every conversation feature the app
 * decides must come from the effective platform -> Traeger -> agency result.
 */
const SRC = join(__dirname, '..');
const REGISTRY = new Set<string>(CONVERSATION_FEATURE_KEYS);
/** Conversation capability families; any key of these families must be in the registry. */
const CONVERSATION_FAMILY =
	/\bfeature(?:Calls|AudioCalls|VideoCalls|VoiceMessages|MediaUpload|MediaInlineDisplay|Supervision|Threads|AnonymousChat|GroupChatV2|InternalGroupChat|SelfHelpGroups)[A-Za-z]*Enabled\b/g;

const sourceFiles = (dir: string): string[] =>
	readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		if (statSync(path).isDirectory())
			return name === 'generated' || name === 'test'
				? []
				: sourceFiles(path);
		return /\.tsx?$/.test(name) &&
			!/\.(test|spec|stories)\.tsx?$/.test(name) &&
			!name.endsWith('.d.ts')
			? [path]
			: [];
	});

/** Feature keys read straight from the raw tenant settings in one file. */
const rawTenantReads = (code: string): string[] => {
	const reads: string[] = [];
	// const { featureX = true, ... } = getTenantSettings();
	for (const m of code.matchAll(
		/const\s*\{([^}]*)\}\s*=\s*getTenantSettings\(\)/g
	))
		reads.push(...(m[1].match(/feature[A-Za-z]+/g) ?? []));
	// getTenantSettings()?.featureX
	for (const m of code.matchAll(
		/getTenantSettings\(\)\??\.(feature[A-Za-z]+)/g
	))
		reads.push(m[1]);
	// const tenant = getTenantSettings() ...; tenant.featureX
	for (const m of code.matchAll(/const\s+(\w+)\s*=\s*getTenantSettings\(\)/g))
		for (const r of code.matchAll(
			new RegExp(`\\b${m[1]}\\??\\.(feature[A-Za-z]+)`, 'g')
		))
			reads.push(r[1]);
	return reads;
};

describe('conversation feature registry (#363)', () => {
	const files = sourceFiles(SRC);

	it('lists every conversation feature key the app references', () => {
		const missing = new Set<string>();
		for (const file of files)
			for (const key of readFileSync(file, 'utf8').match(
				CONVERSATION_FAMILY
			) ?? [])
				if (!REGISTRY.has(key))
					missing.add(`${key} (${relative(SRC, file)})`);
		expect([...missing]).toEqual([]);
	});

	it('never decides a registered conversation feature from raw tenant settings', () => {
		const offenders = files.flatMap((file) =>
			rawTenantReads(readFileSync(file, 'utf8'))
				.filter((key) => REGISTRY.has(key))
				.map((key) => `${key} (${relative(SRC, file)})`)
		);
		expect(offenders).toEqual([]);
	});

	describe.each(CONVERSATION_FEATURE_KEYS.map((key) => [key]))(
		'%s',
		(key: ConversationFeatureKey) => {
			it.each([true, false])(
				'agency effective policy %s wins over the raw tenant value',
				(value) => {
					const effective = resolveConversationFeatureSettings(
						{ [key]: !value },
						{
							permissionPolicies: {
								[key]: {
									value,
									mode: 'SUGGESTED',
									inherited: true
								}
							}
						}
					);
					expect(effective[key]).toBe(value);
				}
			);
			it('a present policy map without the key grants nothing', () => {
				const effective = resolveConversationFeatureSettings(
					{ [key]: true },
					{ permissionPolicies: {} }
				);
				expect(effective[key]).toBe(false);
			});
			it.each([true, false])(
				'tenant-only path uses the served tenant value %s',
				(value) => {
					expect(
						resolveConversationFeatureSettings({ [key]: value })[
							key
						]
					).toBe(value);
				}
			);
		}
	);
});
