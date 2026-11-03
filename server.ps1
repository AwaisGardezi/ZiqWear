# ==========================================================================
#  ZIQWEAR - local preview server with email support
#  Serves this folder over http://localhost:<port> using only what already
#  ships with Windows. No Python, no Node, nothing to install.
#  Started by START-ZIQWEAR.bat - you should not need to run it directly.
#
#  Email: POST /api/email with JSON body sends mail through Gmail SMTP.
#  Credentials are read from .env next to this script (SMTP_USER / SMTP_PASS).
# ==========================================================================

param(
  [int]$Port = 8777,
  [string]$Root = ""
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($Root)) {
  $Root = Split-Path -Parent $MyInvocation.MyCommand.Path
}
$Root = (Resolve-Path -LiteralPath $Root).Path
$RootWithSep = $Root.TrimEnd("\") + "\"

# ---------------------------------------------------------------- file types
$Mime = @{
  ".html"  = "text/html; charset=utf-8"
  ".htm"   = "text/html; charset=utf-8"
  ".css"   = "text/css; charset=utf-8"
  ".js"    = "application/javascript; charset=utf-8"
  ".mjs"   = "application/javascript; charset=utf-8"
  ".json"  = "application/json; charset=utf-8"
  ".map"   = "application/json"
  ".txt"   = "text/plain; charset=utf-8"
  ".xml"   = "application/xml; charset=utf-8"
  ".png"   = "image/png"
  ".jpg"   = "image/jpeg"
  ".jpeg"  = "image/jpeg"
  ".gif"   = "image/gif"
  ".svg"   = "image/svg+xml"
  ".webp"  = "image/webp"
  ".avif"  = "image/avif"
  ".ico"   = "image/x-icon"
  ".woff"  = "font/woff"
  ".woff2" = "font/woff2"
  ".ttf"   = "font/ttf"
  ".otf"   = "font/otf"
  ".mp4"   = "video/mp4"
  ".webm"  = "video/webm"
  ".pdf"   = "application/pdf"
}

# ---------------------------------------------------------- email configuration
# Credentials come from the process environment, or from a local .env file that is
# never committed and never copied into a client package. Mail stays off when absent.
$EnvDotFiles = @((Join-Path $Root ".env"), (Join-Path $Root "backend\.env"))

function Read-DotEnvValue {
  param([string]$Key)
  foreach ($file in $EnvDotFiles) {
    if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { continue }
    foreach ($line in [System.IO.File]::ReadAllLines($file)) {
      $t = $line.Trim()
      if ($t.StartsWith("#") -or -not $t.Contains("=")) { continue }
      $k = $t.Substring(0, $t.IndexOf("=")).Trim()
      if ($k -ne $Key) { continue }
      $v = $t.Substring($t.IndexOf("=") + 1).Trim()
      if ($v.Length -ge 2 -and (($v[0] -eq '"' -and $v[-1] -eq '"') -or ($v[0] -eq "'" -and $v[-1] -eq "'"))) {
        $v = $v.Substring(1, $v.Length - 2)
      }
      return $v
    }
  }
  return ""
}

function Get-EmailSetting {
  param([string]$EnvKey, [string]$Default = "")
  $v = [Environment]::GetEnvironmentVariable($EnvKey)
  if ([string]::IsNullOrWhiteSpace($v)) { $v = Read-DotEnvValue $EnvKey }
  if ([string]::IsNullOrWhiteSpace($v)) { return $Default }
  return $v
}

function Get-EmailConfig {
  $user = Get-EmailSetting "SMTP_USER"
  $pass = Get-EmailSetting "SMTP_PASS"
  if ([string]::IsNullOrWhiteSpace($user) -or [string]::IsNullOrWhiteSpace($pass)) {
    return $null
  }
  return [pscustomobject]@{
    smtpHost     = Get-EmailSetting "SMTP_HOST" "smtp.gmail.com"
    smtpPort     = Get-EmailSetting "SMTP_PORT" "587"
    gmailAddress = $user
    appPassword  = $pass
    ownerEmail   = Get-EmailSetting "ZIQ_OWNER_EMAIL" $user
    storeName    = Get-EmailSetting "ZIQ_STORE_NAME" "ZIQWEAR"
  }
}

$EmailConfig = Get-EmailConfig

# ------------------------------------------------------- send email via Gmail SMTP
function Send-StoreEmail {
  param(
    [string]$Subject,
    [string]$Body,
    [string]$ReplyTo = "",
    [string]$ToEmail = ""
  )

  if (-not $EmailConfig) {
    return @{ ok = $false; error = "Email not configured. Set SMTP_USER and SMTP_PASS in .env." }
  }

  # If no recipient is given, send to the store owner.
  # If toEmail is provided, send to the customer (e.g. order tracking).
  $recipient = $EmailConfig.ownerEmail
  if ($ToEmail -and $ToEmail -match "^[^@\s]+@[^@\s]+\.[^@\s]+$") {
    $recipient = $ToEmail
  }

  try {
    $msg = New-Object System.Net.Mail.MailMessage
    $msg.From = New-Object System.Net.Mail.MailAddress($EmailConfig.gmailAddress, $EmailConfig.storeName)
    $msg.To.Add($recipient)
    $msg.Subject = $Subject
    $msg.Body = $Body
    $msg.IsBodyHtml = $false
    $msg.BodyEncoding = [System.Text.Encoding]::UTF8
    $msg.SubjectEncoding = [System.Text.Encoding]::UTF8

    # Always CC the store owner so they see customer notifications too.
    if ($ToEmail -and $ToEmail -match "^[^@\s]+@[^@\s]+\.[^@\s]+$") {
      $msg.CC.Add($EmailConfig.ownerEmail)
    }

    if ($ReplyTo -and $ReplyTo -match "^[^@\s]+@[^@\s]+\.[^@\s]+$") {
      $msg.ReplyToList.Add($ReplyTo)
    }

    $smtp = New-Object System.Net.Mail.SmtpClient($EmailConfig.smtpHost, [int]$EmailConfig.smtpPort)
    $smtp.EnableSsl = $true
    $smtp.DeliveryMethod = [System.Net.Mail.SmtpDeliveryMethod]::Network
    $smtp.UseDefaultCredentials = $false
    $smtp.Credentials = New-Object System.Net.NetworkCredential($EmailConfig.gmailAddress, $EmailConfig.appPassword)
    $smtp.Timeout = 15000

    $smtp.Send($msg)
    $smtp.Dispose()
    $msg.Dispose()

    return @{ ok = $true }
  } catch {
    $errMsg = $_.Exception.Message
    return @{ ok = $false; error = $errMsg }
  }
}

# ---------------------------------------------------------- handle /api/email
function Handle-EmailApi {
  param($req, $res)

  $res.ContentType = "application/json; charset=utf-8"
  $res.Headers.Add("Access-Control-Allow-Origin", "http://localhost:$Port")
  $res.Headers.Add("Access-Control-Allow-Methods", "POST, OPTIONS")
  $res.Headers.Add("Access-Control-Allow-Headers", "Content-Type")

  # CORS preflight
  if ($req.HttpMethod -eq "OPTIONS") {
    $res.StatusCode = 204
    return
  }

  if ($req.HttpMethod -ne "POST") {
    $res.StatusCode = 405
    $body = '{"ok":false,"error":"Method not allowed"}'
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
    $res.ContentLength64 = $bytes.Length
    $res.OutputStream.Write($bytes, 0, $bytes.Length)
    return
  }

  # read the request body
  $bodyText = ""
  try {
    $stream = $req.InputStream
    $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::UTF8)
    $bodyText = $reader.ReadToEnd()
    $reader.Dispose()
  } catch {
    $res.StatusCode = 400
    $body = '{"ok":false,"error":"Could not read request body"}'
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
    $res.ContentLength64 = $bytes.Length
    $res.OutputStream.Write($bytes, 0, $bytes.Length)
    return
  }

  # parse JSON
  $data = $null
  try {
    $data = $bodyText | ConvertFrom-Json
  } catch {
    $res.StatusCode = 400
    $body = '{"ok":false,"error":"Invalid JSON"}'
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
    $res.ContentLength64 = $bytes.Length
    $res.OutputStream.Write($bytes, 0, $bytes.Length)
    return
  }

  # ZIQ_MAIL_OFF=1 previews checkout without mailing the shop on every test
  # order. The browser still receives ok:true, so the storefront behaves
  # exactly as it does with sending enabled.
  if (-not [string]::IsNullOrWhiteSpace($env:ZIQ_MAIL_OFF)) {
    $res.StatusCode = 200
    $skipped = '{"ok":true,"skipped":"mail disabled by ZIQ_MAIL_OFF"}'
    $sbytes = [System.Text.Encoding]::UTF8.GetBytes($skipped)
    $res.ContentLength64 = $sbytes.Length
    $res.OutputStream.Write($sbytes, 0, $sbytes.Length)
    Write-Host "  mail   skipped (ZIQ_MAIL_OFF is set)" -ForegroundColor DarkYellow
    return
  }

  # validate required fields
  $subject = [string]$data.subject
  $message = [string]$data.message
  $replyTo = [string]$data.replyTo
  $fromName = [string]$data.fromName
  $toEmail = [string]$data.toEmail

  if ([string]::IsNullOrWhiteSpace($subject)) { $subject = "Website enquiry" }
  if ([string]::IsNullOrWhiteSpace($message)) {
    $res.StatusCode = 400
    $body = '{"ok":false,"error":"Message is empty"}'
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
    $res.ContentLength64 = $bytes.Length
    $res.OutputStream.Write($bytes, 0, $bytes.Length)
    return
  }

  # build the full email body with a header so you know where it came from
  $emailBody = ""
  if ($fromName) { $emailBody += "From: $fromName`r`n" }
  if ($replyTo)  { $emailBody += "Email: $replyTo`r`n" }
  if ($toEmail)  { $emailBody += "Sent to: $toEmail`r`n" }
  $emailBody += "-----------------------------------`r`n`r`n"
  $emailBody += $message
  $emailBody += "`r`n`r`n-----------------------------------`r`n"
  $emailBody += "Sent from the ZIQWEAR website."

  $result = Send-StoreEmail -Subject $subject -Body $emailBody -ReplyTo $replyTo -ToEmail $toEmail

  if ($result.ok) {
    $res.StatusCode = 200
    $body = '{"ok":true}'
  } else {
    $res.StatusCode = 500
    $errEscaped = ($result.error -replace '"', '\"' -replace '`r`n', ' ')
    $body = "{`"ok`":false,`"error`":`"$errEscaped`"}"
  }

  $bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
  $res.ContentLength64 = $bytes.Length
  if ($req.HttpMethod -ne "HEAD") {
    $res.OutputStream.Write($bytes, 0, $bytes.Length)
  }
}

