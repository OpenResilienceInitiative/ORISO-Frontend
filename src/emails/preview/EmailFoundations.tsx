import * as React from 'react';
import emailTranslationReview from '../content/translationReview.json';
import {
	EMAIL_AUDIENCE,
	EMAIL_CONTENT,
	EMAIL_DIALECTS,
	EMAIL_DIALECT_INFO,
	EMAIL_IDS,
	EMAIL_LABELS,
	EMAIL_LOCALES,
	EMAIL_LOCALE_DIR,
	EMAIL_LOCALE_LABELS,
	EMAIL_LOCALE_LANG,
	EMAIL_LOCALE_PROVENANCE,
	EMAIL_LOCALE_RELEASE,
	EMAIL_RELEASED_LOCALES,
	EmailLocale,
	buildEmail,
	emailReviewGaps,
	listEmailPlaceholders,
	toEmailDialectHtml
} from '../index';
import {
	emailColor,
	emailFontStack,
	emailLayout,
	emailRadius,
	emailSpace,
	emailType
} from '../kit/emailTokens';

const shell: React.CSSProperties = {
	fontFamily: emailFontStack,
	color: emailColor.onSurface,
	fontSize: 14,
	lineHeight: '22px'
};

const th: React.CSSProperties = {
	textAlign: 'left',
	fontSize: 12,
	lineHeight: '18px',
	letterSpacing: 0.5,
	textTransform: 'uppercase',
	color: emailColor.onSurfaceVariant,
	fontWeight: 400,
	padding: '0 16px 8px 0',
	verticalAlign: 'bottom'
};

const td: React.CSSProperties = {
	padding: '8px 16px 8px 0',
	borderTop: `1px solid ${emailColor.outline}`,
	verticalAlign: 'top'
};

const mono: React.CSSProperties = {
	fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
	fontSize: 12
};

/** Colour, type, spacing and layout constants, as the mails actually use them. */
export const EmailTokenSheet: React.FC = () => (
	<div
		style={{ ...shell, display: 'flex', flexDirection: 'column', gap: 32 }}
	>
		<section>
			<h3 style={{ margin: '0 0 12px' }}>Colour</h3>
			<div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
				{Object.entries(emailColor).map(([name, value]) => (
					<div key={name} style={{ width: 150 }}>
						<div
							style={{
								height: 44,
								borderRadius: 8,
								background: value,
								border: `1px solid ${emailColor.outline}`
							}}
						/>
						<div style={{ paddingTop: 6, fontSize: 13 }}>
							{name}
						</div>
						<div
							style={{
								...mono,
								color: emailColor.onSurfaceVariant
							}}
						>
							{value}
						</div>
					</div>
				))}
			</div>
			<p style={{ color: emailColor.onSurfaceVariant, maxWidth: '62ch' }}>
				Primary and accent are deliberately absent — they are per-tenant
				and arrive as <code style={mono}>{'{{primaryColor}}'}</code> /{' '}
				<code style={mono}>{'{{accentColor}}'}</code> at send time.
			</p>
		</section>

		<section>
			<h3 style={{ margin: '0 0 12px' }}>Type scale</h3>
			<table style={{ borderCollapse: 'collapse' }}>
				<thead>
					<tr>
						<th style={th}>Role</th>
						<th style={th}>Size / line</th>
						<th style={th}>Weight</th>
						<th style={th}>Tracking</th>
						<th style={th}>Sample</th>
					</tr>
				</thead>
				<tbody>
					{Object.entries(emailType).map(([name, spec]) => {
						const type = spec as {
							size: number;
							line: number;
							weight?: number;
							tracking?: number;
						};
						return (
							<tr key={name}>
								<td style={td}>{name}</td>
								<td style={{ ...td, ...mono }}>
									{type.size}/{type.line}
								</td>
								<td style={{ ...td, ...mono }}>
									{type.weight ?? 400}
								</td>
								<td style={{ ...td, ...mono }}>
									{type.tracking ?? 0}px
								</td>
								<td
									style={{
										...td,
										fontSize: type.size,
										lineHeight: `${type.line}px`,
										fontWeight: type.weight ?? 400,
										letterSpacing: type.tracking ?? 0
									}}
								>
									Beratung beginnt hier
								</td>
							</tr>
						);
					})}
				</tbody>
			</table>
			<p style={{ color: emailColor.onSurfaceVariant, maxWidth: '62ch' }}>
				Font stack <code style={mono}>{emailFontStack}</code> — no
				webfont is loaded. Clients without Inter fall back cleanly, and
				a blocked font request never delays the render.
			</p>
		</section>

		<section>
			<h3 style={{ margin: '0 0 12px' }}>Spacing, radius, layout</h3>
			<table style={{ borderCollapse: 'collapse' }}>
				<tbody>
					{[
						['Column width', `${emailLayout.width}px`],
						[
							'Mobile breakpoint',
							`${emailLayout.mobileBreakpoint}px`
						],
						[
							'Gutter',
							`${emailSpace.gutter}px → ${emailSpace.gutterMobile}px on mobile`
						],
						[
							'Canvas padding',
							`${emailSpace.edge.top}/${emailSpace.edge.side}/${emailSpace.edge.bottom} → ` +
								`${emailSpace.edgeMobile.top}/${emailSpace.edgeMobile.side}/${emailSpace.edgeMobile.bottom}`
						],
						[
							'Panel padding',
							`${emailSpace.panel.block}×${emailSpace.panel.inline} → ` +
								`${emailSpace.panelMobile.block}×${emailSpace.panelMobile.inline}`
						],
						['Card radius', `${emailRadius.card}px`],
						['Panel radius', `${emailRadius.panel}px`],
						['Logo radius', `${emailRadius.logo}px`],
						['Button radius', `${emailRadius.pill}px (pill)`]
					].map(([label, value]) => (
						<tr key={label}>
							<td style={{ ...td, width: 200 }}>{label}</td>
							<td style={{ ...td, ...mono }}>{value}</td>
						</tr>
					))}
				</tbody>
			</table>
		</section>
	</div>
);

