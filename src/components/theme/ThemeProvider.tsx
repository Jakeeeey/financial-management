// src/components/theme/ThemeProvider.tsx
"use client";

import * as React from "react";

type Theme = "light" | "dark" | "system";

type ThemeContextValue = {
    themes: Theme[];
    theme: Theme;
    setTheme: React.Dispatch<React.SetStateAction<string>>;
    resolvedTheme: "light" | "dark";
    systemTheme: "light" | "dark";
    forcedTheme?: Theme;
};

const STORAGE_KEY = "theme";
const THEME_VALUES: Theme[] = ["light", "dark", "system"];
const MEDIA_QUERY = "(prefers-color-scheme: dark)";

const ThemeContext = React.createContext<ThemeContextValue>({
    themes: THEME_VALUES,
    theme: "system",
    setTheme: () => { },
    resolvedTheme: "light",
    systemTheme: "light",
});

function getSystemTheme(): "light" | "dark" {
    if (typeof window === "undefined") return "light";
    return window.matchMedia(MEDIA_QUERY).matches ? "dark" : "light";
}

function normalizeTheme(value: unknown): Theme {
    return value === "light" || value === "dark" || value === "system" ? value : "system";
}

function applyThemeClass(theme: Theme, systemTheme: "light" | "dark") {
    const resolved = theme === "system" ? systemTheme : theme;
    document.documentElement.classList.toggle("dark", resolved === "dark");
}

export function useTheme() {
    return React.useContext(ThemeContext);
}

export default function ThemeProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    const [theme, setThemeState] = React.useState<Theme>("system");
    const [systemTheme, setSystemTheme] = React.useState<"light" | "dark">(getSystemTheme);

    React.useEffect(() => {
        const media = window.matchMedia(MEDIA_QUERY);
        const updateSystemTheme = () => setSystemTheme(getSystemTheme());

        setThemeState(normalizeTheme(localStorage.getItem(STORAGE_KEY)));
        updateSystemTheme();

        media.addEventListener("change", updateSystemTheme);
        return () => media.removeEventListener("change", updateSystemTheme);
    }, []);

    React.useEffect(() => {
        applyThemeClass(theme, systemTheme);
    }, [theme, systemTheme]);

    const setTheme = React.useCallback<React.Dispatch<React.SetStateAction<string>>>((value) => {
        setThemeState((previousTheme) => {
            const nextTheme = normalizeTheme(
                typeof value === "function" ? value(previousTheme) : value
            );

            try {
                localStorage.setItem(STORAGE_KEY, nextTheme);
            } catch {
                // Ignore storage failures; the in-memory theme still applies.
            }

            return nextTheme;
        });
    }, []);

    const resolvedTheme = theme === "system" ? systemTheme : theme;

    const contextValue = React.useMemo<ThemeContextValue>(() => ({
        themes: THEME_VALUES,
        theme,
        setTheme,
        resolvedTheme,
        systemTheme,
    }), [theme, setTheme, resolvedTheme, systemTheme]);

    return (
        <ThemeContext.Provider value={contextValue}>
            {children}
        </ThemeContext.Provider>
    );
}