# ------------------------------------------------------- order storage (server-side)
# Orders are saved to orders.json so the admin sees every order regardless
# of which browser placed it. This fixes the localStorage isolation problem.
$OrdersFile = Join-Path $Root "orders.json"

function Get-Orders {
  if (-not (Test-Path -LiteralPath $OrdersFile -PathType Leaf)) {
    return @()
  }
  try {
    # Read as UTF-8 explicitly. Without a BOM, Windows PowerShell 5.1 falls
    # back to the ANSI codepage, and every save then re-encodes the mojibake
    # deeper - product titles with curly quotes are destroyed within a cycle.
    $raw = [System.IO.File]::ReadAllText(
      $OrdersFile,
      (New-Object System.Text.UTF8Encoding($false))
    )
    if ([string]::IsNullOrWhiteSpace($raw)) { return @() }
    $parsed = $raw | ConvertFrom-Json
    # ConvertFrom-Json returns a single object for one-item arrays,
    # so normalise to an array we can iterate.
    if ($parsed -is [array]) { return $parsed }
    return @($parsed)
  } catch {
    return @()
  }
}

function Save-Orders {
  param($Orders)
  try {
    # Force array serialization so single-order files still parse as [array]
    $list = @($Orders)
    $json = $list | ConvertTo-Json -Depth 6
    # If only one item, ConvertTo-Json produces a single object, not an array.
    # Wrap it in [ ] so it always parses as an array.
    if ($list.Count -eq 1) {
      $json = "[" + $json + "]"
    }
    # Write BOM-free. Set-Content -Encoding UTF8 prepends a byte-order mark,
    # which makes the file unparseable for any Node reader (JSON.parse throws
    # on the leading U+FEFF), and a BOM accumulates on every rewrite.
    [System.IO.File]::WriteAllText(
      $OrdersFile,
      $json,
      (New-Object System.Text.UTF8Encoding($false))
    )
  } catch {
    Write-Host "  WARNING: could not save orders.json" -ForegroundColor Red
  }
}

