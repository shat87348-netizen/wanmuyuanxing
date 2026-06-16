const TOKEN_KEY = 'sjcl_auth_token'
const USER_KEY = 'sjcl_auth_user'

export const getAuthToken = () => localStorage.getItem(TOKEN_KEY) || ''

export const getCurrentUser = () => {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || 'null')
  } catch {
    return null
  }
}

export const setAuthSession = ({ token, user }) => {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export const clearAuthSession = () => {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

export const isAuthenticated = () => Boolean(getAuthToken())
