<#
  Servidor HTTP estatico local para o site da GRATITUDE TEXTIL.
  Nao depende de Node.js/Python - usa apenas System.Net.HttpListener (.NET incluso no Windows).
  Uso: powershell -ExecutionPolicy Bypass -File server.ps1 -Port 5173

  Tambem expoe UMA rota de API (POST /api/create-payment-link) que funciona
  como ponte segura para a API oficial de Checkout Integrado da InfinitePay
  (https://www.infinitepay.io/checkout-documentacao). O handle (InfiniteTag)
  fica só aqui no servidor - nunca é exposto no código do navegador.
#>
param(
  [int]$Port = 5173,
  [string]$InfinitePayHandle = "alivio"
)

$root = $PSScriptRoot
$InfinitePayLinksUrl = "https://api.checkout.infinitepay.io/links"

$mimeTypes = @{
  ".html"       = "text/html; charset=utf-8"
  ".htm"        = "text/html; charset=utf-8"
  ".js"         = "application/javascript; charset=utf-8"
  ".mjs"        = "application/javascript; charset=utf-8"
  ".css"        = "text/css; charset=utf-8"
  ".json"       = "application/json; charset=utf-8"
  ".svg"        = "image/svg+xml"
  ".png"        = "image/png"
  ".jpg"        = "image/jpeg"
  ".jpeg"       = "image/jpeg"
  ".gif"        = "image/gif"
  ".webp"       = "image/webp"
  ".ico"        = "image/x-icon"
  ".woff"       = "font/woff"
  ".woff2"      = "font/woff2"
  ".webmanifest"= "application/manifest+json"
  ".txt"        = "text/plain; charset=utf-8"
}

function Send-JsonResponse {
  param($Response, [int]$StatusCode, [string]$JsonBody)
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($JsonBody)
  $Response.StatusCode = $StatusCode
  $Response.ContentType = "application/json; charset=utf-8"
  $Response.ContentLength64 = $bytes.Length
  $Response.OutputStream.Write($bytes, 0, $bytes.Length)
}

function Handle-CreatePaymentLink {
  param($Request, $Response, [string]$Handle, [string]$LinksUrl)

  try {
    $reader = New-Object System.IO.StreamReader($Request.InputStream, [System.Text.Encoding]::UTF8)
    $rawBody = $reader.ReadToEnd()
    $reader.Close()
    $payload = $rawBody | ConvertFrom-Json
  } catch {
    Send-JsonResponse -Response $Response -StatusCode 400 -JsonBody (@{ error = "Corpo da requisicao invalido." } | ConvertTo-Json)
    return
  }

  if (-not $payload.items -or $payload.items.Count -eq 0) {
    Send-JsonResponse -Response $Response -StatusCode 400 -JsonBody (@{ error = "Nenhum item informado para o pagamento." } | ConvertTo-Json)
    return
  }

  $infinitePayBody = @{
    handle       = $Handle
    order_nsu    = [string]$payload.order_nsu
    redirect_url = $payload.redirect_url
    items        = $payload.items
  }
  if ($payload.customer) { $infinitePayBody.customer = $payload.customer }

  $jsonToSend = $infinitePayBody | ConvertTo-Json -Depth 6
  # PowerShell 5.1 codifica o -Body de Invoke-RestMethod usando a codepage
  # padrao do sistema quando recebe uma string, corrompendo acentos/travessao.
  # Forcamos bytes UTF-8 explicitamente para evitar isso.
  $jsonBytes = [System.Text.Encoding]::UTF8.GetBytes($jsonToSend)

  try {
    $apiResponse = Invoke-RestMethod -Uri $LinksUrl -Method Post -Body $jsonBytes -ContentType "application/json; charset=utf-8" -TimeoutSec 20
    $checkoutUrl = $null
    foreach ($field in @('url', 'payment_url', 'checkout_url', 'link')) {
      if ($apiResponse.PSObject.Properties.Name -contains $field -and $apiResponse.$field) {
        $checkoutUrl = $apiResponse.$field
        break
      }
    }
    if (-not $checkoutUrl) {
      Write-Host "InfinitePay respondeu sem um campo de URL reconhecido:" -ForegroundColor Yellow
      Write-Host ($apiResponse | ConvertTo-Json -Depth 6)
      Send-JsonResponse -Response $Response -StatusCode 502 -JsonBody (@{ error = "A InfinitePay respondeu, mas nao foi possivel identificar o link de pagamento."; raw = $apiResponse } | ConvertTo-Json -Depth 6)
      return
    }
    Send-JsonResponse -Response $Response -StatusCode 200 -JsonBody (@{ url = $checkoutUrl } | ConvertTo-Json)
  } catch {
    $errorDetail = $_.Exception.Message
    $statusCode = 502
    try {
      if ($_.Exception.Response) {
        $stream = $_.Exception.Response.GetResponseStream()
        $streamReader = New-Object System.IO.StreamReader($stream)
        $errorDetail = $streamReader.ReadToEnd()
        $streamReader.Close()
      }
    } catch {}
    Write-Host "Erro ao chamar a API da InfinitePay: $errorDetail" -ForegroundColor Red
    Send-JsonResponse -Response $Response -StatusCode $statusCode -JsonBody (@{ error = "Nao foi possivel gerar o link de pagamento na InfinitePay."; detail = $errorDetail } | ConvertTo-Json)
  }
}

function Start-AmaraServer {
  param([int]$StartPort)

  $listener = $null
  $port = $StartPort
  $maxAttempts = 15
  $listeningOnLan = $false

  for ($i = 0; $i -lt $maxAttempts; $i++) {
    # Tenta primeiro escutar em todas as interfaces (acesso pela rede local,
    # util para abrir o PDV em um tablet/celular no Wi-Fi da loja). Isso
    # exige permissao de administrador (ou uma reserva de URL via netsh) -
    # se falhar por permissao, cai automaticamente para localhost, que
    # sempre funciona sem privilegios especiais.
    try {
      $candidate = New-Object System.Net.HttpListener
      $candidate.Prefixes.Add("http://+:$port/")
      $candidate.Start()
      $listener = $candidate
      $listeningOnLan = $true
      break
    } catch {
      try {
        $fallback = New-Object System.Net.HttpListener
        $fallback.Prefixes.Add("http://localhost:$port/")
        $fallback.Start()
        $listener = $fallback
        $listeningOnLan = $false
        break
      } catch {
        $port++
      }
    }
  }

  if (-not $listener) {
    Write-Host "Nao foi possivel iniciar o servidor (portas ocupadas)." -ForegroundColor Red
    return
  }

  Write-Host "=================================================="
  Write-Host " GRATITUDE TEXTIL - site rodando em:"
  Write-Host " http://localhost:$port/" -ForegroundColor Green

  if ($listeningOnLan) {
    $lanIp = (Get-NetIPAddress -AddressFamily IPv4 -PrefixOrigin Dhcp,Manual -ErrorAction SilentlyContinue |
      Where-Object { $_.IPAddress -notlike "169.254.*" } | Select-Object -First 1 -ExpandProperty IPAddress)
    if ($lanIp) {
      Write-Host " http://$($lanIp):$port/ (na rede local - tablet/celular no mesmo Wi-Fi)" -ForegroundColor Green
    }
  } else {
    Write-Host " (rodando apenas em localhost - sem permissao para acesso pela rede local)" -ForegroundColor Yellow
    Write-Host " Para liberar acesso de outros aparelhos na rede, rode este PowerShell" -ForegroundColor DarkYellow
    Write-Host " como Administrador, ou execute uma vez:" -ForegroundColor DarkYellow
    Write-Host "   netsh http add urlacl url=http://+:$port/ user=Todos" -ForegroundColor DarkYellow
  }
  Write-Host "=================================================="
  Write-Host " Pressione CTRL+C para encerrar o servidor."
  Write-Host ""

  while ($listener.IsListening) {
    try {
      $context = $listener.GetContext()
    } catch {
      break
    }
    $request = $context.Request
    $response = $context.Response
    try {
      $localPath = [System.Uri]::UnescapeDataString($request.Url.LocalPath)

      if ($request.HttpMethod -eq "POST" -and $localPath -eq "/api/create-payment-link") {
        Handle-CreatePaymentLink -Request $request -Response $response -Handle $InfinitePayHandle -LinksUrl $InfinitePayLinksUrl
        continue
      }

      if ($localPath -eq "/") { $localPath = "/index.html" }

      $relative = $localPath.TrimStart("/") -replace "/", [System.IO.Path]::DirectorySeparatorChar
      $filePath = Join-Path $root $relative

      $fullRoot = (Resolve-Path $root).Path
      $isInsideRoot = $false
      if (Test-Path $filePath) {
        $fullFile = (Resolve-Path $filePath -ErrorAction SilentlyContinue)
        if ($fullFile -and $fullFile.Path.StartsWith($fullRoot)) { $isInsideRoot = $true }
      }

      if ($isInsideRoot -and (Test-Path $filePath -PathType Leaf)) {
        $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
        $contentType = $mimeTypes[$ext]
        if (-not $contentType) { $contentType = "application/octet-stream" }
        $bytes = [System.IO.File]::ReadAllBytes($filePath)
        $response.ContentType = $contentType
        $response.StatusCode = 200
        $response.ContentLength64 = $bytes.Length
        $response.OutputStream.Write($bytes, 0, $bytes.Length)
      } else {
        $response.StatusCode = 404
        $response.ContentType = "text/html; charset=utf-8"
        $notFoundFile = Join-Path $root "index.html"
        if (Test-Path $notFoundFile) {
          $bytes = [System.IO.File]::ReadAllBytes($notFoundFile)
          $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
          $bytes = [System.Text.Encoding]::UTF8.GetBytes("404 - Arquivo nao encontrado")
          $response.OutputStream.Write($bytes, 0, $bytes.Length)
        }
      }
    } catch {
      try {
        $response.StatusCode = 500
      } catch {}
    } finally {
      try { $response.OutputStream.Close() } catch {}
    }
  }
}

Start-AmaraServer -StartPort $Port
