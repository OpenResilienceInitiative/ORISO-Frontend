import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const FORBIDDEN_PULL_POLICY = /imagePullPolicy:\s*Never\b/m;
const FORBIDDEN_LATEST_TAG = /image:\s*[^\s\n]*:latest\b/m;

const DEFAULT_MANIFEST_DIRS = ['manifests'];

export const validateManifestContent = (content, filename = 'manifest') => {
	const errors = [];

	if (FORBIDDEN_PULL_POLICY.test(content)) {
		errors.push(`${filename}: imagePullPolicy: Never is not allowed`);
	}

	if (FORBIDDEN_LATEST_TAG.test(content)) {
		errors.push(`${filename}: :latest image tag is not allowed`);
	}

	return errors;
};

export const collectYamlFiles = (rootDir) => {
	const files = [];

	const walk = (dir) => {
		for (const entry of readdirSync(dir)) {
			const fullPath = join(dir, entry);
			const stat = statSync(fullPath);

			if (stat.isDirectory()) {
				walk(fullPath);
				continue;
			}

			if (entry.endsWith('.yaml') || entry.endsWith('.yml')) {
				files.push(fullPath);
			}
		}
	};

	walk(rootDir);
	return files;
};

export const validateManifests = (dirs = DEFAULT_MANIFEST_DIRS) => {
	const errors = [];

	for (const dir of dirs) {
		for (const filePath of collectYamlFiles(dir)) {
			const content = readFileSync(filePath, 'utf8');
			const relativeName = filePath.split(/[\\/]/).slice(-2).join('/');
			errors.push(...validateManifestContent(content, relativeName));
		}
	}

	return errors;
};

export const substituteManifestPlaceholders = (content) => {
	const defaults = {
		FRONTEND_IMAGE: 'ghcr.io/openresilienceinitiative/oriso-frontend:abcdef123456',
		ORISO_APP_HOST: 'app.example.org',
		ORISO_APP_TLS_SECRET: 'app-example-org-tls',
		LIVEKIT_TOKEN_SERVICE_URL:
			'http://livekit-token-service.caritas.svc.cluster.local:3010',
		KEYCLOAK_REALM_URL:
			'http://oriso-platform-keycloak.caritas.svc.cluster.local:8080/realms/online-beratung',
		USER_SERVICE_URL:
			'http://oriso-platform-userservice.caritas.svc.cluster.local:8082'
	};

	return content.replace(/\$\{([A-Z0-9_]+)\}/g, (_, key) => defaults[key] ?? `mock-${key}`);
};

const isMain = process.argv[1]?.endsWith('validate-manifests.mjs');

if (isMain) {
	const errors = validateManifests();

	if (errors.length > 0) {
		console.error('Manifest policy validation failed:');
		errors.forEach((error) => console.error(`  - ${error}`));
		process.exit(1);
	}

	console.log('Manifest policy validation passed.');
}
