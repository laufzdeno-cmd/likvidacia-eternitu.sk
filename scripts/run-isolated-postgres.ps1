param(
  [switch]$TenPhotoBrowser,
  [switch]$HistoricalClient,
  [switch]$SchemaConcurrency,
  [switch]$CareerWorkflow,
  [switch]$ProductionBuild,
  [switch]$Lighthouse,
  [switch]$CronRoutes,
  [switch]$LegacyMigration,
  [switch]$LegacyMixed,
  [switch]$LiveUploadCompatibility,
  [string]$LegacyRoot
)

$ErrorActionPreference = 'Stop'
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding = $utf8NoBom
[Console]::OutputEncoding = $utf8NoBom
$OutputEncoding = $utf8NoBom
if ($HistoricalClient -and -not $TenPhotoBrowser) { throw 'Historický klient vyžaduje -TenPhotoBrowser.' }
if ($Lighthouse -and -not $ProductionBuild) { throw 'Lighthouse vyžaduje izolovaný -ProductionBuild.' }
if (($TenPhotoBrowser -and $SchemaConcurrency) -or ($CareerWorkflow -and ($TenPhotoBrowser -or $SchemaConcurrency))) { throw 'Testy prehliadača, súbehu schémy a kariérneho workflow musia bežať oddelene.' }
if (($ProductionBuild -or $CronRoutes) -and ($TenPhotoBrowser -or $SchemaConcurrency -or $CareerWorkflow -or $LegacyMigration -or $LegacyMixed -or $LiveUploadCompatibility -or ($ProductionBuild -and $CronRoutes))) { throw 'Produkčný build a cron kontroly sa spúšťajú samostatne.' }
if (($LegacyMigration -or $LegacyMixed -or $LiveUploadCompatibility) -and ($TenPhotoBrowser -or $SchemaConcurrency -or $CareerWorkflow -or ($LegacyMigration -and $LegacyMixed) -or ($LiveUploadCompatibility -and ($LegacyMigration -or $LegacyMixed)))) { throw 'Staré a nové migračné testy sa spúšťajú samostatne.' }

$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
if ($LegacyMigration -or $LegacyMixed) {
  if (-not $LegacyRoot -or $LegacyRoot -notmatch '^[A-Za-z]:[\\/]') { throw 'Starý test vyžaduje absolútnu cestu LegacyRoot.' }
  $LegacyRoot = [IO.Path]::GetFullPath($LegacyRoot)
  $legacyTopLevel = & git -C $LegacyRoot rev-parse --show-toplevel
  if ($LASTEXITCODE -ne 0 -or [IO.Path]::GetFullPath($legacyTopLevel).TrimEnd([IO.Path]::DirectorySeparatorChar) -ine $LegacyRoot.TrimEnd([IO.Path]::DirectorySeparatorChar)) {
    throw 'LegacyRoot musí byť presný koreň starého Git checkout-u.'
  }
  $legacyHead = & git -C $LegacyRoot rev-parse HEAD
  if ($LASTEXITCODE -ne 0 -or $legacyHead -ne 'fc73ec2f1b75b8f231c4b654e57f85138ec5ed99') { throw 'LegacyRoot musí byť čistý E1A commit fc73ec2f.' }
  & git -C $LegacyRoot ls-files --error-unmatch -- src/server/db.ts src/server/types.ts src/server/slovak-text.ts | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Staré DB zdrojové súbory musia byť sledované v E1A commite.' }
  & git -C $LegacyRoot diff --quiet HEAD -- src/server/db.ts src/server/types.ts src/server/slovak-text.ts
  if ($LASTEXITCODE -ne 0) { throw 'Staré DB zdrojové súbory nie sú čisté.' }
} elseif ($LegacyRoot) { throw 'LegacyRoot má význam iba pri LegacyMigration alebo LegacyMixed.' }
$tmpRoot = [IO.Path]::GetFullPath((Join-Path $projectRoot 'tmp'))
$pgBin = 'C:\Program Files\PostgreSQL\17\bin'
$initdb = Join-Path $pgBin 'initdb.exe'
$pgCtl = Join-Path $pgBin 'pg_ctl.exe'
$createdb = Join-Path $pgBin 'createdb.exe'
$psql = Join-Path $pgBin 'psql.exe'
foreach ($binary in @($initdb, $pgCtl, $createdb, $psql)) {
  if (-not (Test-Path -LiteralPath $binary -PathType Leaf)) { throw "Chýba lokálny PostgreSQL 17: $binary" }
}

