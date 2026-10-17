import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import {
	BLUE_TENANT,
	HighContrastComparison,
	LIGHT_TENANT,
	RED_TENANT
} from './HighContrastComparison';
import {
	desktop1440Globals,
	phone390Globals
} from '../../message/messageStoryShell';

const meta = {
	title: 'Foundations/High contrast candidates',
	parameters: {
		layout: 'fullscreen',
		router: {
			initialPath: '/sessions/consultant/sessionView/session/4401'
		},
		// Two axe rules fire on the real session row itself, identically in its own
		// stories (SessionListItem): nested-interactive (the row is role=tab and
		// holds a menu button) and duplicate-id (one SVG mask id per rendered
		// message, here four columns). Neither is part of this proposal.
		// The Standard column is the thing being measured: its date-divider pill
		// reads 4.39:1 (AA needs 4.5), which axe would report and fail this page
		// on. That number is in the contrast table and the PR; the candidates
		// stay under axe.
		a11y: {
			context: { exclude: ['[data-candidate="standard"]'] },
			config: {
				rules: [
					{ id: 'nested-interactive', enabled: false },
					{ id: 'duplicate-id', enabled: false }
				]
			}
		},
		docs: {
			description: {
				component: [
					'**Proposal for ORISO-Frontend#1134 — palettes only.** The standard palette stays the default (product decision 18.08.2026). These are three candidates for the optional personal high-contrast appearance. There is no setting and no wiring yet; pick a candidate first.',
					'',
					'Each column renders the **real** chat bubble, buttons, session row and input inside a wrapper that carries one token map. Standard vs. A · Tinted AAA vs. B · Graphite vs. C · Maximum, for a red and a blue tenant colour. Ratios are WCAG 2.2: text 4.5:1 (AA) / 7:1 (AAA target), UI parts and icons 3:1.',
					'',
					'**Where a token swap does not reach** (identical in every column, listed in the table): the button focus ring is hard-coded `#199fff` (2.7:1), the disabled button is a hard-coded `rgba` pair, the session-row name (`#4f5864`) and preview (`#1e1e1e`) are literals, and `--m3-secondary-container` is used both as a chip fill and as a text colour. Wiring a chosen candidate has to move those onto tokens first.'
				].join('\n')
			}
		}
	}
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** Both tenants, all four columns, ratio tables. */
export const Overview: Story = {
	render: () => <HighContrastComparison tenants={[RED_TENANT, BLUE_TENANT]} />
};

export const RedTenantDesktop1440: Story = {
	name: 'Red tenant, desktop 1440',
	globals: desktop1440Globals,
	render: () => <HighContrastComparison tenants={[RED_TENANT]} />
};

export const RedTenantPhone390: Story = {
	name: 'Red tenant, phone 390',
	globals: phone390Globals,
	render: () => <HighContrastComparison tenants={[RED_TENANT]} />
};

export const BlueTenantDesktop1440: Story = {
	name: 'Blue tenant, desktop 1440',
	globals: desktop1440Globals,
	render: () => <HighContrastComparison tenants={[BLUE_TENANT]} />
};

export const BlueTenantPhone390: Story = {
	name: 'Blue tenant, phone 390',
	globals: phone390Globals,
	render: () => <HighContrastComparison tenants={[BLUE_TENANT]} />
};

/** A light brand colour is the hard case: it has to move to reach 7:1. */
export const LightTenantStressTest: Story = {
	name: 'Light yellow tenant (stress test)',
	globals: desktop1440Globals,
	render: () => <HighContrastComparison tenants={[LIGHT_TENANT]} />
};
