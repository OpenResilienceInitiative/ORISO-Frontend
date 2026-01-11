---
description: 'SOLID, KISS, DRY, YAGNI principles and code quality guidelines for ORISO Frontend'
alwaysApply: true
---

# Coding Principles

## Overview

This rule defines the fundamental coding principles that guide all development in the ORISO Frontend project. These principles ensure code quality, maintainability, and consistency across the codebase.

## Core Principles

### SOLID Principles

#### Single Responsibility Principle (SRP)

Each component, function, or module should have one reason to change.

**Example from codebase:**

```typescript
// ✅ Good: Button component only handles button rendering and interaction
export const Button = (props: ButtonProps) => {
	const handleButtonClick = (event) => {
		// Button-specific logic only
	};
	// ...
};

// ❌ Bad: Component that handles multiple responsibilities
const UserProfileButton = () => {
	// Fetches user data
	// Renders button
	// Handles authentication
	// Updates global state
};
```

**ORISO Application:**

- API functions (`apiGetUserData.ts`) only fetch data, don't transform it
- Components focus on rendering and user interaction
- Services (`matrixClientService.ts`) handle specific domain logic
- Utilities (`generateCsrfToken.ts`) have single, focused purposes

#### Open/Closed Principle (OCP)

Software entities should be open for extension but closed for modification.

**Example:**

```typescript
// ✅ Good: Extend via composition
interface ButtonProps {
	item: ButtonItem;
	className?: string;
	customIcon?: JSX.Element; // Extension point
}

// ❌ Bad: Modify base component for every new feature
const Button = ({ type, primary, secondary, tertiary, link, ... }) => {
	// Hard to extend without modifying
};
```

**ORISO Application:**

- Component props allow extension without modification
- Context providers can be composed (`ProviderComposer`)
- API functions accept optional `responseHandling` for extension

#### Liskov Substitution Principle (LSP)

Objects should be replaceable with instances of their subtypes.

**ORISO Application:**

- Interface implementations are interchangeable
- `ButtonItem` interface allows different button types to be used interchangeably
- Context providers follow consistent patterns

#### Interface Segregation Principle (ISP)

Clients should not depend on interfaces they don't use.

**Example:**

```typescript
// ✅ Good: Small, focused interfaces
interface ButtonItem {
	type: string;
	label?: string;
	disabled?: boolean;
}

interface ButtonProps {
	item: ButtonItem;
	buttonHandle?: Function;
}

// ❌ Bad: Large interface with unused properties
interface ComponentProps {
	// 50+ properties, most unused
}
```

**ORISO Application:**

- Props interfaces are focused and specific
- API response types match actual usage
- Context interfaces expose only needed data

#### Dependency Inversion Principle (DIP)

Depend on abstractions, not concretions.

**ORISO Application:**

- Components depend on Context interfaces, not implementations
- API functions use `fetchData` abstraction, not direct fetch
- Services use interfaces for Matrix client, not concrete implementations

### KISS (Keep It Simple, Stupid)

Prefer simple solutions over complex ones. Complexity should only be added when necessary.

**When to Keep It Simple:**

- Use `useState` for local state instead of Context
- Use simple conditional rendering instead of complex state machines
- Prefer straightforward API calls over complex abstractions

**When Complexity is Justified:**

- Matrix client initialization (requires sync state management)
- Multi-tenant theming (requires CSS variable system)
- Real-time message handling (requires event bridge)

**Example:**

```typescript
// ✅ Simple: Direct state management
const [isLoading, setIsLoading] = useState(false);

// ❌ Overcomplicated: Unnecessary abstraction
const [state, dispatch] = useReducer(complexReducer, initialState);
```

### DRY (Don't Repeat Yourself)

Extract common patterns into reusable utilities, hooks, or components.

**ORISO Patterns:**

