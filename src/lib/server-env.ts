function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '')
}

export const SERVER_CACHE_API_URL = stripTrailingSlash(
  process.env['CACHE_API_URL'] ||
    process.env['NEXT_PUBLIC_CACHE_API_URL'] ||
    'http://localhost:8000'
)

export const SERVER_NETEASE_API_URL = stripTrailingSlash(
  process.env['NETEASE_API_URL'] ||
    process.env['NEXT_PUBLIC_NETEASE_API_URL'] ||
    'http://localhost:3000'
)

export const SERVER_MEDIA_API_URL = stripTrailingSlash(
  process.env['MEDIA_API_URL'] ||
    process.env['NEXT_PUBLIC_MEDIA_API_URL'] ||
    ''
)

export function withBaseUrl(baseUrl: string, path: string): string {
  if (!baseUrl) return path
  return `${stripTrailingSlash(baseUrl)}${path.startsWith('/') ? path : `/${path}`}`
}
