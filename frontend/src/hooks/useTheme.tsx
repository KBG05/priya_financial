import { createContext, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light" | "system";

interface ThemeCtx {
    theme: Theme;
    setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeCtx>({ theme: "dark", setTheme: () => { } });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setThemeState] = useState<Theme>(() => {
        return (localStorage.getItem("mis-theme") as Theme) ?? "dark";
    });

    const setTheme = (t: Theme) => {
        setThemeState(t);
        localStorage.setItem("mis-theme", t);
    };

    useEffect(() => {
        const root = document.documentElement;
        const isDark =
            theme === "dark" ||
            (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
        root.classList.toggle("dark", isDark);
    }, [theme]);

    return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
