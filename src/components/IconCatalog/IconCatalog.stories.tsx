import type { Meta, StoryObj } from '@storybook/react-vite';
import * as React from 'react';
import { useMemo, useState } from 'react';
import catalog from './iconCatalog.generated.json';
import './iconCatalog.styles.scss';

type CatalogEntry = (typeof catalog)[number];
type FilterValue =
	| 'all'
	| CatalogEntry['kind']
	| CatalogEntry['state']
	| CatalogEntry['usage'];

const uiIconUrls = import.meta.glob(
	'../../resources/img/icons/**/*.{svg,png,jpg,jpeg,webp}',
	{
		eager: true,
		query: '?url',
		import: 'default'
	}
) as Record<string, string>;
const topicIconUrls = import.meta.glob(
	'../../resources/img/registration-md3/icons/**/*.{svg,png,jpg,jpeg,webp}',
	{
		eager: true,
		query: '?url',
		import: 'default'
	}
) as Record<string, string>;
const legacyAvatarUrls = import.meta.glob(
	'../pseudonym/animals/**/*.{svg,png,jpg,jpeg,webp}',
	{
		eager: true,
		query: '?url',
		import: 'default'
	}
) as Record<string, string>;

const toSourcePath = (globPath: string) => {
	if (globPath.startsWith('../../'))
		return `src/${globPath.slice('../../'.length)}`;
	if (globPath.startsWith('../'))
		return `src/components/${globPath.slice('../'.length)}`;
	return globPath;
};

const assetUrls = new Map(
	Object.entries({
		...uiIconUrls,
		...topicIconUrls,
		...legacyAvatarUrls
	}).map(([globPath, url]) => [toSourcePath(globPath), url])
);

const figmaReferences = [
	{
		label: '24px icon baseline (431 Figma symbols)',
		href: 'https://www.figma.com/design/RTUi1rcrEWECXz8rNFmj7Q/Design-System-M3_ORISO?node-id=55594-2485&m=dev'
	},
	{
		label: 'Sidebar icons, including 200 / 400 / filled (32 symbols)',
		href: 'https://www.figma.com/design/RTUi1rcrEWECXz8rNFmj7Q/Design-System-M3_ORISO?node-id=61102-6480&m=dev'
	},
	{
		label: 'Default topic icons (29 assets)',
		href: 'https://www.figma.com/design/RTUi1rcrEWECXz8rNFmj7Q/Design-System-M3_ORISO?node-id=61093-22600&m=dev'
	},
	{
		label: 'Client avatar source set (64 animals)',
		href: 'https://www.figma.com/design/RTUi1rcrEWECXz8rNFmj7Q/Design-System-M3_ORISO?node-id=61391-5229&m=dev'
	},
	{
		label: 'Consultant avatar source set (64 animals)',
		href: 'https://www.figma.com/design/RTUi1rcrEWECXz8rNFmj7Q/Design-System-M3_ORISO?node-id=61391-5556&m=dev'
	}
];

const aiPrompt = `Use only an asset from the ORISO Storybook icon catalog.

Selection rules:
1. Use the exact catalog ID or sourcePath named in the task; do not substitute a similar MUI icon, emoji, Unicode glyph, or hand-written SVG.
2. For ordinary UI, prefer the 400 variant as the default outline state. Use filled for selected/active. Use 200 only when the linked Figma component or an existing ORISO interaction explicitly calls for the lighter outline.
3. Sidebar items are the exception: verify all available 200, 400, and filled states against the sidebar Figma node before editing the navigation.
4. Topic icons and client/consultant avatars are separate asset families; do not replace them with ordinary UI icons.
5. Before changing code, confirm the exact sourcePath and inspect the listed usageFiles. Reuse the existing export name when one is available.
6. After implementation, verify the component in Storybook and, when it affects a real flow, in the running app as a separate evidence step.

Return the chosen catalog ID, sourcePath, state mapping, and verification performed.`;

const kindLabels: Record<CatalogEntry['kind'], string> = {
	'ui-icon': 'UI icon',
	'sidebar-icon': 'Sidebar',
	'topic-icon': 'Topic',
	'client-avatar': 'Client avatar',
	'legacy-client-avatar': 'Legacy avatar'
};

const resolveAssetUrl = (entry: CatalogEntry) => {
	if (entry.sourcePath.startsWith('public/')) {
		return `/${entry.sourcePath.slice('public/'.length)}`;
	}
	return assetUrls.get(entry.sourcePath);
};

const copyText = async (text: string) => {
	await navigator.clipboard.writeText(text);
};

