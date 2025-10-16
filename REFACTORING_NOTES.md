# Refactoring Notes

## Test Improvements
- **Admin Dashboard Tests**: Refactor to focus more on JavaScript functionality rather than specific styling classes
  - Currently tests rely on specific class names like `animate-pulse`, `bg-gray-200`, etc.
  - Should focus on testing loading states, error handling, and component behavior
  - Consider using data-testid attributes or testing library queries that focus on functionality
  - Priority: Medium

## Future Considerations
- Separate styling concerns from functional testing
- Use semantic testing approaches (role-based queries, accessible names)
- Focus on user interactions and component state rather than implementation details