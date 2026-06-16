export const APP_THEME_STORAGE_KEY = 'sjcl-app-theme'
export const APP_MODE_STORAGE_KEY = 'sjcl-color-mode'

export const APP_THEMES = [
  {
    id: 'military',
    name: '军绿主题',
    primary: 'emerald',
    neutral: 'olive',
    radius: '0rem'
  },
  {
    id: 'style1',
    name: '风格1',
    primary: 'sky',
    neutral: 'neutral',
    radius: '0.25rem'
  },
  {
    id: 'style2',
    name: '风格2',
    primary: 'indigo',
    neutral: 'gray',
    radius: '0.125rem'
  }
]

export const DEFAULT_APP_THEME = 'style1'
export const DEFAULT_COLOR_MODE = 'dark'

export const getThemeById = (themeId) => {
  return APP_THEMES.find(theme => theme.id === themeId) || APP_THEMES.find(theme => theme.id === DEFAULT_APP_THEME)
}
