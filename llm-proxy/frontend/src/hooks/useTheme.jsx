import { createContext, useContext, useEffect, useState } from 'react';
import { getConfig, setConfig } from '../services/api';

const ThemeContext = createContext();

// eslint-disable-next-line react-refresh/only-export-components
export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }) => {
    const [theme, setTheme] = useState('system'); // 'light', 'dark', or 'system'
    const [isDarkMode, setIsDarkMode] = useState(false);

    // Initialize theme from database on mount
    useEffect(() => {
        const initTheme = async () => {
            try {
                const config = await getConfig('THEME_PREFERENCE');
                if (config && config.value) {
                    setTheme(config.value);
                }
            } catch (err) {
                console.error("Failed to fetch theme config, falling back to system:", err);
            }
        };
        initTheme();
    }, []);

    // Apply theme changes
    useEffect(() => {
        const applyTheme = (currentTheme) => {
            if (currentTheme === 'dark') {
                document.documentElement.classList.add('dark');
                setIsDarkMode(true);
            } else if (currentTheme === 'light') {
                document.documentElement.classList.remove('dark');
                setIsDarkMode(false);
            } else {
                // system
                if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                    document.documentElement.classList.add('dark');
                    setIsDarkMode(true);
                } else {
                    document.documentElement.classList.remove('dark');
                    setIsDarkMode(false);
                }
            }
        };

        applyTheme(theme);

        // Listener for system theme changes if set to 'system'
        if (theme === 'system' && window.matchMedia) {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            const handleChange = (e) => {
                if (e.matches) {
                    document.documentElement.classList.add('dark');
                    setIsDarkMode(true);
                } else {
                    document.documentElement.classList.remove('dark');
                    setIsDarkMode(false);
                }
            };
            mediaQuery.addEventListener('change', handleChange);
            return () => mediaQuery.removeEventListener('change', handleChange);
        }
    }, [theme]);

    const handleSetTheme = async (newTheme) => {
        setTheme(newTheme);
        try {
            await setConfig('THEME_PREFERENCE', newTheme);
        } catch (err) {
            console.error("Failed to save theme to config:", err);
        }
    };

    return (
        <ThemeContext.Provider value={{ theme, setTheme: handleSetTheme, isDarkMode }}>
            {children}
        </ThemeContext.Provider>
    );
};
