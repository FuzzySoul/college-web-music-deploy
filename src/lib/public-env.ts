function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '')
}

export const PUBLIC_CACHE_API_URL = stripTrailingSlash(
  process.env.NEXT_PUBLIC_CACHE_API_URL || ''
)

export const PUBLIC_NETEASE_API_URL = stripTrailingSlash(
  process.env.NEXT_PUBLIC_NETEASE_API_URL || ''
)