# -------------------------------------------------------- backend mirroring
# The Express backend on :4000 owns the real order database, and orders.json is
# only a local mirror so the storefront still works while the backend is down.
# Every write is forwarded too, otherwise the two stores drift apart and an
# order placed here never reaches the admin dashboard.
# Best effort: an unreachable backend must never fail the storefront request.
$BackendUrl = if ([string]::IsNullOrWhiteSpace($env:ZIQ_BACKEND_URL)) {
  "http://localhost:4000/api"
} else {
  $env:ZIQ_BACKEND_URL
}

$BackendQueue = @()
$BackendSkipUntil = [datetime]::MinValue

function Forward-ToBackend {
  param($Suffix, $BodyText)
  if ([string]::IsNullOrWhiteSpace($BodyText)) { return }

  # Queue first, send later: an order that could not be mirrored stays here and
  # goes out with the next attempt instead of being dropped. orders.json is the
  # durable copy, so this queue is only about keeping the database in step.
  $script:BackendQueue += ,@{ Suffix = $Suffix; Body = $BodyText }
  if ($script:BackendQueue.Count -gt 50) {
    $script:BackendQueue = @($script:BackendQueue)[(-50..($script:BackendQueue.Count - 1))]
  }

  $now = Get-Date
  if ($now -lt $script:BackendSkipUntil) { return }

  $script:BackendSkipUntil = $now.AddSeconds(20)
  $batch = @($script:BackendQueue)
  $script:BackendQueue = @()

  for ($i = 0; $i -lt $batch.Count; $i++) {
    $item = $batch[$i]
    try {
      Invoke-WebRequest `
        -Uri ($BackendUrl.TrimEnd("/") + $item.Suffix) `
        -Method Post `
        -ContentType "application/json; charset=utf-8" `
        -Body ([System.Text.Encoding]::UTF8.GetBytes($item.Body)) `
        -TimeoutSec 1 `
        -UseBasicParsing | Out-Null
    } catch {
      # Backend is down or slow: stop trying for a moment and put the failed
      # write back with everything that had not been sent yet. A local preview
      # must never wait on it.
      $rest = @($batch[$i..($batch.Count - 1)])
      $script:BackendQueue = @(@($rest) + @($script:BackendQueue))
      Write-Host ("  mirror  backend not reachable, " + $script:BackendQueue.Count + " write(s) queued for retry") -ForegroundColor DarkGray
      return
    }
  }

  if ($batch.Count -gt 0) {
    Write-Host ("  mirror  " + $batch.Count + " write(s) -> " + $BackendUrl) -ForegroundColor DarkCyan
  }
}

