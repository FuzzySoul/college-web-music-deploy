$ErrorActionPreference = 'Stop'

$edgePaths = @(
    'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
    'C:\Program Files\Microsoft\Edge\Application\msedge.exe'
)

$edge = $edgePaths | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $edge) {
    throw 'Microsoft Edge not found.'
}

$profile = 'C:\Users\62003\edge-split-proxy-profile'
$proxy = '192.168.124.3:8080'
$bypassList = @(
    '<-loopback>',
    '*.cn',
    '*.com.cn',
    '*.net.cn',
    '*.org.cn',
    '*.gov.cn',
    '*.edu.cn',
    '*.baidu.com',
    '*.bilibili.com',
    '*.qq.com',
    '*.wechat.com',
    '*.weixin.com',
    '*.taobao.com',
    '*.tmall.com',
    '*.jd.com',
    '*.163.com',
    '*.126.com',
    '*.sina.com.cn',
    '*.weibo.com',
    '*.zhihu.com',
    '*.douyin.com',
    '*.xiaohongshu.com',
    '*.aliyun.com',
    '*.alibabacloud.com',
    '*.tencent.com',
    '*.csdn.net',
    '*.cnblogs.com'
) -join ';'

if (-not (Test-Path $profile)) {
    New-Item -ItemType Directory -Path $profile | Out-Null
}

Start-Process -FilePath $edge -ArgumentList @(
    '--user-data-dir=' + $profile,
    '--remote-debugging-port=9225',
    '--no-first-run',
    '--proxy-server=' + $proxy,
    '--proxy-bypass-list=' + $bypassList,
    'about:blank'
)

Write-Output "Edge started"
Write-Output "Proxy: $proxy"
Write-Output "Bypass: $bypassList"
