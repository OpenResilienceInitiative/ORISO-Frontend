import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

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
