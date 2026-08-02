import * as React from 'react';
import {
	EMAIL_AUDIENCE,
	EMAIL_IDS,
	EMAIL_LABELS,
	EMAIL_LOCALES,
	EMAIL_LOCALE_LABELS,
	EmailLocale,
	buildEmail,
	listEmailPlaceholders
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
			Tone variants:{' '}
			{EMAIL_LOCALES.map((l) => EMAIL_LOCALE_LABELS[l]).join(', ')}. Files
			ship as{' '}
			<code style={mono}>emails/&lt;tone&gt;/&lt;id&gt;.html</code> and{' '}
			<code style={mono}>.txt</code> — the ids are the contract with the
			sending services, so renaming one is a breaking change.
		</p>
	</div>
);
