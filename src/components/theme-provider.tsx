import { createContext, useContext, useEffect, useState } from "react"

export type Theme = "default" | "blue" | "green" | "purple" | "orange" | "red"
export type ColorMode = "dark" | "light"

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
  defaultMode?: ColorMode
  themeStorageKey?: string
  modeStorageKey?: string
}

type ThemeProviderState = {
  theme: Theme
  mode: ColorMode
  setTheme: (theme: Theme) => void
  setMode: (mode: ColorMode) => void
}

const initialState: ThemeProviderState = {
  theme: "default",
  mode: "dark",
  setTheme: () => null,
  setMode: () => null,
}

const ThemeProviderContext = createContext<ThemeProviderState>(initialState)

export function ThemeProvider({
  children,
  defaultTheme = "default",
  defaultMode = "dark",
  themeStorageKey = "vite-ui-theme",
  modeStorageKey = "vite-ui-mode",
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(themeStorageKey) as Theme) || defaultTheme
  )
  const [mode, setMode] = useState<ColorMode>(
    () => (localStorage.getItem(modeStorageKey) as ColorMode) || defaultMode
  )

  useEffect(() => {
    const root = window.document.documentElement

    root.removeAttribute("data-theme")

    if (theme !== "default") {
      root.setAttribute("data-theme", theme)
    }
    localStorage.setItem(themeStorageKey, theme)
  }, [theme, themeStorageKey])

  useEffect(() => {
    const root = window.document.documentElement
    root.classList.remove("dark")
    if (mode === "dark") {
      root.classList.add("dark")
    }
    localStorage.setItem(modeStorageKey, mode)
  }, [mode, modeStorageKey])

  const value = {
    theme,
    mode,
    setTheme: (theme: Theme) => {
      setTheme(theme)
    },
    setMode: (mode: ColorMode) => {
      setMode(mode)
    },
  }

  return (
    <ThemeProviderContext.Provider value={value} {...props}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext)

  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider")

  return context
}
