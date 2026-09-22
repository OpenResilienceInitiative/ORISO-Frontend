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
 * ORISO-Keycloak's OtpEmailThemeTest renders the same files with FreeMarker;
 * this file pins the shape the generator must emit.
 *
 * The header shows the recipient's Träger logo (Admin → Appearance → Logo),
 * which TenantService serves at `/service/tenant/public/branding/{id}/logo`
 * on the app origin. Without a Träger it shows the operator's platform logo
 * (`ORISO_LOGO_URL`), and without either only the text wordmark — never an
 * `<img src="">`, which mail clients draw as a broken image.
 */

const htmlDir = path.resolve(__dirname, 'dist/keycloak/email/html');
const read = (name: string) => readFileSync(path.join(htmlDir, name), 'utf8');

const LOGO_BRANCHES =
	/<#if orisoLogoSrc\?has_content>([\s\S]*?)<#else>([\s\S]*?)<\/#if>/;

describe.each(['otp-email.ftl', 'password-reset.ftl'])(
	'Keycloak theme %s',
	(name) => {
		const template = read(name);

		it('shows either the logo or the text wordmark, never both', () => {
			const [, logo, wordmark] = template.match(LOGO_BRANCHES) ?? [];
			expect(logo).toContain('<img');
			expect(logo).not.toContain('padding-right:12px');
			expect(logo).not.toMatch(
				/>\$\{\(properties\.orisoPlatformName\)[^}]*\}<\/td>/
			);
			expect(wordmark).not.toContain('<img');
			expect(wordmark).toMatch(
				/>\$\{\(properties\.orisoPlatformName\)[^}]*\}<\/td>/
			);
			expect(template.match(/<img /g)).toHaveLength(1);
		});

		it('references the logo by the resolved URL with a styled alt text', () => {
			const img = template.match(/<img [^>]*>/)?.[0] ?? '';
			expect(img).toContain('src="${orisoLogoSrc}"');
			expect(img).toContain('class="oriso-logo"');
			expect(img).toContain('width="56" height="56"');
			expect(img).toContain(
				'alt="${(properties.orisoPlatformName)!\'Online-Beratung\'}"'
			);
			expect(img).toContain('font-family:Inter');
			expect(img).toContain('font-size:16px');
			expect(img).toContain('font-weight:600');
			expect(img).toContain(
				"color:${(properties.orisoPrimaryColor)!'#a5000a'}"
			);
		});

		it("builds the Träger logo URL from the recipient's tenantId on the app origin", () => {
			expect(template).toContain(
				'((user.attributes.tenantId)!\'\')?matches("[1-9][0-9]{0,18}")'
			);
			expect(template).toContain(
				'properties.orisoAppUrl + "/service/tenant/public/branding/" + user.attributes.tenantId + "/logo"'
			);
		});

		it('admits the platform logo only beneath the HTTPS app origin', () => {
			expect(template).toContain(
				'(properties.orisoAppUrl)?starts_with("https://")'
			);
			expect(template).toContain(
				'((properties.orisoLogoUrl)!\'\')?starts_with(properties.orisoAppUrl + "/")'
			);
		});

		it('covers a broken-image icon with the brand name', () => {
			expect(template).toContain(
				'img.oriso-logo::after{content:attr(alt);'
			);
		});
	}
);

describe('Keycloak theme.properties', () => {
	it('takes the platform logo from ORISO_LOGO_URL with no default', () => {
		const properties = readFileSync(
			path.join(themeDir, 'theme.properties'),
			'utf8'
		);
		expect(properties).toContain('\norisoLogoUrl=${env.ORISO_LOGO_URL:}\n');
	});
});
