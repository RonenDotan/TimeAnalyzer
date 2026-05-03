import React, { createContext, useContext } from 'react';

export interface ColorPalette {
  background: string;
  surface: string;
  surfaceSecondary: string;
  text: string;
  textSecondary: string;
  border: string;
  accent: string;
  placeholder: string;
  recordBtn: string;
  overlay: string;
}

export const lightColors: ColorPalette = {
  background: '#f2f2f7',
  surface: '#ffffff',
  surfaceSecondary: '#f0f6ff',
  text: '#000000',
  textSecondary: '#6d6d72',
  border: '#c6c6c8',
  accent: '#007AFF',
  placeholder: '#aaaaaa',
  recordBtn: '#ff3b30',
  overlay: 'rgba(0,0,0,0.4)',
};

export const darkColors: ColorPalette = {
  background: '#1c1c1e',
  surface: '#2c2c2e',
  surfaceSecondary: '#1a2a3a',
  text: '#ffffff',
  textSecondary: '#8e8e93',
  border: '#3a3a3c',
  accent: '#0a84ff',
  placeholder: '#636366',
  recordBtn: '#ff453a',
  overlay: 'rgba(0,0,0,0.65)',
};

interface ThemeContextValue {
  isDark: boolean;
  colors: ColorPalette;
}

const ThemeContext = createContext<ThemeContextValue>({
  isDark: false,
  colors: lightColors,
});

export function ThemeProvider({
  isDark,
  children,
}: {
  isDark: boolean;
  children: React.ReactNode;
}) {
  return (
    <ThemeContext.Provider value={{ isDark, colors: isDark ? darkColors : lightColors }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
