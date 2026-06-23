import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
	validateManifestContent,
	validateManifests,
	substituteManifestPlaceholders
} from './validate-manifests.mjs';

const manifestPath = join(process.cwd(), 'manifests', 'deployment.yaml');

test('consolidated manifest passes policy checks', () => {
	const content = readFileSync(manifestPath, 'utf8');
	const errors = validateManifestContent(content, 'deployment.yaml');
	assert.deepEqual(errors, []);
});

test('manifests directory passes policy checks', () => {
	const errors = validateManifests(['manifests']);
	assert.deepEqual(errors, []);
});

test('rejects imagePullPolicy Never', () => {
	const errors = validateManifestContent(
		'imagePullPolicy: Never\nimage: ghcr.io/example/app:sha123',
		'bad.yaml'
	);
	assert.equal(errors.length, 1);
	assert.match(errors[0], /Never/);
});

test('rejects :latest image tags', () => {
	const errors = validateManifestContent(
		'imagePullPolicy: IfNotPresent\nimage: ghcr.io/example/app:latest',
		'bad.yaml'
	);
	assert.equal(errors.length, 1);
	assert.match(errors[0], /latest/);
});

test('substituteManifestPlaceholders removes envsubst tokens', () => {
	const content = readFileSync(manifestPath, 'utf8');
	const substituted = substituteManifestPlaceholders(content);
	assert.doesNotMatch(substituted, /\$\{/);
	assert.match(substituted, /ghcr\.io\/openresilienceinitiative\/oriso-frontend:/);
});
