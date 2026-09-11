/**
 * The notifications centre route.
 *
 * One constant because the path was written out in both RouterConfig variants
 * (nav tile plus route definition, for user and consultant), in NavigationBar's
 * rail-label table keyed by that same path, and in the desktop-notification
 * click handler. Six copies is how a route rename half-lands.
 *
 * NOT the profile tab at `/profile/notifications` (profile.routes.ts). That one
 * only happens to share the last segment and is currently disabled; coupling
 * the two here would tie unrelated routes together.
 */
export const NOTIFICATIONS_ROUTE = '/notifications';
