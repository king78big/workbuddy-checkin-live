<#
一键部署到 Cloudflare Workers（纯 REST，不需要 node / wrangler）

用法：双击同目录的 deploy.cmd
或者在 PowerShell 里：
  powershell -NoProfile -ExecutionPolicy Bypass -File deploy.ps1

需要的 Cloudflare API Token 权限：
  Account - Workers Scripts - Edit
  Account - Workers KV Storage - Edit
（dash.cloudflare.com/profile/api-tokens，模板选 "Edit Cloudflare Workers" 最省事）
#>

param(
  [string]$Token,
  [string]$AccountId,
  [string]$Name = "signin-all",
  [string]$AdminToken,
  [string]$MasterKey,
  [string]$Cron = "10 0 * * *"
)

$ErrorActionPreference = "Stop"
$script:ApiBase = "https://api.cloudflare.com/client/v4"

function Read-Secret([string]$prompt) {
  $sec = Read-Host -Prompt $prompt -AsSecureString
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
  return [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
}

function Invoke-Cf([string]$method, [string]$path, $body) {
  $uri = $script:ApiBase + $path
  $headers = @{ Authorization = "Bearer " + $script:Token }
  if ($null -eq $body) {
    $resp = Invoke-RestMethod -Method $method -Uri $uri -Headers $headers
  } else {
    $json = ConvertTo-Json -InputObject $body -Depth 10 -Compress
    $resp = Invoke-RestMethod -Method $method -Uri $uri -Headers $headers -ContentType "application/json" -Body $json
  }
  if (-not $resp.success) {
    $errText = ConvertTo-Json -InputObject $resp.errors -Depth 5 -Compress
    throw "接口返回失败: $path -> $errText"
  }
  return $resp.result
}

Write-Host ""
Write-Host "=== 签到控制台 · 部署到 Cloudflare ===" -ForegroundColor Cyan
Write-Host ""

# 1. Token
if ([string]::IsNullOrWhiteSpace($Token)) {
  $script:Token = Read-Secret "粘贴 Cloudflare API Token"
} else {
  $script:Token = $Token
}
if ([string]::IsNullOrWhiteSpace($script:Token)) { throw "Token 不能为空" }

# 2. 账号
if ([string]::IsNullOrWhiteSpace($AccountId)) {
  Write-Host "读取账号列表..." -ForegroundColor Cyan
  $raw = Invoke-Cf "GET" "/accounts?per_page=50" $null
  $accts = @($raw)
  if ($accts.Count -eq 0) { throw "这个 Token 看不到任何账号，检查权限" }
  if ($accts.Count -eq 1) {
    $AccountId = $accts[0].id
  } else {
    $i = 0
    foreach ($a in $accts) {
      $line = "  {0}) {1}  {2}" -f $i, $a.name, $a.id
      Write-Host $line
      $i = $i + 1
    }
    $picked = Read-Host "选择账号序号（直接回车用 0）"
    if ([string]::IsNullOrWhiteSpace($picked)) { $picked = "0" }
    $AccountId = $accts[[int]$picked].id
  }
}
Write-Host ("账号: " + $AccountId)

# 3. 登录密码
if ([string]::IsNullOrWhiteSpace($AdminToken)) {
  $AdminToken = Read-Secret "设置页面登录密码（ADMIN_TOKEN，16 位以上）"
}
if ($AdminToken.Length -lt 8) { throw "密码太短，至少 8 位" }

# 4. 主密钥
if ([string]::IsNullOrWhiteSpace($MasterKey)) {
  $bytes = New-Object byte[] 32
  $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
  $rng.GetBytes($bytes)
  $MasterKey = [Convert]::ToBase64String($bytes)
}

# 5. KV
Write-Host ""
Write-Host "[1/5] KV 命名空间" -ForegroundColor Cyan
$kvTitle = $Name + "-kv"
$listPath = "/accounts/" + $AccountId + "/storage/kv/namespaces?per_page=100"
$all = @(Invoke-Cf "GET" $listPath $null)
$hit = $all | Where-Object { $_.title -eq $kvTitle } | Select-Object -First 1
if ($null -ne $hit) {
  $kvId = $hit.id
  Write-Host ("  复用已有: " + $kvTitle + " (" + $kvId + ")")
} else {
  $createPath = "/accounts/" + $AccountId + "/storage/kv/namespaces"
  $kv = Invoke-Cf "POST" $createPath @{ title = $kvTitle }
  $kvId = $kv.id
  Write-Host ("  新建: " + $kvTitle + " (" + $kvId + ")")
}

# 6. 上传 worker
Write-Host "[2/5] 上传 worker.js" -ForegroundColor Cyan
$workerPath = Join-Path $PSScriptRoot "worker.js"
if (-not (Test-Path $workerPath)) { throw "找不到 worker.js，请把它放在本脚本同一目录" }
$codeBytes = [IO.File]::ReadAllBytes($workerPath)

$bindingList = @(
  @{ type = "kv_namespace"; name = "KV"; namespace_id = $kvId },
  @{ type = "secret_text"; name = "MASTER_KEY"; text = $MasterKey },
  @{ type = "secret_text"; name = "ADMIN_TOKEN"; text = $AdminToken }
)
$meta = @{
  main_module        = "worker.js"
  compatibility_date = "2026-11-20"
  bindings           = $bindingList
}
$metaJson = ConvertTo-Json -InputObject $meta -Depth 10 -Compress

$boundary = "----wbcheckin" + [Guid]::NewGuid().ToString("N")
$nl = [char]13 + [char]10
$enc = [Text.Encoding]::UTF8
$ms = New-Object IO.MemoryStream

function Add-Str([string]$s) {
  $b = $enc.GetBytes($s)
  $ms.Write($b, 0, $b.Length)
}

Add-Str ("--" + $boundary + $nl)
Add-Str ("Content-Disposition: form-data; name=`"metadata`"" + $nl)
Add-Str ("Content-Type: application/json" + $nl + $nl)
Add-Str ($metaJson + $nl)
Add-Str ("--" + $boundary + $nl)
Add-Str ("Content-Disposition: form-data; name=`"worker.js`"; filename=`"worker.js`"" + $nl)
Add-Str ("Content-Type: application/javascript+module" + $nl + $nl)
$ms.Write($codeBytes, 0, $codeBytes.Length)
Add-Str ($nl)
Add-Str ("--" + $boundary + "--" + $nl)

$uploadBytes = $ms.ToArray()
$ms.Dispose()

$uploadPath = "/accounts/" + $AccountId + "/workers/scripts/" + $Name
$headers = @{ Authorization = "Bearer " + $script:Token }
$uploadResp = Invoke-RestMethod -Method Put -Uri ($script:ApiBase + $uploadPath) -Headers $headers `
  -ContentType ("multipart/form-data; boundary=" + $boundary) -Body $uploadBytes
if (-not $uploadResp.success) {
  $e = ConvertTo-Json -InputObject $uploadResp.errors -Depth 5 -Compress
  throw "上传失败: $e"
}
Write-Host ("  已上传: " + $Name)

# 7. 打开 workers.dev
Write-Host "[3/5] 开启 workers.dev 访问" -ForegroundColor Cyan
$subPath = "/accounts/" + $AccountId + "/workers/scripts/" + $Name + "/subdomain"
try {
  Invoke-Cf "POST" $subPath @{ enabled = $true } | Out-Null
  Write-Host "  已开启"
} catch {
  Write-Host "  跳过（可能已开启）" -ForegroundColor Yellow
}
$subInfo = Invoke-Cf "GET" ("/accounts/" + $AccountId + "/workers/subdomain") $null
$url = "https://" + $Name + "." + $subInfo.subdomain + ".workers.dev"

# 8. Cron
Write-Host "[4/5] 配置定时任务" -ForegroundColor Cyan
$cronArray = @( @{ cron = $Cron } )
$schedPath = "/accounts/" + $AccountId + "/workers/scripts/" + $Name + "/schedules"
Invoke-Cf "PUT" $schedPath $cronArray | Out-Null
Write-Host ("  已设置: " + $Cron + " (UTC)")

# 9. 验证
Write-Host "[5/5] 验证" -ForegroundColor Cyan
$settingsPath = "/accounts/" + $AccountId + "/workers/scripts/" + $Name + "/settings"
$cfg = Invoke-Cf "GET" $settingsPath $null
$names = @()
foreach ($b in $cfg.bindings) { $names += ($b.name + ":" + $b.type) }
Write-Host ("  绑定: " + ($names -join ", "))

$checkSched = Invoke-Cf "GET" $schedPath $null
$cronLine = "  (未读到)"
if ($null -ne $checkSched.schedules) {
  $cronLine = "  cron: "
  foreach ($s in $checkSched.schedules) { $cronLine = $cronLine + $s.cron + " " }
}
Write-Host $cronLine

Write-Host ""
Write-Host "================ 部署完成 ================" -ForegroundColor Green
Write-Host ("地址      : " + $url)
Write-Host ("登录密码  : " + $AdminToken)
Write-Host ("MASTER_KEY: " + $MasterKey)
Write-Host ("KV 名称   : " + $kvTitle + " (" + $kvId + ")")
Write-Host ""
Write-Host "把 MASTER_KEY 存进密码管理器 —— 丢了只能全部重新扫码。" -ForegroundColor Yellow
Write-Host "打开上面的地址，用登录密码进去，逐个添加账号。" -ForegroundColor Yellow
