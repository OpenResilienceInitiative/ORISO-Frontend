import { promises as fs } from 'fs';
import path from 'path';
import dtsgenerator, { parseFileContent, parseSchema } from 'dtsgenerator';
import prettier from 'prettier';

const rawOrgUrl = 'https://raw.githubusercontent.com/OpenResilienceInitiative';
const userServiceSpecPrefix = 'ORISO-UserService/dev/';
const localUserServiceRoot = process.env.ORISO_USERSERVICE_SPEC_ROOT;

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
 * Only active ORISO service specifications are generated. Chat timeline and
 * attachment models are frontend-owned Matrix types, not generated transport
 * DTO snapshots.
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
	if (localUserServiceRoot && specPath.startsWith(userServiceSpecPrefix)) {
		const localPath = path.join(
			localUserServiceRoot,
			specPath.slice(userServiceSpecPrefix.length)
		);
		return parseFileContent(
			await fs.readFile(localPath, 'utf8'),
			localPath
		);
	}

	const url = `${rawOrgUrl}/${specPath}`;
	const res = await fetch(url);
	if (!res.ok) {
		throw new Error(`Failed to fetch ${url}: ${res.status}`);
	}
	return parseFileContent(await res.text(), specPath);
};

/**
 * Rewrites cross-file component references of any kind
 * (`<some-file>.yaml#/components/<kind>/X`) to local pointers
 * (`#/components/<kind>/X`). The referenced components themselves are merged
 * into the main spec by `mergeRefComponents`.
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
		const match = /#\/(components\/[^/]+\/[^/]+)$/.exec(ref);
		if (match) {
			obj.$ref = `#/${match[1]}`;
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

const COMPONENT_KINDS = [
	'schemas',
	'responses',
	'parameters',
	'requestBodies',
	'headers',
	'examples',
	'links',
	'callbacks',
	'securitySchemes'
];

/**
 * Returns the `components/<kind>/<name>` target of an entry that is nothing
 * but a single cross-file `$ref` (an alias stub), or null otherwise.
 */
const externalAliasTarget = (
	entry: unknown
): { kind: string; name: string } | null => {
	if (entry == null || typeof entry !== 'object' || Array.isArray(entry)) {
		return null;
	}
	const keys = Object.keys(entry as object);
	if (keys.length !== 1 || keys[0] !== '$ref') {
		return null;
	}
	const ref = (entry as Record<string, unknown>).$ref;
	if (typeof ref !== 'string' || ref.startsWith('#')) {
		return null;
	}
	const match = /#\/components\/([^/]+)\/([^/]+)$/.exec(ref);
	return match ? { kind: match[1], name: match[2] } : null;
};

const mergeRefComponents = (main: any, refSpecs: any[]): void => {
	main.components = main.components ?? {};
	for (const kind of COMPONENT_KINDS) {
		// Collect this kind from all referenced specs; first spec wins.
		const external: Record<string, unknown> = {};
		for (const refSpec of refSpecs) {
			for (const [name, def] of Object.entries(
				refSpec?.components?.[kind] ?? {}
			)) {
				if (!(name in external)) {
					external[name] = def;
				}
			}
		}
		if (!main.components[kind] && Object.keys(external).length === 0) {
			continue;
		}
		main.components[kind] = main.components[kind] ?? {};
		// Resolve alias stubs first: a main-spec entry that is nothing but a
		// cross-file $ref to a same-named component (e.g. `AgencyAdminControls:
		// { $ref: './components/agency-settings.yaml#/components/schemas/
		// AgencyAdminControls' }`) would otherwise be rewritten to a local
		// pointer at itself and emit a self-referential alias
		// (`export type X = X;`).
		for (const [name, def] of Object.entries(main.components[kind])) {
			const target = externalAliasTarget(def);
			if (target && target.kind === kind && target.name in external) {
				main.components[kind][name] = external[target.name];
			}
		}
		// The main spec's own (non-alias) definition wins on name collisions.
		for (const [name, def] of Object.entries(external)) {
			if (!(name in main.components[kind])) {
				main.components[kind][name] = def;
			}
		}
	}
};

(async () => {
	try {
		const prettierConfigFile = await prettier.resolveConfigFile();
		const prettierConfig = await prettier.resolveConfig(prettierConfigFile);
		const requestedService =
			process.env.ORISO_DTSGEN_SERVICE?.toLowerCase();

		for (const service of services) {
			if (
				requestedService &&
				![service.namespace, service.out]
					.map((value) => value.toLowerCase())
					.includes(requestedService)
			) {
				continue;
			}
			const spec = await fetchSpec(service.path);
			const refSpecs = await Promise.all(
				(service.refs ?? []).map(fetchSpec)
			);
			mergeRefComponents(spec, refSpecs);
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
