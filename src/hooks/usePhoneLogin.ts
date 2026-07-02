'use client'

import { useState, useCallback, useRef, useEffect } from 'react'

interface PhoneLoginOptions {
  apiBaseUrl: string
  onSuccess: (cookie: string, userInfo: any) => void
  onError?: (error: Error) => void
}

interface LoginState {
  status: 'idle' | 'sending' | 'verifying' | 'success' | 'failed'
  phone: string
  captcha: string
  countdown: number
}

export function usePhoneLogin({ apiBaseUrl, onSuccess, onError }: PhoneLoginOptions) {
  const [state, setState] = useState<LoginState>({
    status: 'idle',
    phone: '',
    captcha: '',
    countdown: 0,
  })
  const [error, setError] = useState<string>('')
  const countdownRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current)
      }
    }
  }, [])

  const fetchNetease = useCallback(async (endpoint: string) => {
    const response = await fetch(`${apiBaseUrl}${endpoint}`, {
      headers: {
        'Referer': 'https://music.163.com/',
      },
    })
    return response.json()
  }, [apiBaseUrl])

  const sendCaptcha = useCallback(async (phone: string) => {
    try {
      setError('')
      setState(prev => ({ ...prev, status: 'sending', phone }))

      if (!/^1[3-9]\d{9}$/.test(phone)) {
        throw new Error('请输入正确的手机号码')
      }

      const data = await fetchNetease(`/captcha/sent?phone=${phone}`)

      if (data.code === 200) {
        setState(prev => ({ ...prev, status: 'idle', countdown: 60 }))
        
        if (countdownRef.current) clearInterval(countdownRef.current)
        countdownRef.current = setInterval(() => {
          setState(prev => {
            if (prev.countdown <= 1) {
              if (countdownRef.current) clearInterval(countdownRef.current)
              return { ...prev, countdown: 0 }
            }
            return { ...prev, countdown: prev.countdown - 1 }
          })
        }, 1000)

        return { success: true }
      } else {
        throw new Error(data.message || '发送验证码失败')
      }
    } catch (err) {
      setState(prev => ({ ...prev, status: 'failed' }))
      const msg = err instanceof Error ? err.message : '未知错误'
      setError(msg)
      onError?.(err instanceof Error ? err : new Error(msg))
      return { success: false, error: err }
    }
  }, [fetchNetease, onError])

  const login = useCallback(async (phone: string, captcha: string) => {
    try {
      setError('')
      setState(prev => ({ ...prev, status: 'verifying', phone, captcha }))

      if (!/^1[3-9]\d{9}$/.test(phone)) {
        throw new Error('请输入正确的手机号码')
      }

      if (!/^\d{4,6}$/.test(captcha)) {
        throw new Error('请输入4-6位验证码')
      }

      const data = await fetchNetease(`/login/cellphone?phone=${phone}&captcha=${captcha}`)

      if (data.code === 200) {
        if (countdownRef.current) {
          clearInterval(countdownRef.current)
          countdownRef.current = null
        }
        
        setState(prev => ({ ...prev, status: 'success' }))
        onSuccess(data.cookie, data)
        return { success: true, data }
      } else if (data.code === 400) {
        throw new Error(data.message || '验证码错误')
      } else if (data.code === 503) {
        throw new Error(data.message || '请求过于频繁，请稍后重试')
      } else {
        throw new Error(data.message || '登录失败')
      }
    } catch (err) {
      setState(prev => ({ ...prev, status: 'failed' }))
      const msg = err instanceof Error ? err.message : '未知错误'
      setError(msg)
      onError?.(err instanceof Error ? err : new Error(msg))
      return { success: false, error: err }
    }
  }, [fetchNetease, onSuccess, onError])

  const reset = useCallback(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current)
      countdownRef.current = null
    }
    setState({
      status: 'idle',
      phone: '',
      captcha: '',
      countdown: 0,
    })
    setError('')
  }, [])

  return {
    ...state,
    error,
    sendCaptcha,
    login,
    reset,
  }
}
