import * as React from 'react';
import { Meta, StoryObj } from '@storybook/react';
import {
	EmailCatalogueSheet,
	EmailDialectSheet,
	EmailTokenSheet
} from '../preview/EmailFoundations';
import { EMAIL_LOCALES, EMAIL_LOCALE_LABELS } from '../index';

const meta = {
	title: 'Email/Foundations',
	component: EmailTokenSheet,
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component:
					'The transactional e-mail kit: one skeleton, seven occasions, three tone variants.\n\nIt is a **separate** token set from the app theme on purpose. E-mail clients cannot read CSS custom properties, so every value has to be inlined as a literal at render time; the values mirror the muted ORISO M3 scheme but are frozen here as plain hex and px. Everything is prefixed `email…` so the two libraries can never be confused.\n\nHouse rules: tables for layout, inline styles, no JavaScript, no webfont loads. The single `<style>` block exists only for the mobile media query, and clients that strip it still get a working desktop layout.'
			}
		}
	}
} satisfies Meta<typeof EmailTokenSheet>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Tokens: Story = {};

export const Catalogue: Story = {
	name: 'Catalogue',
	render: () => <EmailCatalogueSheet locale="de-sie" />
};

export const CataloguePerTone: Story = {
	name: 'Catalogue per tone',
	render: () => (
		<div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
			{EMAIL_LOCALES.map((locale) => (
				<section key={locale}>
					<h3 style={{ margin: '0 0 10px' }}>
						{EMAIL_LOCALE_LABELS[locale]}
					</h3>
					<EmailCatalogueSheet locale={locale} />
				</section>
			))}
		</div>
	)
};

export const Dialects: Story = {
	name: 'Dialects',
	render: () => <EmailDialectSheet />
};