- `fetchData` utility eliminates repeated fetch logic
- Custom hooks (`useAppConfig`, `useSession`) extract common logic
- Shared components (`Button`, `InputField`) prevent duplication
- Utility functions (`generateCsrfToken`, `validateInputValue`) centralize logic

**Example:**

```typescript
// ✅ DRY: Reusable utility
export const fetchData = ({ url, method, ... }: FetchDataProps) => {
	// Centralized fetch logic
};

// ❌ Repetitive: Duplicated fetch logic in every API function
const apiGetUser = async () => {
	const token = getValueFromCookie('keycloak');
	const csrf = generateCsrfToken();
	// ... repeated in every function
};
```

**When NOT to DRY:**

- Premature abstraction before pattern is clear
- Over-abstracting simple, one-off code
- Creating abstractions that are harder to understand than duplication

### YAGNI (You Aren't Gonna Need It)

Don't add functionality until it's actually needed.

**ORISO Application:**

- Don't create "future-proof" abstractions
- Don't add features "just in case"
- Don't optimize prematurely
- Focus on current requirements

**Example:**

```typescript
// ✅ YAGNI: Simple, current requirement
const Button = ({ item, buttonHandle }: ButtonProps) => {
	// Handles current button needs
};

// ❌ YAGNI Violation: Over-engineered for future needs
const Button = ({ item, buttonHandle, analytics, tracking, themes, ... }) => {
	// Features not currently needed
};
```

## Code Quality Metrics

### What Makes "Good Code" in ORISO Frontend

1. **Readable**: Code is self-documenting with clear naming
2. **Maintainable**: Easy to modify and extend
3. **Testable**: Components and functions can be tested in isolation
4. **Consistent**: Follows project conventions and patterns
5. **Type-Safe**: Uses TypeScript interfaces and types
6. **Accessible**: Implements ARIA attributes and keyboard navigation
7. **Performant**: Uses appropriate optimization techniques (lazy loading, memoization when needed)
8. **Secure**: Handles tokens, CSRF, and user input safely

### Code Smells to Avoid

- **God Components**: Components that do too much
- **Prop Drilling**: Passing props through many layers
- **Magic Numbers/Strings**: Use constants instead
- **Deep Nesting**: Extract logic to separate functions
- **Long Functions**: Break into smaller, focused functions
- **Duplicate Code**: Extract to utilities or hooks
- **Tight Coupling**: Depend on abstractions, not implementations

## Refactoring Opportunities

### Common Patterns to Refactor

1. **Extract Custom Hooks**: Repeated logic in multiple components
2. **Create Utility Functions**: Duplicated helper logic
3. **Simplify Component Props**: Too many props indicate need for composition
4. **Consolidate State**: Multiple related state variables should be objects
5. **Extract Constants**: Magic strings/numbers should be constants

### Example Refactoring

```typescript
// Before: Duplicated validation logic
const ComponentA = () => {
	const validate = (value) => {
		if (value.length > 10) return false;
		if (!/^[a-z]+$/.test(value)) return false;
		return true;
	};
};

const ComponentB = () => {
	const validate = (value) => {
		if (value.length > 10) return false;
		if (!/^[a-z]+$/.test(value)) return false;
		return true;
	};
};

// After: DRY - Extracted utility
// utils/validateInputValue.ts
export const validateInputValue = (value: string): boolean => {
	if (value.length > 10) return false;
	if (!/^[a-z]+$/.test(value)) return false;
	return true;
};
```

## Checklist

When writing code, ensure:

- [ ] Component/function has single responsibility
- [ ] Code is simple and readable
- [ ] Common logic is extracted (DRY)
- [ ] No unnecessary features (YAGNI)
- [ ] Interfaces are small and focused
- [ ] Dependencies are on abstractions
- [ ] Code follows project conventions

## References

- `src/components/button/Button.tsx` - Example of focused component
- `src/api/fetchData.ts` - Example of DRY utility
- `src/utils/` - Reusable utilities following DRY
- `src/hooks/` - Custom hooks extracting common logic
