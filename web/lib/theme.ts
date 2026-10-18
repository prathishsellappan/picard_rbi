// The light/dark theme choice is kept in a small cookie, so the server can render <html> with the
// right data-theme straight away: no inline script and no flash of the wrong theme.
export const THEME_COOKIE = "picard-theme";
export type Theme = "light" | "dark";
