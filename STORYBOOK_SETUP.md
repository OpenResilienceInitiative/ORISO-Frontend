# Professional Storybook Setup

## Overview

This Storybook setup is configured for enterprise-grade component documentation with automatic story generation and comprehensive autodocs.

## Features

✅ **166 Meaningful Component Stories** - All real UI components documented  
✅ **Autodocs Enabled** - Automatic prop tables and documentation  
✅ **Professional Categorization** - Organized by Forms, Display, Layout, Feedback, etc.  
✅ **TypeScript Docgen** - Automatic prop extraction from TypeScript interfaces  
✅ **Enhanced Controls** - Interactive controls for all component props  
✅ **Theme Support** - Light/dark theme ready  
✅ **Auto-Generation** - Script to generate stories for new components  

## Story Categories

- **Forms**: Button, Checkbox, InputField, RadioButton, TagSelect
- **Display**: Text, Headline, Tag, Banner
- **Layout**: Box, Card, Modal
- **Feedback**: Notice, LoadingSpinner, LoadingIndicator, Spinner, Notifications, Overlay, Error
- **UI**: DragAndDropArea, FlyoutMenu, GenerateQrCode, LocaleSwitch, ProgressBar
- **Session**: SessionsList, SessionView
- **Message**: TypingIndicator
- **Profile**: Profile, EditableData
- **Registration**: AgencyRadioSelect
- **Legal**: LegalPageWrapper

## Generating Stories for New Components

Run the story generator script:

```bash
node generate-professional-stories.js
```

This will:
- Scan all components in `src/components`
- Generate stories with proper structure
- Categorize components automatically
- Enable autodocs
- Skip existing stories

## Story Structure

All stories follow this professional pattern:

```typescript
import { Meta, StoryObj } from '@storybook/react';
import { ComponentName } from './ComponentName';

const meta = {
	title: 'Components/Category/ComponentName',
	component: ComponentName,
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component: 'Component description...'
			}
		}
	},
	argTypes: {
		// Auto-generated from component props
	}
} satisfies Meta<typeof ComponentName>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: {}
};
```

## Running Storybook

```bash
npm run storybook
```

Stories will be available at `http://localhost:6006`

## Configuration Files

- `.storybook/main.ts` - Main Storybook configuration
- `.storybook/preview.tsx` - Global decorators and parameters
- `.storybook/manager.ts` - UI theme configuration
- `generate-professional-stories.js` - Auto-story generator

## Best Practices

1. **Keep stories meaningful** - Only document actual UI components
2. **Add multiple variants** - Show different states (Default, Disabled, Error, etc.)
3. **Use proper args** - Provide realistic example data
4. **Document props** - Add descriptions in argTypes
5. **Categorize correctly** - Use appropriate category in title

## Filtering Stories

Helper/util components are automatically filtered out. The generator excludes:
- Helper functions
- Utility files
- Hooks (unless they're UI components)
- Type definitions
- Constants

## Autodocs

Autodocs is enabled globally via `tags: ['autodocs']` in preview.tsx. This provides:
- Automatic prop tables from TypeScript types
- Interactive controls
- Component descriptions
- Usage examples



