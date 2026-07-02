import { Download, X } from 'lucide-react'
import { useState, useEffect } from 'react'

interface DownloadJob {
  jobId: string
  total: number
  completed: number
  failed: number
  status: 'pending' | 'downloading' | 'completed' | 'failed'
  progress: number
  error?: string
  tracks: any[]
  createdAt: string
}

interface BatchDownloadModalProps {
  isOpen: boolean
  onClose: () => void
  jobs: DownloadJob[]
}

export function BatchDownloadModal({ isOpen, onClose, jobs }: BatchDownloadModalProps) {
  const [selectedJobs, setSelectedJobs] = useState<string[]>([])
  const [polling, setPolling] = useState<Set<string>>(new Set())

  // 自动选择所有待下载任务
  useEffect(() => {
    if (isOpen && selectedJobs.length === 0) {
      const pendingJobIds = jobs
        .filter(j => j.status !== 'completed' && j.status !== 'failed')
        .map(j => j.jobId)
      
      if (pendingJobIds.length > 0) {
        setSelectedJobs(pendingJobIds)
        setPolling(new Set(pendingJobIds))
      }
    }
  }, [isOpen, jobs])

  // 开始批量下载
  const handleStart = async () => {
    if (selectedJobs.length === 0) {
      alert('请先选择要下载的歌曲')
      return
    }

    try {
      const response = await fetch('/api/music/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'createBatch',
          tracks: selectedJobs.map(jobId => {
            const job = jobs.find(j => j.jobId === jobId)
            return job?.tracks[0] || {}
          }),
        }),
      })

      const data = await response.json()

      if (data.success) {
        alert(`批量下载任务已创建，共${selectedJobs.length}首歌曲`)
      } else {
        alert(data.error || '创建下载任务失败')
      }
    } catch (error) {
      console.error('批量下载失败:', error)
      alert('批量下载失败，请重试')
    }
  }

  // if (!isOpen) return null

  const totalProgress = jobs.reduce((sum, job) => sum + job.completed, 0)
  const totalJobs = jobs.length
  const completedJobs = jobs.filter(j => j.status === 'completed').length
  const failedJobs = jobs.filter(j => j.status === 'failed').length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-3xl rounded-xl p-6 space-y-4" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">批量下载</h3>
          <button onClick={onClose} className="p-2 hover:bg-accent rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 任务列表 */}
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {jobs.map((job) => (
            <div
              key={job.jobId}
              className={`p-4 rounded-lg border space-y-2 transition-all ${job.status === 'downloading' ? 'bg-blue-50' : 'bg-card'}`}
            >
              {/* 任务头 */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={`job-${job.jobId}`}
                    checked={selectedJobs.includes(job.jobId)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedJobs(prev => [...prev, job.jobId])
                        setPolling(prev => new Set(prev).add(job.jobId))
                      } else {
                        setSelectedJobs(prev => prev.filter(id => id !== job.jobId))
                        polling.delete(job.jobId)
                      }
                    }}
                    disabled={job.status === 'downloading'}
                    className="w-4 h-4"
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium">{job.total}首</span>
                    {job.status === 'completed' ? (
                      <span className="text-green-500 ml-1">✓ 完成</span>
                    ) : job.status === 'failed' ? (
                      <span className="text-red-500 ml-1">✗ 失败</span>
                    ) : job.status === 'downloading' ? (
                      <span className="text-blue-500">下载中...</span>
                    ) : null}
                    <span className="text-xs text-muted-foreground ml-2">({job.completed}/{job.total})</span>
                  </div>
                </div>

                {/* 进度条 */}
                <div className="flex-1">
                  <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all duration-300"
                      style={{ width: `${job.progress}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">{job.progress}%</span>
                </div>

                {/* 错误信息 */}
                {job.error && (
                  <p className="text-xs text-red-500 mt-1">{job.error}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* 底部操作栏 */}
        <div className="p-4 border-t space-y-3 bg-card rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (selectedJobs.length === 0) {
                    const allPending = jobs
                      .filter(j => j.status !== 'completed' && j.status !== 'failed')
                      .map(j => j.jobId)
                    setSelectedJobs(allPending)
                    setPolling(new Set(allPending))
                  } else {
                    setSelectedJobs([])
                    setPolling(new Set())
                  }
                }}
                className="text-sm text-blue-500 hover:text-blue-400 underline"
              >
                {selectedJobs.length === selectedJobs.length ? '全不选' : '全选'}
              </button>
            </div>

            <div className="text-sm text-muted-foreground">
              已选 {selectedJobs.length} 项，
              共 {jobs.length} 项
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleStart}
                disabled={selectedJobs.length === 0 || jobs.some(j => j.status === 'downloading')}
                className="flex-1 items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <Download className="w-5 h-5" />
                开始下载
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-border hover:bg-accent transition-all"
              >
                关闭
              </button>
            </div>

            {/* 总体进度 */}
            <div className="mt-4 pt-4 border-t">
              <div className="flex items-center gap-2">
                <span className="text-sm">总体进度:</span>
                <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-300"
                    style={{ width: `${(totalProgress / totalJobs) * 100}%` }}
                  />
                </div>
                <span className="text-sm font-medium ml-2">{totalProgress}/{totalJobs}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                完成: {completedJobs} | 失败: {failedJobs}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
