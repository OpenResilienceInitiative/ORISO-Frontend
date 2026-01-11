---
description: 'React component patterns, structure, hooks, and conventions for ORISO Frontend'
globs: ['src/components/**/*.tsx', 'src/containers/**/*.tsx']
---

# React Components

## Overview

This rule defines patterns and conventions for React components in ORISO Frontend. All components use functional components with hooks - class components are not used.

## Component Structure

### File Organization

**Component file structure:**

1. Imports (React, libraries, components, utilities, types, styles)
2. Type definitions (interfaces, types)
3. Helper functions
4. Subcomponents
5. Main exported component

```typescript
// ✅ Good: Proper structure
import * as React from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import classNames from 'classnames';

import { Button } from '../button/Button';
import { Text } from '../text/Text';
import { UserDataInterface } from '../../globalState/interfaces';

import './component.styles';

interface ComponentProps {
	title: string;
	onSubmit: (data: FormData) => void;
}

const helperFunction = (value: string): boolean => {
	// Helper logic
};

const SubComponent = () => {
	// Subcomponent
};

export const Component = ({ title, onSubmit }: ComponentProps) => {
	// Component logic
};
```

### Naming Conventions

- **Component files**: `ComponentName.tsx` (PascalCase)
- **Component export**: `export const ComponentName`
- **Props interface**: `ComponentNameProps`
- **Style file**: `componentName.styles.scss` or `componentName.module.scss`

### Props Interface Pattern

```typescript
// ✅ Good: Clear, focused interface
interface ButtonProps {
	item: ButtonItem;
	buttonHandle?: Function;
	disabled?: boolean;
	className?: string;
}

// ❌ Bad: Too many props (consider composition)
interface ComponentProps {
	prop1: string;
	prop2: number;
	prop3: boolean;
	// ... 20+ more props
}
```

## Functional Components Only

**Always use functional components with hooks:**

```typescript
// ✅ Good: Functional component
export const Button = (props: ButtonProps) => {
	const { t: translate } = useTranslation();
	const [isLoading, setIsLoading] = useState(false);

	return <button>Click me</button>;
};

// ❌ Bad: Class component (not used in this project)
class Button extends React.Component {
	// ...
}
```

## Hooks Usage Guidelines

### useState

**Use for local component state:**

```typescript
// ✅ Good: Local state
const [isOpen, setIsOpen] = useState(false);
const [formData, setFormData] = useState<FormData>({ email: '' });

// ❌ Bad: Global state in useState
const [userData, setUserData] = useState<UserData | null>(null); // Use Context instead
```

### useEffect

**Use for side effects (API calls, subscriptions, DOM manipulation):**

```typescript
// ✅ Good: Proper cleanup
useEffect(() => {
	const subscription = subscribe();

	return () => {
		subscription.unsubscribe();
	};
}, [dependencies]);

// ✅ Good: API call with cleanup
useEffect(() => {
	let cancelled = false;

	fetchData().then((data) => {
		if (!cancelled) {
			setData(data);
		}
	});

	return () => {
		cancelled = true;
	};
}, []);
```

**Dependency array rules:**

- Include all values from component scope that change between renders
- Empty array `[]` for mount-only effects
- No array for effects that run on every render (rare)

### useCallback

**Use sparingly - only when passing function to memoized child:**

```typescript
// ✅ Good: Memoized callback for memoized child
const handleClick = useCallback(() => {
	onClick(id);
}, [id, onClick]);

// ❌ Bad: Unnecessary memoization
const handleClick = useCallback(() => {
	console.log('clicked');
}, []); // No dependencies, no memoization needed
```

### useMemo

**Use only for expensive calculations:**

```typescript
// ✅ Good: Expensive calculation
const sortedItems = useMemo(() => {
	return items.sort((a, b) => a.price - b.price);
}, [items]);

// ❌ Bad: Simple calculation doesn't need memoization
const total = useMemo(() => {
	return items.reduce((sum, item) => sum + item.price, 0);
}, [items]); // Simple reduce, no memoization needed
```

### Custom Hooks

**Extract reusable logic to custom hooks:**

```typescript
// ✅ Good: Custom hook
const useAppConfig = () => {
	const config = useContext(AppConfigContext);
	return config;
};

// Usage
const Component = () => {
	const config = useAppConfig();
	// ...
};
```

