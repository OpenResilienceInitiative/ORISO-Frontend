import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

/**
 * ResizableSidebar Component
 * 
 * This component provides a resizable sidebar for sessions list with:
 * - Drag-to-resize functionality (min: 80px, max: 600px)
 * - Icon-only mode when width < 220px
 * - User avatars displayed in minimized mode
 * - Matches Element chat application behavior
 * 
 * **Note:** This component requires multiple context providers (UserDataContext, 
 * SessionTypeContext, LanguagesContext, etc.) to function properly. For a 
 * complete working example, see the main application.
 * 
 * **Implementation:** `src/components/sessionsList/SessionsListWrapper.tsx`
 * **Resize Handle:** `src/components/sessionsList/ResizableHandle.tsx`
 * **Styles:** `src/components/sessionsList/sessionsList.styles.scss`
 */
const meta: Meta = {
	title: 'Components/Layout/ResizableSidebar',
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component: 'Resizable sidebar for sessions list. Supports drag-to-resize functionality with icon-only mode when width < 220px. Mimics Element chat application behavior. Requires context providers to render in Storybook.'
			}
		}
	}
};

export default meta;
type Story = StoryObj;

/**
 * Documentation only - Component requires context providers
 * 
 * The ResizableSidebar component is integrated into the main application
 * and requires the following context providers:
 * - UserDataContext
 * - SessionTypeContext  
 * - LanguagesContext
 * - SessionsDataContext
 * - RocketChatContext
 * 
 * See the main application for a working example.
 */
export const Documentation: Story = {
	render: () => (
		<div style={{ padding: '20px' }}>
			<h3>ResizableSidebar Component</h3>
			<p>This component provides:</p>
			<ul>
				<li>Drag-to-resize functionality (80px - 600px)</li>
				<li>Icon-only mode when width &lt; 220px</li>
				<li>User avatars in minimized view</li>
				<li>LocalStorage persistence for width</li>
			</ul>
			<p><strong>Implementation:</strong> `src/components/sessionsList/SessionsListWrapper.tsx`</p>
			<p><strong>Resize Handle:</strong> `src/components/sessionsList/ResizableHandle.tsx`</p>
		</div>
	)
};

