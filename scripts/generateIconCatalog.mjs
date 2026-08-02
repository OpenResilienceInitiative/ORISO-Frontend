import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const outputPath = path.join(
	repoRoot,
	'src/components/IconCatalog/iconCatalog.generated.json'
);

const assetRoots = [
	'src/resources/img/icons',
	'src/resources/img/registration-md3/icons',
	'src/components/pseudonym/animals',
	'public/assets/anon-animals'
];

const sourceExtensions = new Set([
	'.ts',
	'.tsx',
	'.js',
	'.jsx',
	'.scss',
	'.sass',
	'.less',
	'.css'
]);
const assetExtensions = new Set(['.svg', '.png', '.jpg', '.jpeg', '.webp']);

const walk = (directory) => {
	if (!fs.existsSync(directory)) return [];
	return fs
		.readdirSync(directory, { withFileTypes: true })
		.flatMap((entry) => {
			const absolutePath = path.join(directory, entry.name);
			return entry.isDirectory() ? walk(absolutePath) : [absolutePath];
		});
};

const toRepoPath = (absolutePath) =>
	path.relative(repoRoot, absolutePath).split(path.sep).join('/');

const sourceFiles = walk(path.join(repoRoot, 'src')).filter((absolutePath) => {
	const repoPath = toRepoPath(absolutePath);
	return (
		sourceExtensions.has(path.extname(absolutePath)) &&
		!repoPath.includes('/IconCatalog/') &&
		!repoPath.match(/\.(stories|test|spec)\.[^.]+$/)
	);
});

const sourceContents = sourceFiles.map((absolutePath) => ({
	path: toRepoPath(absolutePath),
	content: fs.readFileSync(absolutePath, 'utf8')
}));

const barrelPath = path.join(repoRoot, 'src/resources/img/icons.ts');
const barrelAliases = new Map();
if (fs.existsSync(barrelPath)) {
	const barrel = fs.readFileSync(barrelPath, 'utf8');
	for (const match of barrel.matchAll(
		/export\s*\{\s*ReactComponent\s+as\s+([A-Za-z0-9_]+)\s*\}\s*from\s*['"]([^'"]+\.svg)['"]/g
	)) {
		const [, alias, source] = match;
		const fileName = path.basename(source);
		barrelAliases.set(fileName, [
			...(barrelAliases.get(fileName) ?? []),
			alias
		]);
	}
}

const normalizeFamily = (fileName) =>
	path
		.basename(fileName, path.extname(fileName))
		.toLowerCase()
		.replace(
			/(?:^|[_\s-])(200|400|filled|active|inactive|hover|outline)(?=[_\s-]|$)/g,
			'_'
		)
		.replace(/[_\s-](?:20|24|32|40|48)(?:px)?$/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');

const getState = (fileName) => {
	const normalized = path
		.basename(fileName, path.extname(fileName))
		.toLowerCase();
	if (/(?:^|[_\s-])(filled|active)(?=[_\s-]|$)/.test(normalized))
		return 'filled';
	if (/(?:^|[_\s-])400(?=[_\s-]|$)/.test(normalized)) return '400';
	if (/(?:^|[_\s-])200(?=[_\s-]|$)/.test(normalized)) return '200';
	if (/(?:^|[_\s-])hover(?=[_\s-]|$)/.test(normalized)) return 'hover';
	if (/(?:^|[_\s-])(outline|inactive)(?=[_\s-]|$)/.test(normalized))
		return 'outline';
	return 'base';
};

const getRole = (state) => {
	if (state === 'filled') return 'selected';
	if (state === '200') return 'alternate-outline';
	if (state === 'hover') return 'hover';
	return 'default';
};

const getKind = (repoPath) => {
	if (repoPath.startsWith('public/assets/anon-animals/'))
		return 'client-avatar';
	if (repoPath.startsWith('src/components/pseudonym/animals/'))
		return 'legacy-client-avatar';
	if (
		repoPath.includes('/registration-md3/icons/t-') ||
		repoPath.includes('/registration-md3/icons/cat-')
	) {
		return 'topic-icon';
	}
	if (
		repoPath.includes('/navigation/') ||
		/\/(?:drafts|inbox|language|logout|messages|profil|teams)_(?:filled|outline)\./.test(
			repoPath
		)
	) {
		return 'sidebar-icon';
	}
	return 'ui-icon';
};

const getSize = (fileName) => {
	const match = path
		.basename(fileName, path.extname(fileName))
		.match(/[_\s-](20|24|32|40|48)(?:px)?$/i);
	return match ? Number(match[1]) : null;
};

const assetPaths = assetRoots
	.flatMap((root) => walk(path.join(repoRoot, root)))
	.filter((absolutePath) =>
		assetExtensions.has(path.extname(absolutePath).toLowerCase())
	)
	.map(toRepoPath)
	.sort((a, b) => a.localeCompare(b));

const entries = assetPaths.map((sourcePath) => {
	const fileName = path.basename(sourcePath);
	const kind = getKind(sourcePath);
	const aliases = barrelAliases.get(fileName) ?? [];
	const usageFiles = sourceContents
		.filter(({ content }) => {
			if (content.includes(fileName)) return true;
			return aliases.some((alias) =>
				new RegExp(`\\b${alias}\\b`).test(content)
			);
		})
		.map(({ path: sourcePath }) => sourcePath)
		.filter(
			(sourcePath, index, values) => values.indexOf(sourcePath) === index
		)
		.sort((a, b) => a.localeCompare(b));
	const state = getState(fileName);

	return {
		id: `${kind}:${normalizeFamily(fileName)}:${state}`,
		family: normalizeFamily(fileName),
		state,
		role: getRole(state),
		kind,
		size: getSize(fileName),
		fileName,
		sourcePath,
		exportNames: aliases,
		usageFiles,
		usage: usageFiles.length > 0 ? 'app-used' : 'catalogued-only'
	};
});

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(entries, null, 2)}\n`);

const usedCount = entries.filter(({ usage }) => usage === 'app-used').length;
console.log(
	`Generated ${entries.length} icon catalog entries (${usedCount} app-used).`
);
