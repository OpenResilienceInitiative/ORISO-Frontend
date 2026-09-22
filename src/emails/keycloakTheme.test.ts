/* eslint-disable no-template-curly-in-string --
 * The Keycloak theme contains `${...}` as literal FreeMarker / theme.properties
 * text; these are expected strings, not forgotten template literals.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	APP_BASE_URL_ENV,
	KEYCLOAK_LINK_PATHS,
	findHardcodedUrls
} from './kit/keycloakThemeLinks';

const themeDir = path.resolve(__dirname, 'dist/keycloak/email');

const filesUnder = (dir: string): string[] =>
	readdirSync(dir).flatMap((name) => {
		const full = path.join(dir, name);
		return statSync(full).isDirectory() ? filesUnder(full) : [full];
	});

const generated = () =>
	filesUnder(themeDir).map((file) => ({
		name: path.relative(themeDir, file),
		content: readFileSync(file, 'utf8')
	}));

/**
 * Team rule: a deployed service never invents a URL. The Keycloak image ships
 * this theme to every environment, so a host written here is every
 * environment's host (ORISO-Helm#366).
 */
describe('generated Keycloak e-mail theme', () => {
	it('names no host and defaults no URL', () => {
		expect(findHardcodedUrls(generated())).toEqual([]);
	});

	it('derives every link from ORISO_APP_BASE_URL', () => {
		const properties = readFileSync(
			path.join(themeDir, 'theme.properties'),
			'utf8'
		);
		for (const [key, linkPath] of Object.entries(KEYCLOAK_LINK_PATHS)) {
			expect(properties).toContain(
				`\n${key}=\${env.${APP_BASE_URL_ENV}}${linkPath}\n`
			);
		}
	});

	it('gives link lookups no FreeMarker default, so a missing value fails the render', () => {
		for (const { name, content } of generated().filter((f) =>
			f.name.endsWith('.ftl')
		)) {
			for (const key of Object.keys(KEYCLOAK_LINK_PATHS)) {
				expect(content, name).not.toContain(`(properties.${key})!`);
			}
		}
	});
});

describe('findHardcodedUrls', () => {
	it('flags the production host', () => {
		expect(
			findHardcodedUrls([
				{ name: 'a', content: 'x=https://app.oriso.org/login' }
			])
		).toHaveLength(1);
	});

	it('flags a FreeMarker URL default', () => {
		expect(
			findHardcodedUrls([
				{
					name: 'a.ftl',
					content: "${(properties.x)!'https://a.example.org'}"
				}
			])
		).toHaveLength(1);
	});

	it('flags a literal URL in a properties value', () => {
		expect(
			findHardcodedUrls([
				{
					name: 'theme.properties',
					content: 'orisoAppUrl=https://a.example.org'
				}
			])
		).toHaveLength(1);
	});

	it('accepts env-derived links', () => {
		expect(
			findHardcodedUrls([
				{
					name: 'theme.properties',
					content: 'orisoAppUrl=${env.ORISO_APP_BASE_URL}'
				}
			])
		).toEqual([]);
	});
});

/**
 * Pins the generated Keycloak theme (`npm run emails:keycloak`), which is
 * copied verbatim into ORISO-Keycloak `keycloak-image/themes/oriso/email`.
 *
 * `theme.properties` ships `orisoLogoUrl` empty. An unguarded logo cell then
 * renders `<img src="">`, which mail clients show as a broken image with its
 * alt text. The cell may only exist inside a FreeMarker guard that admits a
 * configured HTTPS logo beneath the application's own origin.
 */

const htmlDir = path.resolve(__dirname, 'dist/keycloak/email/html');
const read = (name: string) => readFileSync(path.join(htmlDir, name), 'utf8');

/** The template with every `<#if …>…</#if>` block removed. */
const unconditional = (template: string): string =>
	template.replace(/<#if [^>]*>[\s\S]*?<\/#if>/g, '');

describe.each(['otp-email.ftl', 'password-reset.ftl'])(
	'Keycloak theme %s',
	(name) => {
		const template = read(name);

		it('renders no logo image unconditionally', () => {
			expect(template).toContain('<img');
			expect(unconditional(template)).not.toContain('<img');
			expect(unconditional(template)).not.toContain('padding-right:12px');
		});

		it('guards the whole logo cell with a first-party HTTPS check', () => {
			const guard = template.match(/<#if ([^>]*)>(<td[\s\S]*?)<\/#if>/);
			expect(guard?.[1]).toContain('properties.orisoLogoUrl');
			expect(guard?.[1]).toContain('?starts_with("https://")');
			expect(guard?.[1]).toContain('+ "/"');
			expect(guard?.[2]).toMatch(/^<td[^>]*><img [^>]*><\/td>$/);
		});
	}
);
