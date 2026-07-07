import { promises as fs } from 'fs';
import path from 'path';
import dtsgenerator, { parseFileContent, parseSchema } from 'dtsgenerator';
import prettier from 'prettier';

const rawOrgUrl = 'https://raw.githubusercontent.com/OpenResilienceInitiative';

/**
 * OpenAPI specs are read from the OpenResilienceInitiative service repos
 * (dev branch — the integration branch this frontend tracks).
 *
 * `refs` lists spec files that the main spec references via cross-file
 * `$ref`s (e.g. `useradminservice.yaml#/components/schemas/X`). dtsgenerator
 * cannot resolve those on its own, so their `components.schemas` are merged
 * into the main spec and the `$ref`s are rewritten to local pointers before
 * generation.
 *
 * Note: the former Rocket.Chat-era services (uploadService, mailService,
 * liveService, videoService) have no ORISO upstream anymore and their unused
 * type files were removed. `src/generated/messageservice.d.ts` is still
 * referenced by the message components and is kept as a frozen legacy
 * snapshot until those DTOs are replaced by Matrix-native types.
 */
const services = [
	{
		path: 'ORISO-UserService/dev/api/userservice.yaml',
		namespace: 'UserService',
		out: 'userservice.d.ts',
		refs: [
			'ORISO-UserService/dev/api/useradminservice.yaml',
			'ORISO-UserService/dev/services/agencyservice.yaml',
			'ORISO-UserService/dev/services/agencyadminservice.yaml'
		]
	},
	{
		path: 'ORISO-AgencyService/dev/api/agencyservice.yaml',
		namespace: 'AgencyService',
		out: 'agencyservice.d.ts',
		refs: ['ORISO-AgencyService/dev/api/components/agency-settings.yaml']
	}
];

const fetchSpec = async (specPath: string): Promise<any> => {
	const url = `${rawOrgUrl}/${specPath}`;
	const res = await fetch(url);
	if (!res.ok) {
		throw new Error(`Failed to fetch ${url}: ${res.status}`);
	}
	return parseFileContent(await res.text(), specPath);
};

/**
 * Rewrites cross-file schema references
 * (`<some-file>.yaml#/components/schemas/X`) to local pointers
 * (`#/components/schemas/X`). The referenced schemas themselves are merged
 * into the main spec by `mergeRefSchemas`.
 */
const rewriteExternalRefs = (node: unknown): void => {
	if (node == null || typeof node !== 'object') {
		return;
	}
	if (Array.isArray(node)) {
		node.forEach(rewriteExternalRefs);
		return;
	}
	const obj = node as Record<string, unknown>;
	const ref = obj.$ref;
	if (typeof ref === 'string' && !ref.startsWith('#')) {
		const match = /#\/components\/schemas\/([^/]+)$/.exec(ref);
		if (match) {
			obj.$ref = `#/components/schemas/${match[1]}`;
		}
	}
	Object.values(obj).forEach(rewriteExternalRefs);
};

/**
 * Some upstream specs use the invalid OpenAPI scalar `type: long` (a Java-ism;
 * the correct spelling is `type: integer` + `format: int64`). dtsgenerator
 * aborts on it, so normalize before generation.
 */
const normalizeInvalidTypes = (node: unknown): void => {
	if (node == null || typeof node !== 'object') {
		return;
	}
	if (Array.isArray(node)) {
		node.forEach(normalizeInvalidTypes);
		return;
	}
	const obj = node as Record<string, unknown>;
	if (obj.type === 'long') {
		obj.type = 'integer';
		obj.format = obj.format ?? 'int64';
	}
	Object.values(obj).forEach(normalizeInvalidTypes);
};

const mergeRefSchemas = (main: any, refSpecs: any[]): void => {
	main.components = main.components ?? {};
	main.components.schemas = main.components.schemas ?? {};
	for (const refSpec of refSpecs) {
		const schemas = refSpec?.components?.schemas ?? {};
		for (const [name, schema] of Object.entries(schemas)) {
			// The main spec's own definition wins on name collisions.
			if (!(name in main.components.schemas)) {
				main.components.schemas[name] = schema;
			}
		}
	}
};

(async () => {
	try {
		const prettierConfigFile = await prettier.resolveConfigFile();
		const prettierConfig = await prettier.resolveConfig(prettierConfigFile);

		for (const service of services) {
			const spec = await fetchSpec(service.path);
			const refSpecs = await Promise.all(
				(service.refs ?? []).map(fetchSpec)
			);
			mergeRefSchemas(spec, refSpecs);
			rewriteExternalRefs(spec);
			normalizeInvalidTypes(spec);

			const content = await dtsgenerator({
				contents: [parseSchema(spec, `/${service.out}`)],
				config: {
					plugins: {
						'@dtsgenerator/replace-namespace': {
							map: [
								{
									from: ['Components', 'Schema'],
									to: [service.namespace]
								}
							]
						}
					}
				}
			});

			await fs.writeFile(
				path.join('src', 'generated', service.out),
				// prettier v3: format() is async
				await prettier.format(content, {
					parser: 'typescript',
					...prettierConfig
				})
			);
		}
	} catch (err) {
		console.error(`Something went wrong: ${err}`);
		process.exit(1);
	}
})();
