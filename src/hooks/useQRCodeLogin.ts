'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface QRCodeLoginOptions {
  apiBaseUrl: string
  onSuccess: (cookie: string, userInfo: any) => void
  onError?: (error: Error) => void
}

interface LoginState {
  status: 'idle' | 'generating' | 'waiting' | 'success' | 'failed'
  qrUrl?: string
  unikey?: string
}

export function useQRCodeLogin({ apiBaseUrl, onSuccess, onError }: QRCodeLoginOptions) {
  const [state, setState] = useState<LoginState>({ status: 'idle' })
  const [error, setError] = useState<string>('')
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null)
  const isMountedRef = useRef(true)

  const fetchNetease = useCallback(async (endpoint: string) => {
    // 前端直接调用API（浏览器可访问Vercel部署的API）
    const response = await fetch(`${apiBaseUrl}${endpoint}`, {
      headers: {
        'Referer': 'https://music.163.com/',
      },
    })
    return response.json()
  }, [apiBaseUrl])

  const startPolling = useCallback((unikey: string) => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current)
    }

    pollTimerRef.current = setInterval(async () => {
      try {
        const data = await fetchNetease(`/login/qr/check?key=${unikey}&timestamp=${Date.now()}`)

        if (!isMountedRef.current) return

        if (data.code === 200) {
          clearInterval(pollTimerRef.current!)
          setState({ status: 'success', qrUrl: state.qrUrl, unikey })
          onSuccess(data.cookie, data)
        } else if (data.code === 800) {
          clearInterval(pollTimerRef.current!)
          setState({ status: 'failed' })
          setError('二维码已过期，请重新扫码')
          onError?.(new Error('二维码已过期'))
        } else if (data.code === 801) {
        } else if (data.code === 802) {
        }
      } catch (err) {
        console.error('Polling error:', err)
      }
    }, 3000)
  }, [fetchNetease, onSuccess, onError, state.qrUrl])

  const generateQRCode = useCallback(async () => {
    try {
      setState({ status: 'generating' })
      setError('')

      const keyData = await fetchNetease(`/login/qr/key?timestamp=${Date.now()}`)

      if (!keyData.data?.unikey) {
        throw new Error('获取二维码key失败')
      }

      const unikey = keyData.data.unikey

      const qrData = await fetchNetease(`/login/qr/create?key=${unikey}&qrimg=true&timestamp=${Date.now()}`)

      if (!qrData.data?.qrimg) {
        throw new Error('生成二维码失败')
      }

      if (!isMountedRef.current) return

      setState({ status: 'waiting', qrUrl: qrData.data.qrimg, unikey })
      startPolling(unikey)
    } catch (err) {
      if (!isMountedRef.current) return
      setState({ status: 'failed' })
      setError(err instanceof Error ? err.message : '未知错误')
      onError?.(err instanceof Error ? err : new Error('未知错误'))
    }
  }, [fetchNetease, onError, startPolling])

  const cancel = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current)
      pollTimerRef.current = null
    }
    setState({ status: 'idle' })
    setError('')
  }, [])

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current)
      }
    }
  }, [])

  return {
    ...state,
    error,
    generateQRCode,
    cancel,
  }
}