/** Every mail, its audience, and the placeholders it needs filled. */
export const EmailCatalogueSheet: React.FC<{ locale?: EmailLocale }> = ({
	locale = 'de-sie'
}) => (
	<div style={{ ...shell, overflowX: 'auto' }}>
		<table style={{ borderCollapse: 'collapse', width: '100%' }}>
			<thead>
				<tr>
					{['Mail', 'Id', 'Goes to', 'Subject', 'Placeholders'].map(
						(label) => (
							<th
								key={label}
								style={{ ...th, whiteSpace: 'nowrap' as const }}
							>
								{label}
							</th>
						)
					)}
				</tr>
			</thead>
			<tbody>
				{EMAIL_IDS.map((id) => {
					const built = buildEmail(id, locale);
					const tokens = listEmailPlaceholders(built.html);
					const tight = { ...td, whiteSpace: 'nowrap' as const };
					return (
						<tr key={id}>
							<td style={tight}>{EMAIL_LABELS[id]}</td>
							<td style={{ ...tight, ...mono }}>{id}</td>
							<td style={tight}>
								{EMAIL_AUDIENCE[id] === 'asker'
									? 'Ratsuchende'
									: 'Fachkraft'}
							</td>
							<td style={tight}>{built.subject}</td>
							<td
								style={{
									...td,
									...mono,
									color: '#a5000a',
									lineHeight: '20px'
								}}
							>
								{tokens.join(' ')}
							</td>
						</tr>
					);
				})}
			</tbody>
		</table>
		<p style={{ color: emailColor.onSurfaceVariant, maxWidth: '72ch' }}>
			Variants:{' '}
			{EMAIL_LOCALES.map((l) => EMAIL_LOCALE_LABELS[l]).join(', ')} — of
			which{' '}
			{EMAIL_RELEASED_LOCALES.map((l) => EMAIL_LOCALE_LABELS[l]).join(
				', '
			)}{' '}
			are send-ready; see <strong>Translations</strong>. Files ship as{' '}
			<code style={mono}>
				emails/&lt;dialect&gt;/&lt;tone&gt;/&lt;id&gt;
			</code>{' '}
			— the ids are the contract with the sending services, so renaming
			one is a breaking change.
		</p>
	</div>
);

/**
 * Which languages exist, where their copy came from, and what still stands
 * between a machine translation and a send.
 *
 * The unsigned count is the number of distinct strings that state something
 * about the platform — the encryption promise, the privacy wording, the DPA
 * mail — which nobody who reads that language has confirmed yet. It is the
 * whole gate, in one column.
 */