function Handle-OrdersApi {
  param($req, $res)

  $res.ContentType = "application/json; charset=utf-8"
  $res.Headers.Add("Access-Control-Allow-Origin", "http://localhost:$Port")
  $res.Headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
  $res.Headers.Add("Access-Control-Allow-Headers", "Content-Type")

  if ($req.HttpMethod -eq "OPTIONS") {
    $res.StatusCode = 204
    return
  }

  $path = $req.Url.AbsolutePath

  # GET /api/orders  - return all orders
  if ($req.HttpMethod -eq "GET") {
    $orders = Get-Orders
    if ($orders.Count -eq 0) {
      $json = "[]"
    } else {
      $json = $orders | ConvertTo-Json -Depth 6
      if ($orders.Count -eq 1) { $json = "[" + $json + "]" }
    }
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
    $res.StatusCode = 200
    $res.ContentLength64 = $bytes.Length
    $res.OutputStream.Write($bytes, 0, $bytes.Length)
    return
  }

  # POST /api/orders        - save a new order
  # POST /api/orders/status - update an order status
  if ($req.HttpMethod -eq "POST") {
    $bodyText = ""
    try {
      $stream = $req.InputStream
      $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::UTF8)
      $bodyText = $reader.ReadToEnd()
      $reader.Dispose()
    } catch {
      $res.StatusCode = 400
      $body = '{"ok":false,"error":"Could not read request body"}'
      $bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
      $res.ContentLength64 = $bytes.Length
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
      return
    }

    $data = $null
    try {
      $data = $bodyText | ConvertFrom-Json
    } catch {
      $res.StatusCode = 400
      $body = '{"ok":false,"error":"Invalid JSON"}'
      $bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
      $res.ContentLength64 = $bytes.Length
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
      return
    }

    if ($path -eq "/api/orders/status") {
      # Update order status
      $orderId = [string]$data.orderId
      $status = [string]$data.status
      if ([string]::IsNullOrWhiteSpace($orderId) -or [string]::IsNullOrWhiteSpace($status)) {
        $res.StatusCode = 400
        $body = '{"ok":false,"error":"orderId and status are required"}'
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
        $res.ContentLength64 = $bytes.Length
        $res.OutputStream.Write($bytes, 0, $bytes.Length)
        return
      }

      $orders = Get-Orders
      $found = $false
      for ($i = 0; $i -lt $orders.Count; $i++) {
        if ([string]$orders[$i].id -eq [string]$orderId) {
          $orders[$i].status = $status
          $found = $true
          break
        }
      }

      if (-not $found) {
        $res.StatusCode = 404
        $body = '{"ok":false,"error":"Order not found"}'
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
        $res.ContentLength64 = $bytes.Length
        $res.OutputStream.Write($bytes, 0, $bytes.Length)
        return
      }

      Save-Orders $orders
      Forward-ToBackend "/orders/status" $bodyText
      $res.StatusCode = 200
      $body = '{"ok":true}'
      $bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
      $res.ContentLength64 = $bytes.Length
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
      return
    }

    if ($path -eq "/api/orders/delete") {
      # Delete an order
      $orderId = [string]$data.orderId
      if ([string]::IsNullOrWhiteSpace($orderId)) {
        $res.StatusCode = 400
        $body = '{"ok":false,"error":"orderId is required"}'
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
        $res.ContentLength64 = $bytes.Length
        $res.OutputStream.Write($bytes, 0, $bytes.Length)
        return
      }

      $orders = Get-Orders
      $newOrders = @()
      $found = $false
      for ($i = 0; $i -lt $orders.Count; $i++) {
        if ([string]$orders[$i].id -eq [string]$orderId) {
          $found = $true
        } else {
          $newOrders += $orders[$i]
        }
      }

      if (-not $found) {
        $res.StatusCode = 404
        $body = '{"ok":false,"error":"Order not found"}'
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
        $res.ContentLength64 = $bytes.Length
        $res.OutputStream.Write($bytes, 0, $bytes.Length)
        return
      }

      Save-Orders $newOrders
      Forward-ToBackend "/orders/delete" $bodyText
      $res.StatusCode = 200
      $body = '{"ok":true}'
      $bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
      $res.ContentLength64 = $bytes.Length
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
      return
    }

    # Save a new order
    $orderId = [string]$data.id
    if ([string]::IsNullOrWhiteSpace($orderId)) {
      $res.StatusCode = 400
      $body = '{"ok":false,"error":"Order ID is required"}'
      $bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
      $res.ContentLength64 = $bytes.Length
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
      return
    }

    $orders = Get-Orders

    # Check if order already exists (avoid duplicates)
    $exists = $false
    for ($i = 0; $i -lt $orders.Count; $i++) {
      if ([string]$orders[$i].id -eq [string]$orderId) { $exists = $true; break }
    }

    if (-not $exists) {
      $orders = @($data) + $orders
      Save-Orders $orders
      Forward-ToBackend "/orders" $bodyText
    }

    $res.StatusCode = 200
    $body = '{"ok":true}'
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
    $res.ContentLength64 = $bytes.Length
    $res.OutputStream.Write($bytes, 0, $bytes.Length)
    return
  }

  # Any other method
  $res.StatusCode = 405
  $body = '{"ok":false,"error":"Method not allowed"}'
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
  $res.ContentLength64 = $bytes.Length
  $res.OutputStream.Write($bytes, 0, $bytes.Length)
}