**Custom hooks in project:**

- `useAppConfig` - App configuration
- `useSession` - Session data
- `useMatrixReady` - Matrix client readiness
- `useResponsive` - Responsive breakpoints
- `useDebounceCallback` - Debounced callbacks

## Component Composition

### Composition over Configuration

```typescript
// ✅ Good: Composition
<Modal>
	<ModalHeader title="Settings" />
	<ModalBody>
		<SettingsForm />
	</ModalBody>
	<ModalFooter>
		<Button onClick={handleSave}>Save</Button>
	</ModalFooter>
</Modal>

// ❌ Bad: Configuration via props
<Modal
	hasHeader={true}
	headerTitle="Settings"
	hasFooter={true}
	footerButtons={[...]}
/>
```

### Children Pattern

```typescript
// ✅ Good: Children prop
interface BoxProps {
	title?: string;
	children: ReactNode;
}

export const Box = ({ title, children }: BoxProps) => (
	<div className="box">
		{title && <div className="box__title">{title}</div>}
		<div className="box__content">{children}</div>
	</div>
);
```

## State Management in Components

### Local State (useState)

**Use for component-specific, non-shared state:**

```typescript
const [isOpen, setIsOpen] = useState(false);
const [inputValue, setInputValue] = useState('');
```

### Global State (Context)

**Use Context for shared state across components:**

```typescript
// ✅ Good: Context for shared state
const userData = useContext(UserDataContext);
const sessions = useContext(SessionsDataContext);
```

**Context providers in project:**

- `UserDataProvider` - User information
- `SessionsDataProvider` - Session list
- `NotificationsProvider` - Notifications
- `AppConfigProvider` - App configuration

### Jotai Atoms

**Use for simple, isolated state:**

```typescript
// ✅ Good: Jotai atom
import { useAtom } from 'jotai';
import { agencyLogoAtom } from '../../store/agencyLogoAtom';

const Component = () => {
	const [logo, setLogo] = useAtom(agencyLogoAtom);
	// ...
};
```

## Event Handlers

**Always prefix with "handle":**

```typescript
// ✅ Good: handle prefix
const handleClick = (e: MouseEvent) => {
	e.preventDefault();
	onClick();
};

const handleSubmit = (e: FormEvent) => {
	e.preventDefault();
	onSubmit(formData);
};

const handleKeyDown = (e: KeyboardEvent) => {
	if (e.key === 'Enter') {
		handleSubmit();
	}
};
```

## Component Examples

### Button Component

See `src/components/button/Button.tsx`:

- Functional component with hooks
- Proper TypeScript interfaces
- Event handlers with "handle" prefix
- SCSS classes (no inline styles)
- Accessibility attributes
- i18n integration

### InputField Component

See `src/components/inputField/InputField.tsx`:

- Local state management
- Event handlers
- Validation logic
- Accessibility (labels, ARIA)
- Conditional rendering

### Box Component

See `src/components/box/Box.tsx`:

- CSS modules usage
- Composition pattern (children)
- Conditional rendering
- TypeScript enums

## Anti-Patterns to Avoid

1. **Class Components**: Use functional components only
2. **Prop Drilling**: Use Context for deeply nested props
3. **Unnecessary Re-renders**: Check dependencies in hooks
4. **Missing Cleanup**: Always cleanup subscriptions/effects
5. **Inline Functions**: Use useCallback when passing to memoized children
6. **Premature Optimization**: Don't memoize everything
7. **Large Components**: Break into smaller, focused components
8. **Mixed Concerns**: Separate presentation from logic

## Checklist

When creating a component:

- [ ] Functional component with hooks
- [ ] TypeScript interface for props
- [ ] Event handlers prefixed with "handle"
- [ ] SCSS classes used (no inline styles)
- [ ] Accessibility attributes (aria-label, tabIndex, keyboard handlers)
- [ ] Proper cleanup in useEffect
- [ ] State management appropriate (local vs. global)
- [ ] Component is focused and single-purpose
- [ ] Proper file structure and imports

## References

- `src/components/button/Button.tsx` - Complete component example
- `src/components/inputField/InputField.tsx` - Form component example
- `src/components/box/Box.tsx` - CSS modules example
- `src/hooks/` - Custom hooks examples
- `src/globalState/provider/` - Context provider examples