if (-not (Test-Path -LiteralPath $tmpRoot)) { New-Item -ItemType Directory -Path $tmpRoot | Out-Null }
$tmpEntry = Get-Item -LiteralPath $tmpRoot -Force
if (($tmpEntry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'Projektový tmp nesmie byť symbolický odkaz ani junction.' }

$suffix = [guid]::NewGuid().ToString('N').ToLowerInvariant()
$databaseName = "astana_isolated_$suffix"
$runRoot = [IO.Path]::GetFullPath((Join-Path $tmpRoot "isolated-pg-$suffix"))
if (-not $runRoot.StartsWith($tmpRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
  throw 'Dočasný adresár nie je pod projektovým tmp.'
}
if (Test-Path -LiteralPath $runRoot) { throw 'Jednorazový adresár už existuje.' }
New-Item -ItemType Directory -Path $runRoot -Force | Out-Null
$dataRoot = Join-Path $runRoot 'data'
$logPath = Join-Path $runRoot 'postgres.log'
$listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 0)
$listener.Start()
$port = ([Net.IPEndPoint]$listener.LocalEndpoint).Port
$listener.Stop()
$startAttempted = $false
$previousTestUrl = [Environment]::GetEnvironmentVariable('ASTANA_ISOLATED_PG_URL', 'Process')
$previousRunToken = [Environment]::GetEnvironmentVariable('ASTANA_ISOLATED_PG_RUN_TOKEN', 'Process')
$previousTenPhotoMode = [Environment]::GetEnvironmentVariable('ASTANA_HARNESS_TEN_PHOTO_ONLY', 'Process')
$previousHistoricalClient = [Environment]::GetEnvironmentVariable('ASTANA_HARNESS_USE_PREVIOUS_CLIENT', 'Process')
$previousLegacyRoot = [Environment]::GetEnvironmentVariable('ASTANA_LEGACY_MIGRATION_ROOT', 'Process')
$previousFullBuild = [Environment]::GetEnvironmentVariable('ASTANA_HARNESS_FULL_BUILD', 'Process')
$previousLighthouse = [Environment]::GetEnvironmentVariable('ASTANA_HARNESS_LIGHTHOUSE', 'Process')
$previousCronOnly = [Environment]::GetEnvironmentVariable('ASTANA_HARNESS_CRON_ONLY', 'Process')
$previousLiveRollbackRoot = [Environment]::GetEnvironmentVariable('ASTANA_LIVE_ROLLBACK_ROOT', 'Process')
$runFailed = $false
$safeToRemove = $true

try {
  if ($LiveUploadCompatibility) {
    $rollbackRoot = Join-Path $runRoot 'rollback-c98'
    & git clone --shared --no-checkout $projectRoot $rollbackRoot
    if ($LASTEXITCODE -ne 0) { throw 'Dočasný rollback checkout nevznikol.' }
    & git -C $rollbackRoot switch --detach c98c630c1af467c51c615980841630a4cabf6c29
    if ($LASTEXITCODE -ne 0) { throw 'Dočasný rollback checkout nemá presný produkčný commit.' }
    $rollbackHead = & git -C $rollbackRoot rev-parse HEAD
    if ($LASTEXITCODE -ne 0 -or $rollbackHead -ne 'c98c630c1af467c51c615980841630a4cabf6c29') { throw 'Rollback checkout nemá presný produkčný SHA.' }
    & git -C $rollbackRoot diff --quiet HEAD -- src/server/db.ts src/server/types.ts src/server/lead-upload-schema.ts src/server/lead-upload-policy.ts src/server/slovak-text.ts
    if ($LASTEXITCODE -ne 0) { throw 'Rollback DB a upload zdroje nie sú čisté.' }
    $env:ASTANA_LIVE_ROLLBACK_ROOT = $rollbackRoot
  }
  & $initdb -D $dataRoot -U astana_test -E UTF8 --auth-local=trust --auth-host=trust --no-instructions
  if ($LASTEXITCODE -ne 0) { throw 'initdb zlyhalo.' }

  $startAttempted = $true
  $safeToRemove = $false
  & $pgCtl -D $dataRoot -l $logPath -o "-h 127.0.0.1 -p $port" -w start
  if ($LASTEXITCODE -ne 0) { throw 'Jednorazový PostgreSQL sa nespustil.' }

  & $createdb -h 127.0.0.1 -p $port -U astana_test $databaseName
  if ($LASTEXITCODE -ne 0) { throw 'Jednorazová databáza nevznikla.' }

  & $psql -h 127.0.0.1 -p $port -U astana_test -d $databaseName -v ON_ERROR_STOP=1 -c "CREATE TABLE astana_isolated_runner_guard (run_token text PRIMARY KEY); INSERT INTO astana_isolated_runner_guard (run_token) VALUES ('$suffix')"
  if ($LASTEXITCODE -ne 0) { throw 'Jednorazový databázový marker nevznikol.' }

  $env:ASTANA_ISOLATED_PG_URL = "postgres://astana_test@127.0.0.1:$port/$databaseName"
  $env:ASTANA_ISOLATED_PG_RUN_TOKEN = $suffix
  if ($LegacyMigration -or $LegacyMixed) { $env:ASTANA_LEGACY_MIGRATION_ROOT = $LegacyRoot }
  Push-Location $projectRoot
  try {
    if ($ProductionBuild) {
      $env:ASTANA_HARNESS_FULL_BUILD = '1'
      if ($Lighthouse) { $env:ASTANA_HARNESS_LIGHTHOUSE = '1' }
      else { $env:ASTANA_HARNESS_LIGHTHOUSE = '0' }
      & node (Join-Path $projectRoot 'scripts/photo-intake-browser.integration.mjs')
      if ($LASTEXITCODE -ne 0) { throw 'Úplný produkčný build na jednorazovom PostgreSQL zlyhal.' }
    } elseif ($CronRoutes) {
      $env:ASTANA_HARNESS_CRON_ONLY = '1'
      & node (Join-Path $projectRoot 'scripts/photo-intake-browser.integration.mjs')
      if ($LASTEXITCODE -ne 0) { throw 'Izolovaná kontrola produkčných cron ciest zlyhala.' }
    } elseif ($LegacyMixed) {
      & node --import tsx (Join-Path $projectRoot 'scripts/legacy-main-mixed-postgres.integration.mjs')
      if ($LASTEXITCODE -ne 0) { throw 'Súbežný starý/nový štart na jednorazovom PostgreSQL zlyhal.' }
    } elseif ($LegacyMigration) {
      & node --import tsx (Join-Path $projectRoot 'scripts/legacy-migration-postgres.integration.mjs')
      if ($LASTEXITCODE -ne 0) { throw 'Migrácia starej schémy na jednorazovom PostgreSQL zlyhala.' }
    } elseif ($LiveUploadCompatibility) {
      & node --import tsx (Join-Path $projectRoot 'scripts/live-upload-schema-compatibility.postgres.mjs')
      if ($LASTEXITCODE -ne 0) { throw 'Kompatibilita produkčnej schémy fotiek pri nasadení a návrate zlyhala.' }
    } elseif ($SchemaConcurrency) {
      & node --import tsx (Join-Path $projectRoot 'scripts/schema-concurrency-postgres.integration.mjs')
      if ($LASTEXITCODE -ne 0) { throw 'Súbežný štart schémy na jednorazovom PostgreSQL zlyhal.' }
    } elseif ($CareerWorkflow) {
      & node --import tsx (Join-Path $projectRoot 'scripts/career-admin-workflow-postgres.integration.mjs')
      if ($LASTEXITCODE -ne 0) { throw 'Kariérny workflow na jednorazovom PostgreSQL zlyhal.' }
    } elseif ($TenPhotoBrowser) {
      $env:ASTANA_HARNESS_TEN_PHOTO_ONLY = '1'
      if ($HistoricalClient) { $env:ASTANA_HARNESS_USE_PREVIOUS_CLIENT = '1' }
      else { $env:ASTANA_HARNESS_USE_PREVIOUS_CLIENT = '0' }
      & node (Join-Path $projectRoot 'scripts/lead-private-blob-browser.integration.mjs')
      if ($LASTEXITCODE -ne 0) { throw 'Prehliadačový test desiatich fotiek na skutočnom PostgreSQL zlyhal.' }
    } else {
      & node --import tsx (Join-Path $projectRoot 'scripts/lead-submission-postgres.integration.mjs')
      if ($LASTEXITCODE -ne 0) { throw 'Integračný test na skutočnom PostgreSQL zlyhal.' }
    }
  } finally {
    Pop-Location
  }
} catch {
  $runFailed = $true
  [Console]::Error.WriteLine($_)
  if (Test-Path -LiteralPath $logPath) { Get-Content -LiteralPath $logPath -Tail 30 }
} finally {
  [Environment]::SetEnvironmentVariable('ASTANA_ISOLATED_PG_URL', $previousTestUrl, 'Process')
  [Environment]::SetEnvironmentVariable('ASTANA_ISOLATED_PG_RUN_TOKEN', $previousRunToken, 'Process')
  [Environment]::SetEnvironmentVariable('ASTANA_HARNESS_TEN_PHOTO_ONLY', $previousTenPhotoMode, 'Process')
  [Environment]::SetEnvironmentVariable('ASTANA_HARNESS_USE_PREVIOUS_CLIENT', $previousHistoricalClient, 'Process')
  [Environment]::SetEnvironmentVariable('ASTANA_LEGACY_MIGRATION_ROOT', $previousLegacyRoot, 'Process')
  [Environment]::SetEnvironmentVariable('ASTANA_HARNESS_FULL_BUILD', $previousFullBuild, 'Process')
  [Environment]::SetEnvironmentVariable('ASTANA_HARNESS_LIGHTHOUSE', $previousLighthouse, 'Process')
  [Environment]::SetEnvironmentVariable('ASTANA_HARNESS_CRON_ONLY', $previousCronOnly, 'Process')
  [Environment]::SetEnvironmentVariable('ASTANA_LIVE_ROLLBACK_ROOT', $previousLiveRollbackRoot, 'Process')
  if ($startAttempted) {
    try {
      & $pgCtl -D $dataRoot status
      if ($LASTEXITCODE -eq 0) {
        & $pgCtl -D $dataRoot -m fast -w stop
        if ($LASTEXITCODE -eq 0) { $safeToRemove = $true }
      }
    } catch {
      $safeToRemove = $false
    }
    if (-not $safeToRemove) {
      $runFailed = $true
      Write-Warning 'Stav alebo zastavenie jednorazového PostgreSQL nie je potvrdené; dočasné dáta ostávajú zachované na bezpečné preverenie.'
    }
  }
  if ($safeToRemove -and (Test-Path -LiteralPath $runRoot)) {
    $resolvedRunRoot = [IO.Path]::GetFullPath($runRoot)
    if (-not $resolvedRunRoot.StartsWith($tmpRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
      throw 'Odmietnuté odstránenie mimo projektového tmp.'
    }
    $runEntry = Get-Item -LiteralPath $resolvedRunRoot -Force
    if (($runEntry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'Odmietnuté odstránenie cez symbolický odkaz.' }
    Remove-Item -LiteralPath $resolvedRunRoot -Recurse -Force
  }
}

if ($runFailed) { exit 1 }
Write-Output 'PASS: jednorazový PostgreSQL bol zastavený a jeho projektové tmp dáta odstránené.'