# ------------------------------------------------------------ free port hunt
function Get-FreePort {
  param([int]$Start, [int]$End)
  for ($p = $Start; $p -le $End; $p++) {
    $busy = $false
    try {
      $probe = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $p)
      $probe.Start()
      $probe.Stop()
    } catch {
      $busy = $true
    }
    if (-not $busy) { return $p }
  }
  return 0
}

# ------------------------------------------------------- URL -> safe file path
# Rejects anything that tries to climb out of the site folder, so a crafted
# request like ../../Windows/win.ini can never be served.
function Resolve-SiteFile {
  param([string]$UrlPath)

  $rel = $UrlPath
  $q = $rel.IndexOf("?")
  if ($q -ge 0) { $rel = $rel.Substring(0, $q) }

  $rel = [System.Uri]::UnescapeDataString($rel)
  $rel = $rel.TrimStart("/")
  $rel = $rel -replace "/", "\"
  if ([string]::IsNullOrWhiteSpace($rel)) { $rel = "index.html" }

  $full = ""
  try {
    $full = [System.IO.Path]::GetFullPath((Join-Path $Root $rel))
  } catch {
    return $null
  }

  if (-not $full.StartsWith($RootWithSep, [System.StringComparison]::OrdinalIgnoreCase)) {
    return $null
  }

  if (Test-Path -LiteralPath $full -PathType Container) {
    $full = Join-Path $full "index.html"
  }
  return $full
}

function Get-MimeType {
  param([string]$Path)
  $ext = [System.IO.Path]::GetExtension($Path).ToLower()
  if ($Mime.ContainsKey($ext)) { return $Mime[$ext] }
  return "application/octet-stream"
}

# ------------------------------------------------------- SEO: sitemap + robots
# Both are generated per request so the absolute URLs follow the host that
# actually served the page. On :8777 that is the Host header (localhost:8777);
# behind nginx in production it is the forwarded host/proto, so the same code
# stays correct on the real domain and under the /legacy/ mount. Nothing here
# hard-codes a domain - the on-disk files are only a template whose placeholder
# origin (https://ziqwear.com) is swapped for the live base.

function ConvertTo-XmlText {
  param([string]$s)
  if ($null -eq $s) { return "" }
  # & first, then the rest, so we never double-escape the entity we just added.
  return ($s -replace '&', '&amp;' -replace '<', '&lt;' -replace '>', '&gt;' -replace '"', '&quot;')
}

function Get-RequestBase {
  param($req)
  $scheme = $null
  $hostHeader = $null
  try { $scheme = $req.Headers["X-Forwarded-Proto"] } catch { }
  if ([string]::IsNullOrWhiteSpace($scheme)) { $scheme = $req.Url.Scheme }
  else { $scheme = ($scheme -split ',')[0].Trim() }
  try { $hostHeader = $req.Headers["Host"] } catch { }
  if ([string]::IsNullOrWhiteSpace($hostHeader)) { $hostHeader = $req.Url.Authority }
  else { $hostHeader = ($hostHeader -split ',')[0].Trim() }
  $base = $scheme.TrimEnd('/') + "://" + $hostHeader.TrimEnd('/')
  return $base.TrimEnd('/')
}

