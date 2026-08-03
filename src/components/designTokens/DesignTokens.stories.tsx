/**
 * The ORISO colour reference (Frontend#898).
 *
 * Every swatch is computed by `computeOrisoPalette` while the page
 * renders. That is the whole point: the Figma export drifted eleven
 * roles out of date because it was a copy, and a hand-maintained hex
 * table here would drift the same way.
 */
import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import {
	type OrisoSchemeName,
	computeOrisoPalette
} from '../../utils/theme/orisoScheme';
import { CALL_TOKEN_MAP } from '../../utils/theme/callTheme';

const SEED = '#A5000A';
const SCHEMES: OrisoSchemeName[] = ['light', 'dark', 'inverted'];

const luminance = (hex: string): number => {
	const channel = (c: number): number =>
		c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	const [r, g, b] = [1, 3, 5].map((i) =>
		channel(parseInt(hex.slice(i, i + 2), 16) / 255)
	);
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrast = (a: string, b: string): number => {
	const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
	return (x + 0.05) / (y + 0.05);
};

/**
 * Role → the role it is normally read against. Only pairs that actually
 * meet on screen are scored; scoring everything would produce numbers
 * nobody should act on.
 */
const PAIRED_WITH: Record<string, string> = {
	'--m3-on-surface': '--m3-surface',
	'--m3-on-surface-variant': '--m3-surface',
	'--m3-on-primary': '--m3-primary',
	'--m3-on-primary-container': '--m3-primary-container',
	'--m3-on-secondary': '--m3-secondary',
	'--m3-on-secondary-container': '--m3-secondary-container',
	'--m3-on-tertiary': '--m3-tertiary',
	'--m3-on-tertiary-container': '--m3-tertiary-container',
	'--m3-on-error': '--m3-error',
	'--m3-on-error-container': '--m3-error-container',
	'--m3-on-background': '--m3-background',
	'--m3-outline': '--m3-surface',
	'--m3-inverse-on-surface': '--m3-inverse-surface'
};

const mono: React.CSSProperties = {
	fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
	fontSize: 12
};

const Swatch: React.FC<{ value: string; size?: number }> = ({
	value,
	size = 34
}) => (
	<span
		style={{
			display: 'inline-block',
			width: size,
			height: size,
			background: value,
			border: '1px solid rgba(128,128,128,.45)',
			borderRadius: 6,
			flex: '0 0 auto'
		}}
	/>
);

const Score: React.FC<{ ratio: number; large?: boolean }> = ({
	ratio,
	large
}) => {
	const threshold = large ? 3 : 4.5;
	const ok = ratio >= threshold;
	return (
		<span
			style={{
				...mono,
				color: ok ? 'inherit' : '#b1005e',
				fontWeight: ok ? 400 : 700
			}}
			title={
				ok
					? `passes ${threshold}:1`
					: `FAILS — needs ${threshold}:1 against its paired role`
			}
		>
			{ratio.toFixed(2)}
			{ok ? '' : ' ✕'}
		</span>
	);
};

const SchemeColumn: React.FC<{
	tokens: Record<string, string>;
	role: string;
}> = ({ tokens, role }) => {
	const value = tokens[role];
	const against = PAIRED_WITH[role];
	return (
		<td style={{ padding: '6px 14px', verticalAlign: 'middle' }}>
			<span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
				<Swatch value={value} />
				<span style={mono}>
					{value}
					{against && (
						<>
							<br />
							<Score ratio={contrast(value, tokens[against])} />
						</>
					)}
				</span>
			</span>
		</td>
	);
};

const RoleTable: React.FC = () => {
	// One palette per scheme, not one per table cell.
	const palettes = SCHEMES.map(
		(s) => computeOrisoPalette({ primary: SEED }, s).tokens
	);
	const roles = Object.keys(palettes[0]).filter((r) => r.startsWith('--m3-'));
	return (
		<table style={{ borderCollapse: 'collapse' }}>
			<thead>
				<tr>
					<th style={{ textAlign: 'left', padding: '6px 14px' }}>
						Role
					</th>
					{SCHEMES.map((s) => (
						<th
							key={s}
							style={{ textAlign: 'left', padding: '6px 14px' }}
						>
							{s}
						</th>
					))}
				</tr>
			</thead>
			<tbody>
				{roles.map((role) => (
					<tr
						key={role}
						style={{ borderTop: '1px solid rgba(128,128,128,.25)' }}
					>
						<td style={{ ...mono, padding: '6px 14px' }}>{role}</td>
						{SCHEMES.map((s, i) => (
							<SchemeColumn
								key={s}
								tokens={palettes[i]}
								role={role}
							/>
						))}
					</tr>
				))}
			</tbody>
		</table>
	);
};

const Page: React.FC<
	React.PropsWithChildren<{ title: string; lead: React.ReactNode }>
> = ({ title, lead, children }) => (
	<div style={{ padding: 24, maxWidth: '100%', overflowX: 'auto' }}>
		<h2 style={{ marginTop: 0 }}>{title}</h2>
		<p style={{ maxWidth: '65ch', lineHeight: 1.5 }}>{lead}</p>
		{children}
	</div>
);

const meta: Meta = {
	title: 'Design System/Colour tokens',
	parameters: { layout: 'fullscreen' }
};
export default meta;

export const Roles: StoryObj = {
	name: 'ORISO roles (--m3-*)',
	render: () => (
		<Page
			title="ORISO colour roles"
			lead={
				<>
					Computed live from the OrisoScheme engine for the default
					tenant seed <code>{SEED}</code>. Contrast is shown for roles
					that have a defined partner; a red, bold number means the
					pair misses WCAG AA and should be treated as a bug in the
					tuning, not a rounding detail. Only the light scheme ships
					today — dark is used by the embedded call UI, inverted by
					the admin panel.
				</>
			}
		>
			<RoleTable />
		</Page>
	)
};

const MappingTable: React.FC = () => {
	const dark = computeOrisoPalette({ primary: SEED }, 'dark').tokens;
	const light = computeOrisoPalette({ primary: SEED }, 'light').tokens;
	return (
		<table style={{ borderCollapse: 'collapse' }}>
			<thead>
				<tr>
					{['Compound role', 'ORISO role', 'light', 'dark'].map(
						(h) => (
							<th
								key={h}
								style={{
									textAlign: 'left',
									padding: '6px 14px'
								}}
							>
								{h}
							</th>
						)
					)}
				</tr>
			</thead>
			<tbody>
				{Object.entries(CALL_TOKEN_MAP).map(([cpd, mapping]) => (
					<tr
						key={cpd}
						style={{ borderTop: '1px solid rgba(128,128,128,.25)' }}
					>
						<td style={{ ...mono, padding: '6px 14px' }}>
							{cpd}
							{mapping.note && (
								<div
									style={{
										opacity: 0.7,
										maxWidth: '42ch',
										fontFamily: 'inherit'
									}}
								>
									{mapping.note}
								</div>
							)}
						</td>
						<td style={{ ...mono, padding: '6px 14px' }}>
							{mapping.m3}
							{mapping.alpha !== undefined &&
								` @ ${mapping.alpha}%`}
						</td>
						<td style={{ padding: '6px 14px' }}>
							<Swatch value={light[mapping.m3]} size={26} />
						</td>
						<td style={{ padding: '6px 14px' }}>
							<Swatch value={dark[mapping.m3]} size={26} />
						</td>
					</tr>
				))}
			</tbody>
		</table>
	);
};

export const CallMapping: StoryObj = {
	name: 'Element Call mapping (--cpd-* ← --m3-*)',
	render: () => (
		<Page
			title="Element Call token mapping"
			lead={
				<>
					The embedded call runs on Compound, which speaks{' '}
					<code>--cpd-*</code>. This is the bridge onto the ORISO
					roles, read from the same table the generator writes (&nbsp;
					<code>npm run generate:call-theme</code>&nbsp;), so this
					page cannot disagree with the stylesheet the fork ships.
					Roles absent here keep their Compound values on purpose —
					the six-hue decorative set that tells participant avatars
					apart has no ORISO counterpart, and collapsing it onto one
					brand colour would make everyone look identical.
				</>
			}
		>
			<MappingTable />
		</Page>
	)
};