function IconCatalog() {
	const [query, setQuery] = useState('');
	const [kind, setKind] = useState<FilterValue>('all');
	const [state, setState] = useState<FilterValue>('all');
	const [usage, setUsage] = useState<FilterValue>('all');
	const [copied, setCopied] = useState<string | null>(null);

	const visibleEntries = useMemo(() => {
		const normalizedQuery = query.trim().toLowerCase();
		return catalog.filter((entry) => {
			const matchesQuery =
				!normalizedQuery ||
				[
					entry.id,
					entry.family,
					entry.fileName,
					entry.sourcePath,
					...entry.exportNames
				]
					.join(' ')
					.toLowerCase()
					.includes(normalizedQuery);
			return (
				matchesQuery &&
				(kind === 'all' || entry.kind === kind) &&
				(state === 'all' || entry.state === state) &&
				(usage === 'all' || entry.usage === usage)
			);
		});
	}, [kind, query, state, usage]);

	const appUsedCount = catalog.filter(
		(entry) => entry.usage === 'app-used'
	).length;

	const handleCopy = async (key: string, value: string) => {
		await copyText(value);
		setCopied(key);
		window.setTimeout(() => setCopied(null), 1600);
	};

	return (
		<main className="iconCatalog">
			<header className="iconCatalog__header">
				<div>
					<p className="iconCatalog__eyebrow">
						ORISO Frontend · generated from the repository
					</p>
					<h1>Icons, topics and avatars</h1>
					<p>
						<strong>400</strong> is the normal outline baseline,{' '}
						<strong>filled</strong> is selected/active, and{' '}
						<strong>200</strong> is an explicit lighter outline.
						Sidebar components may define all three.
					</p>
				</div>
				<button
					type="button"
					className="iconCatalog__primaryAction"
					onClick={() => handleCopy('ai-prompt', aiPrompt)}
				>
					{copied === 'ai-prompt'
						? 'Prompt copied'
						: 'Copy AI selection prompt'}
				</button>
			</header>

			<section
				className="iconCatalog__summary"
				aria-label="Catalog summary"
			>
				<div>
					<strong>{catalog.length}</strong>
					<span>repository assets</span>
				</div>
				<div>
					<strong>{appUsedCount}</strong>
					<span>referenced by app source</span>
				</div>
				<div>
					<strong>{catalog.length - appUsedCount}</strong>
					<span>catalogued only</span>
				</div>
				<div>
					<strong>{visibleEntries.length}</strong>
					<span>currently shown</span>
				</div>
			</section>

			<details className="iconCatalog__references">
				<summary>Figma reference sets</summary>
				<ul>
					{figmaReferences.map((reference) => (
						<li key={reference.href}>
							<a
								href={reference.href}
								target="_blank"
								rel="noreferrer"
							>
								{reference.label}
							</a>
						</li>
					))}
				</ul>
			</details>

			<section
				className="iconCatalog__filters"
				aria-label="Filter icon catalog"
			>
				<label>
					Search
					<input
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						placeholder="ID, filename, export or path"
					/>
				</label>
				<label>
					Family
					<select
						value={kind}
						onChange={(event) =>
							setKind(event.target.value as FilterValue)
						}
					>
						<option value="all">All</option>
						{Object.entries(kindLabels).map(([value, label]) => (
							<option key={value} value={value}>
								{label}
							</option>
						))}
					</select>
				</label>
				<label>
					State
					<select
						value={state}
						onChange={(event) =>
							setState(event.target.value as FilterValue)
						}
					>
						<option value="all">All</option>
						{[
							'base',
							'200',
							'400',
							'filled',
							'outline',
							'hover'
						].map((value) => (
							<option key={value} value={value}>
								{value}
							</option>
						))}
					</select>
				</label>
				<label>
					Usage
					<select
						value={usage}
						onChange={(event) =>
							setUsage(event.target.value as FilterValue)
						}
					>
						<option value="all">All</option>
						<option value="app-used">App-used</option>
						<option value="catalogued-only">Catalogued only</option>
					</select>
				</label>
			</section>

			<section className="iconCatalog__grid" aria-live="polite">
				{visibleEntries.map((entry) => {
					const assetUrl = resolveAssetUrl(entry);
					const selectionPrompt = `Use ORISO icon ${entry.id} from ${entry.sourcePath}. Treat it as ${entry.role}. Do not substitute or redraw it.`;
					return (
						<article
							className="iconCatalog__card"
							key={entry.sourcePath}
						>
							<div
								className={`iconCatalog__preview iconCatalog__preview--${entry.kind}`}
							>
								{assetUrl ? (
									<img src={assetUrl} alt="" />
								) : (
									<span>Preview unavailable</span>
								)}
							</div>
							<div className="iconCatalog__badges">
								<span>{kindLabels[entry.kind]}</span>
								<span>{entry.state}</span>
								<span>{entry.usage}</span>
							</div>
							<h2>{entry.id}</h2>
							<code>{entry.sourcePath}</code>
							{entry.exportNames.length > 0 && (
								<p>Export: {entry.exportNames.join(', ')}</p>
							)}
							<p>
								{entry.usageFiles.length} app reference
								{entry.usageFiles.length === 1 ? '' : 's'}
							</p>
							<button
								type="button"
								onClick={() =>
									handleCopy(
										entry.sourcePath,
										selectionPrompt
									)
								}
							>
								{copied === entry.sourcePath
									? 'Copied'
									: 'Copy selection'}
							</button>
						</article>
					);
				})}
			</section>
		</main>
	);
}

const meta = {
	title: 'Design System/Icons & Avatars',
	component: IconCatalog,
	parameters: {
		layout: 'fullscreen',
		design: { type: 'figma', url: figmaReferences[0].href },
		docs: {
			description: {
				component:
					'Searchable, machine-readable catalog generated from ORISO Frontend assets. App-used excludes tests and Storybook-only references.'
			}
		}
	}
} satisfies Meta<typeof IconCatalog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Catalog: Story = {};
