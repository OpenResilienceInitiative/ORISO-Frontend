/**
 * *19 (Frank, 2026-11-17): "Meine Direktlinks" is retired as a page of its
 * own. The links (copy, QR code, edit) now sit in the calendar list under
 * "Links ohne Termin"; old bookmarks of /direct-links land there.
 */
import * as React from 'react';
import { Navigate } from 'react-router-dom';

export const DirectLinksMoved = () => <Navigate to="/booking/events" replace />;
