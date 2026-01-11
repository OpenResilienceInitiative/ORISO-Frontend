---
description: 'Code review guidelines, quality gates, and review criteria for ORISO Frontend'
alwaysApply: true
---

# Code Review Checklist

## Overview

This checklist ensures code quality, consistency, and adherence to project standards during code reviews.

## Code Quality

### Functionality

- [ ] Code works as intended
- [ ] All functionality is implemented (no TODOs)
- [ ] Edge cases are handled
- [ ] Error handling is implemented
- [ ] No console.logs or debug code left in

### Code Completeness

- [ ] No placeholders or missing pieces
- [ ] All imports are included
- [ ] All types/interfaces are defined
- [ ] Code is production-ready

## Code Standards

### TypeScript

- [ ] All props have TypeScript interfaces
- [ ] All functions have return types
- [ ] No `any` types (use `unknown` if needed)
- [ ] Event handlers properly typed
- [ ] Types/interfaces follow naming conventions

### React Components

- [ ] Functional components with hooks (no classes)
- [ ] Event handlers prefixed with "handle"
- [ ] Component follows file structure pattern
- [ ] Props interface named `ComponentNameProps`
- [ ] Exports use named exports

### Styling

- [ ] SCSS classes used (no inline styles)
- [ ] BEM naming convention followed
- [ ] Style file co-located with component
- [ ] CSS variables used for theming (if applicable)
- [ ] Responsive design implemented

## Best Practices

### SOLID Principles

- [ ] Single responsibility principle followed
- [ ] Components are focused and single-purpose
- [ ] Code is DRY (no duplication)
- [ ] YAGNI principle followed (no unnecessary features)

### Code Readability

- [ ] Variable and function names are descriptive
- [ ] Early returns used for readability
- [ ] Code is easy to understand
- [ ] Comments added only when necessary

### Performance

- [ ] Lazy loading used for routes/heavy components
- [ ] Memoization only where needed (measured)
- [ ] No unnecessary re-renders
- [ ] Dependencies correct in hooks

## Accessibility

### Required Features

- [ ] All interactive elements have tabIndex
- [ ] All interactive elements have aria-label
- [ ] Keyboard handlers implemented (onKeyDown)
- [ ] Form inputs have labels
- [ ] Error messages linked to inputs (aria-describedby)
- [ ] Images have alt text or aria-hidden
- [ ] Focus indicators visible

## API Integration

### API Patterns

- [ ] Uses fetchData utility (not direct fetch)
- [ ] Uses FETCH_METHODS constants
- [ ] Error handling implemented
- [ ] JSON body stringified (if applicable)
- [ ] skipAuth set correctly
- [ ] Follows naming convention (apiActionName)

## Security

### Security Measures

- [ ] CSRF tokens included (handled by fetchData)
- [ ] No sensitive data logged
- [ ] Input validation implemented
- [ ] User content sanitized (if applicable)
- [ ] Tokens handled securely

## Testing

### Test Coverage

- [ ] Critical paths are tested (if applicable)
- [ ] Cypress tests use data-cy attributes
- [ ] Storybook stories created/updated
- [ ] Test data uses fixtures

## Internationalization

### Translations

- [ ] All user-facing text uses translation keys
- [ ] Translation keys are descriptive
- [ ] Appropriate namespace used
- [ ] Translation files updated (if new keys)

## File Organization

### File Structure

- [ ] File naming follows conventions
- [ ] Files are in correct locations
- [ ] Imports are organized correctly
- [ ] Related files are co-located

## Matrix Integration

### Matrix Patterns

- [ ] Uses MatrixClientService (not direct client)
- [ ] Waits for PREPARED sync state
- [ ] Error handling implemented
- [ ] Event listeners cleaned up

## State Management

### State Patterns

- [ ] Right tool chosen (useState vs. Context vs. Jotai)
- [ ] State is as close to usage as possible
- [ ] No prop drilling
- [ ] Context providers properly structured

## Documentation

### Code Documentation

- [ ] Complex logic is commented
- [ ] Component props are clear
- [ ] Function purposes are clear
- [ ] No unnecessary comments

## Review Focus Areas

### High Priority

1. Functionality and correctness
2. Security vulnerabilities
3. Accessibility requirements
4. Error handling
5. TypeScript types

### Medium Priority

1. Code organization and structure
2. Performance optimization
3. Testing coverage
4. Code readability

### Low Priority

1. Code style (handled by Prettier)
2. Minor refactoring suggestions
3. Documentation improvements

## Review Comments

### Constructive Feedback

**Good review comments:**

- Explain why the change is needed
- Suggest specific improvements
- Reference project conventions
- Provide code examples when helpful

**Example:**

> "This component should use the fetchData utility instead of direct fetch. See `src/api/apiGetUserData.ts` for the pattern. This ensures consistent error handling and CSRF protection."

### Approval Criteria

**Code should be approved when:**

- All checklist items are met
- Code follows project conventions
- No security issues
- Functionality works as expected
- Code is maintainable

## Common Issues

### Frequently Found Issues

1. Missing accessibility attributes
2. No error handling
3. Missing TypeScript types
4. Inline styles instead of SCSS
5. Direct fetch instead of fetchData
6. Missing event handler prefix "handle"
7. No keyboard support
8. Hardcoded strings instead of translations

## References

- All other cursor rules for detailed guidelines
- `src/components/button/Button.tsx` - Reference component
- `src/api/apiGetUserData.ts` - Reference API function
- Project documentation