# Active products from the seed catalogue (data.js). data.js is the product
# universe the static storefront itself renders, so its real handles are exactly
# the URLs the site serves today: product.html?p=<handle>.
function Get-ActiveProductUrls {
  param([string]$Base)
  $dataPath = Join-Path $Root "assets\js\data.js"
  if (-not (Test-Path -LiteralPath $dataPath -PathType Leaf)) { return @() }

  $txt = ""
  try {
    $txt = [System.IO.File]::ReadAllText(
      $dataPath,
      (New-Object System.Text.UTF8Encoding($false))
    )
  } catch { return @() }

  # data.js is `window.SEED_DATA = { ... };` - the object literal is plain JSON.
  $start = $txt.IndexOf("{")
  $end = $txt.LastIndexOf("}")
  if ($start -lt 0 -or $end -le $start) { return @() }
  $json = $txt.Substring($start, $end - $start + 1)

  $obj = $null
  try { $obj = $json | ConvertFrom-Json } catch { return @() }
  if (-not $obj -or -not $obj.products) { return @() }

  $utc = [TimeSpan]::Zero
  $out = @()
  foreach ($p in @($obj.products)) {
    if ($null -eq $p) { continue }
    if ($p.active -eq $false) { continue }        # only ACTIVE products
    $handle = [string]$p.handle
    if ([string]::IsNullOrWhiteSpace($handle)) { continue }

    $ms = 0
    if ($p.updatedAt) { $ms = [long]$p.updatedAt }
    elseif ($p.createdAt) { $ms = [long]$p.createdAt }
    if ($ms -gt 0) {
      $lastmod = ([DateTimeOffset]::FromUnixTimeMilliseconds($ms).ToOffset($utc)).ToString("yyyy-MM-dd")
    } else {
      $lastmod = (Get-Date).ToUniversalTime().ToString("yyyy-MM-dd")
    }

    $loc = $Base + "/product.html?p=" + [Uri]::EscapeDataString($handle)
    $out += ("  <url>`r`n    <loc>" + (ConvertTo-XmlText $loc) + "</loc>`r`n    <lastmod>" + $lastmod + "</lastmod>`r`n    <changefreq>weekly</changefreq>`r`n    <priority>0.8</priority>`r`n  </url>")
  }
  return $out
}

function Get-SitemapXml {
  param([string]$Base)
  $tplPath = Join-Path $Root "sitemap.xml"
  $tpl = ""
  if (Test-Path -LiteralPath $tplPath -PathType Leaf) {
    try {
      $tpl = [System.IO.File]::ReadAllText(
        $tplPath,
        (New-Object System.Text.UTF8Encoding($false))
      )
    } catch { $tpl = "" }
  }
  if ([string]::IsNullOrWhiteSpace($tpl)) {
    $tpl = "<?xml version=`"1.0`" encoding=`"UTF-8`"?>`r`n<urlset xmlns=`"http://www.sitemaps.org/schemas/sitemap/0.9`">`r`n</urlset>`r`n"
  }

  # Swap the placeholder origin for the live base (literal replace, not regex).
  $tpl = $tpl.Replace("https://ziqwear.com", $Base)

  $entries = @(Get-ActiveProductUrls -Base $Base)
  if ($entries.Count -gt 0) {
    $block = ($entries -join "`r`n") + "`r`n"
    $idx = $tpl.LastIndexOf("</urlset>")
    if ($idx -ge 0) {
      $tpl = $tpl.Substring(0, $idx) + $block + $tpl.Substring($idx)
    } else {
      $tpl = $tpl + $block
    }
  }
  return $tpl
}

function Get-RobotsTxt {
  param([string]$Base)
  $tplPath = Join-Path $Root "robots.txt"
  $txt = ""
  if (Test-Path -LiteralPath $tplPath -PathType Leaf) {
    try {
      $txt = [System.IO.File]::ReadAllText(
        $tplPath,
        (New-Object System.Text.UTF8Encoding($false))
      )
    } catch { $txt = "" }
  }
  $txt = $txt.Replace("https://ziqwear.com", $Base)
  # Keep robots.txt pointing at the (host-correct) sitemap.
  if ($txt -notmatch "(?im)^\s*sitemap:") {
    $txt = $txt.TrimEnd() + "`r`n`r`nSitemap: " + $Base + "/sitemap.xml`r`n"
  }
  return $txt
}

