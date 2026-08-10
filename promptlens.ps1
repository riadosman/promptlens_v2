param(
  [ValidateSet('install', 'upgrade', 'start', 'stop', 'status', 'logs', 'doctor', 'backup', 'diagnostics', 'connectors')]
  [string]$Command = 'install'
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$ComposeFile = Join-Path $ProjectRoot 'infra/compose/compose.full.yaml'
$EnvironmentFile = Join-Path $ProjectRoot '.env'
$ComposeProject = 'promptlens-platform'

function New-Secret {
  $bytes = [byte[]]::new(32)
  [Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
  return [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

function Assert-Docker {
  if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw 'Docker Desktop with Compose v2 is required.'
  }
  docker info 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Docker is installed but not running.' }
  docker compose version 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Docker Compose v2 is required.' }
}

function Initialize-Environment {
  if (-not (Test-Path -LiteralPath $EnvironmentFile)) {
    $content = @(
    'NODE_ENV=production'
    'DEPLOYMENT_MODE=local'
    'TRUST_PROXY=false'
    'WEB_ORIGIN=http://localhost:3000'
    'PUBLIC_API_URL=http://localhost:4000/v1'
    'WEB_PORT=3000'
    'API_PORT=4000'
    'POSTGRES_PORT=55435'
    "POSTGRES_PASSWORD=$(New-Secret)"
    "POSTGRES_APP_PASSWORD=$(New-Secret)"
    "POSTGRES_WORKER_PASSWORD=$(New-Secret)"
    "SESSION_HASH_SECRET=$(New-Secret)"
    'AI_PROVIDER=fake'
    'AI_MODEL=gpt-5.6-luna'
    'OPENAI_API_KEY='
    'ANTHROPIC_API_KEY='
    'ANTHROPIC_MODEL=claude-sonnet-5'
    'AI_TENANT_MONTHLY_TOKEN_BUDGET=1000000'
    'AI_TENANT_REQUESTS_PER_MINUTE=60'
    'AI_CIRCUIT_FAILURE_THRESHOLD=5'
    'OTEL_EXPORTER_OTLP_ENDPOINT='
    'EMAIL_VERIFICATION_REQUIRED=false'
    ) -join [Environment]::NewLine
    [IO.File]::WriteAllText($EnvironmentFile, $content + [Environment]::NewLine, [Text.UTF8Encoding]::new($false))
  }
  if (-not (Select-String -LiteralPath $EnvironmentFile -Pattern '^POSTGRES_APP_PASSWORD=' -Quiet)) {
    [IO.File]::AppendAllText($EnvironmentFile, "POSTGRES_APP_PASSWORD=$(New-Secret)$([Environment]::NewLine)", [Text.UTF8Encoding]::new($false))
  }
  if (-not (Select-String -LiteralPath $EnvironmentFile -Pattern '^POSTGRES_WORKER_PASSWORD=' -Quiet)) {
    [IO.File]::AppendAllText($EnvironmentFile, "POSTGRES_WORKER_PASSWORD=$(New-Secret)$([Environment]::NewLine)", [Text.UTF8Encoding]::new($false))
  }
  if (-not (Select-String -LiteralPath $EnvironmentFile -Pattern '^SESSION_HASH_SECRET=' -Quiet)) {
    [IO.File]::AppendAllText($EnvironmentFile, "SESSION_HASH_SECRET=$(New-Secret)$([Environment]::NewLine)", [Text.UTF8Encoding]::new($false))
  }
}

function Get-EnvironmentSetting([string]$Name) {
  $line = Get-Content -LiteralPath $EnvironmentFile | Where-Object { $_ -like "$Name=*" } | Select-Object -Last 1
  if (-not $line) { throw "Missing $Name in .env." }
  return $line.Substring($Name.Length + 1)
}

function Invoke-Pnpm {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)
  if (Get-Command pnpm -ErrorAction SilentlyContinue) {
    & pnpm @Arguments
  } elseif (Get-Command corepack -ErrorAction SilentlyContinue) {
    & corepack pnpm @Arguments
  } else {
    throw 'Corepack or pnpm is required to install a source connector.'
  }
  if ($LASTEXITCODE -ne 0) { throw "pnpm command failed: $($Arguments -join ' ')" }
}

function Get-ConnectorSelection {
  $requested = if ($env:PROMPTLENS_CONNECTORS) { $env:PROMPTLENS_CONNECTORS.ToLowerInvariant() } else { 'auto' }
  if ($requested -ne 'auto') {
    if ($requested -eq 'all') { return @('claude-code', 'codex') }
    return @($requested -split '[, ]+' | Where-Object { $_ })
  }
  $detected = @()
  if (Get-Command claude -ErrorAction SilentlyContinue) { $detected += 'claude-code' }
  if (Get-Command codex -ErrorAction SilentlyContinue) { $detected += 'codex' }
  if ($detected.Count -gt 0) {
    Write-Host "Detected AI platform connector(s): $($detected -join ', ')"
    return $detected
  }
  $interactive = [Environment]::UserInteractive -and -not $env:CI -and -not [Console]::IsInputRedirected
  if (-not $interactive) { return @('none') }
  $choice = Read-Host 'No supported AI CLI was detected. Install [1] Claude Code, [2] Codex, [3] both, or [0] skip?'
  switch ($choice) {
    '1' { return @('claude-code') }
    '2' { return @('codex') }
    '3' { return @('claude-code', 'codex') }
    '0' { return @('none') }
    '' { return @('none') }
    default { throw 'Invalid connector selection.' }
  }
}

function Install-PromptLensConnectors {
  $connectors = @(Get-ConnectorSelection)
  $loginMode = if ($env:PROMPTLENS_CONNECTOR_LOGIN) { $env:PROMPTLENS_CONNECTOR_LOGIN.ToLowerInvariant() } else { 'auto' }
  if ($loginMode -notin @('auto', 'always', 'never')) {
    throw 'PROMPTLENS_CONNECTOR_LOGIN must be auto, always, or never.'
  }
  if ($connectors.Count -eq 0 -or $connectors -contains 'none') {
    Write-Host 'Connector installation skipped.'
    return
  }
  if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw 'Node.js is required by the detected AI connector.'
  }
  Invoke-Pnpm install --frozen-lockfile
  $connectorApiUrl = Get-EnvironmentSetting 'PUBLIC_API_URL'
  $interactive = [Environment]::UserInteractive -and -not $env:CI -and -not [Console]::IsInputRedirected
  foreach ($connector in $connectors) {
    switch ($connector) {
      'claude-code' {
        $package = '@promptlens/connector-claude-code'
        $cli = Join-Path $ProjectRoot 'connectors/claude-code/dist/cli.js'
      }
      'codex' {
        $package = '@promptlens/connector-codex'
        $cli = Join-Path $ProjectRoot 'connectors/codex/dist/cli.js'
      }
      default { throw "Unsupported connector: $connector" }
    }
    Invoke-Pnpm --filter $package build
    $env:PROMPTLENS_API_URL = $connectorApiUrl
    & node $cli install
    if ($LASTEXITCODE -ne 0) { throw "$connector hook installation failed." }
    if ($loginMode -eq 'always' -or ($loginMode -eq 'auto' -and $interactive)) {
      & node $cli connect
      if ($LASTEXITCODE -ne 0) { throw "$connector authentication failed." }
    } else {
      Write-Host "Connector installed. Authenticate later with: node `"$cli`" connect"
    }
  }
}

Set-Location -LiteralPath $ProjectRoot
Assert-Docker
Initialize-Environment

switch ($Command) {
  { $_ -in 'install', 'upgrade' } {
    docker compose -p $ComposeProject --profile tools --env-file $EnvironmentFile -f $ComposeFile build
    if ($LASTEXITCODE -ne 0) { throw 'Container build failed.' }
    docker compose -p $ComposeProject --env-file $EnvironmentFile -f $ComposeFile up -d --wait postgres redis
    if ($LASTEXITCODE -ne 0) { throw 'Infrastructure failed to become healthy.' }
    docker compose -p $ComposeProject --env-file $EnvironmentFile -f $ComposeFile exec -T postgres sh /docker-entrypoint-initdb.d/10-app-role.sh
    if ($LASTEXITCODE -ne 0) { throw 'Database runtime role setup failed.' }
    $ownerUrl = "postgresql://promptlens_owner:$(Get-EnvironmentSetting 'POSTGRES_PASSWORD')@postgres:5432/promptlens"
    docker compose -p $ComposeProject --profile tools --env-file $EnvironmentFile -f $ComposeFile run --rm -e "DATABASE_URL=$ownerUrl" migrate
    if ($LASTEXITCODE -ne 0) { throw 'Database migration failed.' }
    docker compose -p $ComposeProject --env-file $EnvironmentFile -f $ComposeFile up -d --wait
    if ($LASTEXITCODE -ne 0) { throw 'PromptLens failed to become healthy.' }
    Write-Host 'PromptLens is ready at http://localhost:3000' -ForegroundColor Green
    if ($Command -eq 'install') { Install-PromptLensConnectors }
  }
  'start' { docker compose -p $ComposeProject --env-file $EnvironmentFile -f $ComposeFile up -d --wait }
  'stop' { docker compose -p $ComposeProject --env-file $EnvironmentFile -f $ComposeFile down }
  'status' { docker compose -p $ComposeProject --env-file $EnvironmentFile -f $ComposeFile ps }
  'logs' { docker compose -p $ComposeProject --env-file $EnvironmentFile -f $ComposeFile logs -f }
  'doctor' { docker compose -p $ComposeProject --env-file $EnvironmentFile -f $ComposeFile config --quiet; Write-Host 'Configuration is valid.' }
  'backup' {
    $backupDirectory = Join-Path $ProjectRoot 'backups'
    [IO.Directory]::CreateDirectory($backupDirectory) | Out-Null
    $stamp = [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssZ')
    $containerFile = "/tmp/promptlens-$stamp.dump"
    docker compose -p $ComposeProject --env-file $EnvironmentFile -f $ComposeFile exec -T postgres pg_dump -U promptlens_owner -d promptlens --format=custom --file=$containerFile
    if ($LASTEXITCODE -ne 0) { throw 'Database backup failed.' }
    $containerId = docker compose -p $ComposeProject --env-file $EnvironmentFile -f $ComposeFile ps -q postgres
    $target = Join-Path $backupDirectory "promptlens-$stamp.dump"
    docker cp "${containerId}:$containerFile" $target
    if ($LASTEXITCODE -ne 0) { throw 'Backup copy failed.' }
    Write-Host "Backup created: $target" -ForegroundColor Green
  }
  'diagnostics' {
    $diagnosticsDirectory = Join-Path $ProjectRoot 'diagnostics'
    [IO.Directory]::CreateDirectory($diagnosticsDirectory) | Out-Null
    $stamp = [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssZ')
    $target = Join-Path $diagnosticsDirectory "promptlens-$stamp.txt"
    $status = docker compose -p $ComposeProject --env-file $EnvironmentFile -f $ComposeFile ps
    $images = docker compose -p $ComposeProject --env-file $EnvironmentFile -f $ComposeFile images
    $health = try { Invoke-RestMethod 'http://localhost:4000/v1/health/live' | ConvertTo-Json -Compress } catch { 'API health unavailable' }
    [IO.File]::WriteAllText($target, "PromptLens diagnostics $stamp$([Environment]::NewLine)$status$([Environment]::NewLine)$images$([Environment]::NewLine)$health$([Environment]::NewLine)", [Text.UTF8Encoding]::new($false))
    Write-Host "Diagnostics created without environment secrets: $target" -ForegroundColor Green
  }
  'connectors' { Install-PromptLensConnectors }
}
