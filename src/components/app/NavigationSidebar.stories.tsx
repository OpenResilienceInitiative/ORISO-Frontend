import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

/**
 * NavigationSidebar Component
 * 
 * Icon-only navigation sidebar with modern rounded rectangular button design.
 * Inspired by Element chat application with hover effects and active states.
 * 
 * **Features:**
 * - 48x48px rounded rectangular containers (12px border-radius)
 * - Semi-transparent white backgrounds on red sidebar
 * - Hover effects (brightness increase)
 * - Vertical spacing (4px between items)
 * - Horizontally centered icons
 * - 5 navigation items: Initial inquiries, My consultations, Profile, Language, Log out
 * 
 * **Implementation:** `src/components/app/NavigationBar.tsx`
 * **Styles:** `src/components/app/navigation.styles.scss`
 */
const meta: Meta = {
	title: 'Components/Layout/NavigationSidebar',
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component: 'Icon-only navigation sidebar with modern rounded rectangular button design. Inspired by Element chat application with hover effects and active states.'
			}
		}
	}
};

export default meta;
type Story = StoryObj;

/**
 * Documentation only - Component requires router and context providers
 * 
 * The NavigationSidebar component is integrated into the main application
 * and requires React Router and context providers.
 * 
 * **Visual Design:**
 * - Red sidebar background (#C41E3A or similar)
 * - White/semi-transparent icon containers
 * - Rounded rectangles (12px border-radius)
 * - 24px icons
 */
export const Documentation: Story = {
	render: () => (
		<div style={{ padding: '20px' }}>
			<h3>NavigationSidebar Component</h3>
			<p>Icon-only navigation sidebar with modern design:</p>
			<ul>
				<li>48x48px rounded rectangular containers</li>
				<li>Semi-transparent white backgrounds</li>
				<li>Hover effects and active states</li>
				<li>5 navigation buttons (Initial inquiries, My consultations, Profile, Language, Log out)</li>
				<li>24px icons, 4px vertical spacing</li>
			</ul>
			<p><strong>Implementation:</strong> `src/components/app/NavigationBar.tsx`</p>
			<p><strong>Styles:</strong> `src/components/app/navigation.styles.scss`</p>
		</div>
	)
};

