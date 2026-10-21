import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import template from 'lodash/template.js';

export const productPages = [
	'beratung-hilfe.html',
	'error.400.html',
	'error.401.html',
	'error.404.html',
	'error.500.html',
	'under-construction.html'
];

const regularFile = (file) => {
	try {
		return statSync(file).isFile();
	} catch (error) {
		if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return false;
		throw error;
	}
};
const publicKey = (key) =>
	/^REACT_APP_/i.test(key) ||
	[
		'NODE_ENV',
		'PUBLIC_URL',
		'WDS_SOCKET_HOST',
		'WDS_SOCKET_PATH',
		'WDS_SOCKET_PORT',
		'FAST_REFRESH'
	].includes(key);
const configUrl = (publicUrl) => `${publicUrl.replace(/\/$/, '')}/config.js`;
const attributes = (tag) => {
	const result = new Map();
	for (const match of tag.matchAll(
		/\s([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g
	)) {
		const key = match[1].toLowerCase();
		if (result.has(key))
			throw new Error(`Duplicate script attribute: ${key}`);
		result.set(key, match[2] ?? match[3] ?? match[4] ?? '');
	}
	return result;
};

export function runtimeConfigBeforeModules(html, publicUrl) {
	// Preserve offsets while excluding comments from executable script matching.
	const executable = html.replace(/<!--[\s\S]*?-->/g, (comment) =>
		' '.repeat(comment.length)
	);
	const scripts = [
		...executable.matchAll(/<script\b([^>]*)>[\s\S]*?<\/script\s*>/gi)
	].map((match) => ({
		start: match.index,
		end: match.index + match[0].length,
		attrs: attributes(match[1])
	}));
	const configs = scripts.filter((script) =>
		/(?:^|\/)config\.js(?:[?#]|$)/.test(script.attrs.get('src') ?? '')
	);
	if (configs.length !== 1)
		throw new Error(
			'Exactly one blocking runtime config.js script is required'
		);
	const config = configs[0];
	if (
		config.attrs.get('src') !== configUrl(publicUrl) ||
		config.attrs.has('async') ||
		config.attrs.has('defer') ||
		config.attrs.has('nomodule') ||
		(config.attrs.has('type') &&
			!['text/javascript', 'application/javascript'].includes(
				config.attrs.get('type').toLowerCase()
			))
	) {
		throw new Error(
			'Runtime config.js must be a classic blocking script at the public URL'
		);
	}
	const firstModule = scripts.find(
		(script) => script.attrs.get('type')?.toLowerCase() === 'module'
	);
	if (!firstModule || config.start < firstModule.start) return html;
	const tag = html.slice(config.start, config.end);
	const withoutConfig = html.slice(0, config.start) + html.slice(config.end);
	return (
		withoutConfig.slice(0, firstModule.start) +
		tag +
		'\n' +
		withoutConfig.slice(firstModule.start)
	);
}

export function renderProductPage(environment, name) {
	if (!productPages.includes(name))
		throw new Error(`Unknown product page: ${name}`);
	const maintenance = name === 'under-construction.html';
	const relative = `pages/${maintenance ? 'under-construction' : 'app'}.html`;
	const extension = path.join(environment.paths.appExtensions, relative);
	const source = regularFile(extension)
		? extension
		: path.join(environment.paths.appSrc, relative);
	const errorType = name.startsWith('error.')
		? name.split('.')[1]
		: undefined;
	let html = template(readFileSync(source, 'utf8'), {
		interpolate: /<%=([\s\S]+?)%>/g
	})({
		htmlWebpackPlugin: {
			options: {
				title: errorType
					? `Error Page ${errorType}`
					: 'Beratung & Hilfe'
			}
		},
		type: errorType ? 'error' : 'app',
		errorType
	});
	if (maintenance) {
		html = html.replaceAll(
			'__REACT_APP_ORGANIZATION_ONLINEBERATUNG_URL__',
			environment.raw.REACT_APP_ORGANIZATION_ONLINEBERATUNG_URL ||
				environment.raw.REACT_APP_ORGANIZATION_HOME_URL ||
				'/'
		);
	}
	html = html.replace(/%([A-Za-z_][A-Za-z0-9_]*)%/g, (marker, key) => {
		if (!publicKey(key) || !Object.hasOwn(environment.raw, key))
			throw new Error(`Unknown or unresolved public marker: ${marker}`);
		return String(environment.raw[key]);
	});
	if (/<%|__REACT_APP_ORGANIZATION_ONLINEBERATUNG_URL__/.test(html))
		throw new Error(`Unresolved template marker in ${name}`);
	if (maintenance) return html;
	const entry = environment.paths.appEntryPoints[errorType ? 'error' : 'app'];
	const url =
		'/' +
		path
			.relative(environment.paths.appPath, entry)
			.split(path.sep)
			.join('/');
	const module = `<script type="module" src="${url}"></script>`;
	html = /<\/body\s*>/i.test(html)
		? html.replace(/<\/body\s*>/i, module + '\n$&')
		: html + '\n' + module;
	return runtimeConfigBeforeModules(html, environment.raw.PUBLIC_URL);
}

export function productHtmlPlugin(environment) {
	const entries = new Map(
		productPages.map((name) => [
			path.join(environment.paths.appPath, name),
			name
		])
	);
	return {
		name: 'oriso-product-html',
		enforce: 'pre',
		resolveId(id) {
			if (entries.has(id)) return id;
		},
		load(id) {
			if (entries.has(id))
				return renderProductPage(environment, entries.get(id));
		},
		transformIndexHtml: {
			order: 'post',
			handler(html, context) {
				if (
					path.basename(context.filename) ===
					'under-construction.html'
				)
					return html;
				return runtimeConfigBeforeModules(
					html,
					environment.raw.PUBLIC_URL
				);
			}
		}
	};
}