function Send-TextResponse {
  param($req, $res, [string]$Body, [string]$ContentType)
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($Body)
  $res.StatusCode = 200
  $res.ContentType = $ContentType
  $res.ContentLength64 = $bytes.Length
  $res.Headers.Add("Cache-Control", "no-store")
  $res.Headers.Add("X-Content-Type-Options", "nosniff")
  if ($req.HttpMethod -ne "HEAD") {
    $res.OutputStream.Write($bytes, 0, $bytes.Length)
  }
}

# ---------------------------------------------------------------- port choice
$chosen = Get-FreePort -Start $Port -End ($Port + 23)
if ($chosen -eq 0) {
  Write-Host ""
  Write-Host "  ERROR: no free port between $Port and $($Port + 23)." -ForegroundColor Red
  Write-Host "  Close whatever is using them and try again."
  Write-Host ""
  exit 1
}
$Port = $chosen

$url = "http://localhost:$Port/"

Write-Host ""
Write-Host "  ============================================================"
Write-Host "     ZIQWEAR   |   Zenith in Quality"
Write-Host "  ============================================================"
Write-Host ""
Write-Host "  Storefront ........ $($url)index.html"
Write-Host "  Admin panel ....... $($url)admin.html"
if ($EmailConfig) {
  Write-Host "  Email ............. ENABLED ($($EmailConfig.gmailAddress))"
} else {
  Write-Host "  Email ............. NOT CONFIGURED (set SMTP_USER/SMTP_PASS in .env)"
}
Write-Host ""
Write-Host "  ------------------------------------------------------------"
Write-Host "   KEEP THIS WINDOW OPEN while you work - it is the server."
Write-Host "   Press Ctrl+C, or close this window, to stop."
Write-Host "  ------------------------------------------------------------"
Write-Host ""

# ------------------------------------------------------------------- serving
$useHttp = $true
$listener = $null

try {
  $listener = New-Object System.Net.HttpListener
  $listener.Prefixes.Add("http://localhost:$Port/")
  try { $listener.Prefixes.Add("http://127.0.0.1:$Port/") } catch { }
  $listener.Start()
} catch {
  $useHttp = $false
}

