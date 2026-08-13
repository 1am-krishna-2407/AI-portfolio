'use client'

import { useEffect, useState } from 'react'
import { Moon, SunMedium } from 'lucide-react'

export function ThemeToggle() {
  const [isDark, setIsDark] = useState<boolean | null>(null)

  useEffect(() => {
    const saved = localStorage.getItem('theme')
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const initialDark = saved ? saved === 'dark' : prefersDark
    document.documentElement.classList.toggle('dark', initialDark)
    setIsDark(initialDark)
  }, [])

  const toggleTheme = () => {
    const nextTheme = !Boolean(isDark)
    document.documentElement.classList.toggle('dark', nextTheme)
    localStorage.setItem('theme', nextTheme ? 'dark' : 'light')
    setIsDark(nextTheme)
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-900 transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-900"
      aria-label="Toggle theme"
    >
      {isDark === null ? <SunMedium className="h-5 w-5" /> : isDark ? <Moon className="h-5 w-5" /> : <SunMedium className="h-5 w-5" />}
    </button>
  )
}