export const EmailTranslationSheet: React.FC = () => (
	<div style={{ ...shell, overflowX: 'auto' }}>
		<table style={{ borderCollapse: 'collapse', width: '100%' }}>
			<thead>
				<tr>
					{[
						'Variant',
						'Id',
						'lang',
						'dir',
						'Copy from',
						'Send-ready',
						'Unsigned claims'
					].map((label) => (
						<th
							key={label}
							style={{ ...th, whiteSpace: 'nowrap' as const }}
						>
							{label}
						</th>
					))}
				</tr>
			</thead>
			<tbody>
				{EMAIL_LOCALES.map((locale) => {
					const released =
						EMAIL_LOCALE_RELEASE[locale] === 'released';
					const unsigned =
						EMAIL_LOCALE_PROVENANCE[locale] === 'machine'
							? emailReviewGaps(
									EMAIL_CONTENT[locale],
									EMAIL_IDS,
									(
										emailTranslationReview.locales as Record<
											string,
											Record<string, never>
										>
									)[locale] ?? {}
								).unsigned.length
							: 0;
					const tight = { ...td, whiteSpace: 'nowrap' as const };
					return (
						<tr key={locale}>
							<td style={tight}>{EMAIL_LOCALE_LABELS[locale]}</td>
							<td style={{ ...tight, ...mono }}>{locale}</td>
							<td style={{ ...tight, ...mono }}>
								{EMAIL_LOCALE_LANG[locale]}
							</td>
							<td style={{ ...tight, ...mono }}>
								{EMAIL_LOCALE_DIR[locale]}
							</td>
							<td style={tight}>
								{EMAIL_LOCALE_PROVENANCE[locale]}
							</td>
							<td
								style={{
									...tight,
									color: released
										? emailColor.onSurface
										: '#a5000a'
								}}
							>
								{released ? 'yes' : 'not yet'}
							</td>
							<td style={{ ...tight, ...mono }}>
								{unsigned === 0 ? '—' : unsigned}
							</td>
						</tr>
					);
				})}
			</tbody>
		</table>
		<p style={{ color: emailColor.onSurfaceVariant, maxWidth: '72ch' }}>
			A <code style={mono}>machine</code> variant renders here and in{' '}
			<strong>Email/Pages</strong> so it can be read, but it produces no
			files under <code style={mono}>dist/</code> and no sending service
			may select it. It becomes send-ready when every claim it makes has a
			signature in{' '}
			<code style={mono}>content/translationReview.json</code> — run{' '}
			<code style={mono}>npm run emails:sync</code> to list what is
			missing. See ADR-022.
		</p>
	</div>
);

/**
 * The three placeholder dialects, shown on the same fragment so the difference
 * is visible rather than described.
 */
export const EmailDialectSheet: React.FC = () => {
	const fragment =
		'<td style="color:{{primaryColor}};">Hallo {{username}}</td>' +
		'<a href="{{loginUrl}}">Zur Beratung</a>';

	return (
		<div
			style={{
				...shell,
				display: 'flex',
				flexDirection: 'column',
				gap: 28
			}}
		>
			<p style={{ maxWidth: '72ch', margin: 0 }}>
				None of the services that send mail can import this kit — they
				are Java, it is TypeScript. So the build emits the same markup
				once per engine. The rewrite is a post-process on the rendered
				output, not a second renderer, which is what stops a dialect
				from quietly disagreeing with the story above it.
			</p>

			<table style={{ borderCollapse: 'collapse' }}>
				<thead>
					<tr>
						{['Dialect', 'Consumer', 'Placeholder', 'Files'].map(
							(label) => (
								<th key={label} style={th}>
									{label}
								</th>
							)
						)}
					</tr>
				</thead>
				<tbody>
					{EMAIL_DIALECTS.map((dialect) => {
						const info = EMAIL_DIALECT_INFO[dialect];
						return (
							<tr key={dialect}>
								<td style={{ ...td, ...mono }}>{dialect}</td>
								<td style={td}>{info.consumer}</td>
								<td
									style={{ ...td, ...mono, color: '#a5000a' }}
								>
									{info.syntax}
								</td>
								<td style={{ ...td, ...mono }}>
									.{info.extension.html} / .
									{info.extension.text}
								</td>
							</tr>
						);
					})}
				</tbody>
			</table>

			{EMAIL_DIALECTS.map((dialect) => (
				<section key={dialect}>
					<h3 style={{ margin: '0 0 8px' }}>{dialect}</h3>
					<pre
						style={{
							...mono,
							margin: 0,
							padding: 14,
							background: emailColor.surfaceMuted,
							border: `1px solid ${emailColor.outline}`,
							borderRadius: 8,
							whiteSpace: 'pre-wrap',
							wordBreak: 'break-word'
						}}
					>
						{toEmailDialectHtml(fragment, dialect)}
					</pre>
				</section>
			))}

			<p style={{ color: emailColor.onSurfaceVariant, maxWidth: '72ch' }}>
				An attribute keeps its literal{' '}
				<code style={mono}>{'{{…}}'}</code> in the Thymeleaf dialect and
				gains a <code style={mono}>th:*</code> twin, because Thymeleaf
				overwrites the attribute at render time and the file then still
				reads as the mail it produces. All 21 mails were rendered with
				real Thymeleaf and real FreeMarker and compared byte-for-byte
				against the substituted plain template — 86 renders, no
				differences.
			</p>
		</div>
	);
};
