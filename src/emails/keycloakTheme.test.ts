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

	it('flags a literal URL on any host inside a quoted attribute', () => {
		expect(
			findHardcodedUrls([
				{
					name: 'html/otp-email.ftl',
					content:
						'<a href="https://other.example.org/login">Login</a>'
				}
			])
		).toEqual(['html/otp-email.ftl:1']);
	});

	it('accepts a bare scheme used as a comparison prefix', () => {
		expect(
			findHardcodedUrls([
				{
					name: 'html/otp-email.ftl',
					content:
						'<#if (properties.orisoAppUrl)?starts_with("https://")>'
				}
			])
		).toEqual([]);
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
 * The header shows the logo and the brand name beside it. The logo is the
 * recipient's Träger logo (Admin → Appearance → Logo), which TenantService
 * serves at `/service/tenant/public/branding/{id}/logo` on the app origin;
 * without a Träger the operator's platform logo (`ORISO_LOGO_URL`); without
 * either no `<img>` at all, only the name. The logo is decorative next to the
 * name (`alt=""`), so a logo that fails to load leaves nothing in its place.
 */

const htmlDir = path.resolve(__dirname, 'dist/keycloak/email/html');
const read = (name: string) => readFileSync(path.join(htmlDir, name), 'utf8');

const LOGO_BRANCH = /<#if orisoLogoSrc\?has_content>([\s\S]*?)<\/#if>/;
const NAME_CELL = />\$\{\(properties\.orisoPlatformName\)[^}]*\}<\/td>/;

describe.each(['otp-email.ftl', 'password-reset.ftl'])(
	'Keycloak theme %s',
	(name) => {
		const template = read(name);

		it('shows the logo and the name side by side', () => {
			const [branch, logo] = template.match(LOGO_BRANCH) ?? [];
			expect(logo).toContain('<img');
			expect(logo).not.toMatch(NAME_CELL);
			// The name cell follows the optional logo cell, outside the branch.
			const after = template.slice(template.indexOf(branch ?? '#'));
			expect(after.slice((branch ?? '').length)).toMatch(
				new RegExp(`^<td [^>]*${NAME_CELL.source}`)
			);
			expect(template.match(/<img /g)).toHaveLength(1);
			expect(template).not.toContain('src=""');
		});

		it('marks the logo decorative: empty alt, fixed size, no border', () => {
			const img = template.match(/<img [^>]*>/)?.[0] ?? '';
			expect(img).toContain('src="${orisoLogoSrc}"');
			expect(img).toContain(' alt=""');
			expect(img).toContain('width="36" height="36"');
			expect(img).toContain('border:0');
			expect(img).not.toContain('font-family');
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

		it('hides a failed logo instead of naming it again', () => {
			expect(template).not.toContain('content:attr(alt)');
			expect(template).toMatch(
				/img\[alt=""\]::after\{content:"";[^}]*background-color:#f2efef/
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