if ($useHttp) {
  Write-Host "  Server ready. Opening your browser..." -ForegroundColor Green
  Write-Host ""

  try { Start-Process $url } catch { Write-Host "  Open the address above manually." }

  while ($listener.IsListening) {
    $ctx = $null
    try {
      $ctx = $listener.GetContext()
      $req = $ctx.Request
      $res = $ctx.Response
      $path = $req.Url.AbsolutePath

      # ---- API routes ----
      if ($path -eq "/api/email") {
        Handle-EmailApi -req $req -res $res
        $statusLabel = if ($res.StatusCode -eq 200) { "email sent" } else { "email failed" }
        Write-Host ("  API  " + $res.StatusCode + "  /api/email  -> " + $statusLabel) -ForegroundColor DarkCyan
        continue
      }

      if ($path -eq "/api/orders" -or $path -eq "/api/orders/status" -or $path -eq "/api/orders/delete") {
        Handle-OrdersApi -req $req -res $res
        Write-Host ("  API  " + $res.StatusCode + "  " + $path) -ForegroundColor DarkCyan
        continue
      }

      # ---- SEO: generate sitemap + robots from the live request host ----
      if ($path -eq "/sitemap.xml") {
        Send-TextResponse -req $req -res $res -Body (Get-SitemapXml (Get-RequestBase $req)) -ContentType "application/xml; charset=utf-8"
        Write-Host ("  SEO  200  /sitemap.xml") -ForegroundColor DarkGreen
        continue
      }
      if ($path -eq "/robots.txt") {
        Send-TextResponse -req $req -res $res -Body (Get-RobotsTxt (Get-RequestBase $req)) -ContentType "text/plain; charset=utf-8"
        Write-Host ("  SEO  200  /robots.txt") -ForegroundColor DarkGreen
        continue
      }

      $file = Resolve-SiteFile $path
      $served = $false

      if ($file -and (Test-Path -LiteralPath $file -PathType Leaf)) {
        try {
          $bytes = [System.IO.File]::ReadAllBytes($file)
          $res.StatusCode = 200
          $res.ContentType = Get-MimeType $file
          $res.ContentLength64 = $bytes.Length
          $res.Headers.Add("Cache-Control", "no-store")
          $res.Headers.Add("X-Content-Type-Options", "nosniff")
          if ($req.HttpMethod -ne "HEAD") {
            $res.OutputStream.Write($bytes, 0, $bytes.Length)
          }
          $served = $true
        } catch {
          $served = $false
        }
      }

      if (-not $served) {
        $msg = [System.Text.Encoding]::UTF8.GetBytes("404 - not found: $path")
        $res.StatusCode = 404
        $res.ContentType = "text/plain; charset=utf-8"
        $res.ContentLength64 = $msg.Length
        if ($req.HttpMethod -ne "HEAD") {
          $res.OutputStream.Write($msg, 0, $msg.Length)
        }
      }

      if ($res.StatusCode -ne 200) {
        Write-Host ("  " + $res.StatusCode + "  " + $path) -ForegroundColor DarkYellow
      }
    } catch {
      # a client that walked away mid-request is not an error worth printing
    } finally {
      if ($ctx) {
        try { $ctx.Response.OutputStream.Close() } catch { }
        try { $ctx.Response.Close() } catch { }
      }
    }
  }
} else {
  # Fallback for machines where the HTTP listener cannot claim a URL. Plain
  # sockets, one request at a time - slower, but needs no permissions at all.
  # Note: the email API is not available in compatibility mode.
  Write-Host "  Server ready (compatibility mode). Opening your browser..." -ForegroundColor Green
  Write-Host "  Note: email API is not available in compatibility mode." -ForegroundColor Yellow
  Write-Host ""

  try { Start-Process $url } catch { Write-Host "  Open the address above manually." }

  $tcp = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $Port)
  $tcp.Start()

  while ($true) {
    $client = $tcp.AcceptTcpClient()
    $stream = $null
    try {
      $client.ReceiveTimeout = 5000
      $client.SendTimeout = 5000
      $stream = $client.GetStream()

      $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::ASCII, $false, 1024, $true)
      $line = $reader.ReadLine()
      if ([string]::IsNullOrWhiteSpace($line)) { continue }

      # drain the request headers, remembering Host so the generated SEO files
      # can build absolute URLs from the address the client actually used.
      $compatHost = ""
      while ($true) {
        $h = $reader.ReadLine()
        if ([string]::IsNullOrEmpty($h)) { break }
        if ($h -match "^\s*Host\s*:\s*(.+?)\s*$") { $compatHost = $matches[1] }
      }

      $bits = $line.Split(" ")
      $method = "GET"
      $target = "/"
      if ($bits.Length -ge 2) {
        $method = $bits[0].ToUpper()
        $target = $bits[1]
      }

      $compatPath = $target
      $qmark = $compatPath.IndexOf("?")
      if ($qmark -ge 0) { $compatPath = $compatPath.Substring(0, $qmark) }

      if ($compatHost) { $compatBase = "http://" + $compatHost } else { $compatBase = "http://localhost:$Port" }
      $compatBase = $compatBase.TrimEnd("/")

      # ---- SEO: generate sitemap + robots from the live request host ----
      $seoBody = $null
      $seoCtype = ""
      if ($compatPath -eq "/sitemap.xml") {
        $seoBody = Get-SitemapXml $compatBase
        $seoCtype = "application/xml; charset=utf-8"
      } elseif ($compatPath -eq "/robots.txt") {
        $seoBody = Get-RobotsTxt $compatBase
        $seoCtype = "text/plain; charset=utf-8"
      }
      if ($null -ne $seoBody) {
        $body = [System.Text.Encoding]::UTF8.GetBytes($seoBody)
        $seoHead = "HTTP/1.1 200 OK`r`n" +
                   "Content-Type: $seoCtype`r`n" +
                   "Content-Length: $($body.Length)`r`n" +
                   "Cache-Control: no-store`r`n" +
                   "X-Content-Type-Options: nosniff`r`n" +
                   "Connection: close`r`n`r`n"
        $seoHeadBytes = [System.Text.Encoding]::ASCII.GetBytes($seoHead)
        $stream.Write($seoHeadBytes, 0, $seoHeadBytes.Length)
        if ($method -ne "HEAD" -and $body.Length -gt 0) { $stream.Write($body, 0, $body.Length) }
        $stream.Flush()
        continue
      }

      $file = Resolve-SiteFile $target
      $status = "404 Not Found"
      $ctype = "text/plain; charset=utf-8"
      $body = [System.Text.Encoding]::UTF8.GetBytes("404 - not found")

      if ($file -and (Test-Path -LiteralPath $file -PathType Leaf)) {
        try {
          $body = [System.IO.File]::ReadAllBytes($file)
          $ctype = Get-MimeType $file
          $status = "200 OK"
        } catch { }
      }

      $head = "HTTP/1.1 $status`r`n" +
              "Content-Type: $ctype`r`n" +
              "Content-Length: $($body.Length)`r`n" +
              "Cache-Control: no-store`r`n" +
              "X-Content-Type-Options: nosniff`r`n" +
              "Connection: close`r`n`r`n"

      $headBytes = [System.Text.Encoding]::ASCII.GetBytes($head)
      $stream.Write($headBytes, 0, $headBytes.Length)
      if ($method -ne "HEAD" -and $body.Length -gt 0) {
        $stream.Write($body, 0, $body.Length)
      }
      $stream.Flush()
    } catch {
    } finally {
      if ($stream) { try { $stream.Close() } catch { } }
      try { $client.Close() } catch { }
    }
  }
}
