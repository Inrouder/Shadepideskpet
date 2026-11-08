# Shadepi Deskpet – Temperatur- und GPU-Fühler (ohne Administratorrechte).
# Gibt alle ~12 s eine JSON-Zeile aus. __OWNPID__ wird ersetzt; endet mit dem Hauptprogramm.
$ErrorActionPreference = 'SilentlyContinue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
$own = [int]__OWNPID__
$loops = __LOOPS__
$i = 0
while ($loops -le 0 -or $i -lt $loops) {
  $i++
  $o = @{}
  # Thermalzonen (Mainboard/CPU-Nähe), Zehntel-Kelvin
  $tz = Get-CimInstance -ClassName Win32_PerfFormattedData_Counters_ThermalZoneInformation
  if ($tz) {
    $max = ($tz | ForEach-Object { if ($_.HighPrecisionTemperature) { $_.HighPrecisionTemperature / 10.0 - 273.15 } else { $_.Temperature - 273.15 } } | Measure-Object -Maximum).Maximum
    if ($max -gt 0 -and $max -lt 130) { $o.zone = [math]::Round($max, 1) }
  }
  # GPU-Auslastung (3D-Engine) über Leistungsindikatoren – funktioniert für NVIDIA, AMD und Intel
  $eng = Get-CimInstance -ClassName Win32_PerfFormattedData_GPUPerformanceCounters_GPUEngine
  if ($eng) {
    $sum = ($eng | Where-Object { $_.Name -like '*engtype_3D*' } | Measure-Object -Property UtilizationPercentage -Sum).Sum
    if ($sum -ne $null) { $o.gpuLoad = [math]::Min(100, [math]::Round($sum, 0)) }
  }
  # Falls LibreHardwareMonitor / OpenHardwareMonitor laufen: genaue Werte
  foreach ($ns in @('root/LibreHardwareMonitor', 'root/OpenHardwareMonitor')) {
    $s = Get-CimInstance -Namespace $ns -ClassName Sensor
    if ($s) {
      $cpuT = $s | Where-Object { $_.SensorType -eq 'Temperature' -and $_.Identifier -match 'cpu' -and ($_.Name -match 'Package|Tctl|Tdie|Core \(Tctl|CPU Total|Core Max') } | Sort-Object Value -Descending | Select-Object -First 1
      if (-not $cpuT) { $cpuT = $s | Where-Object { $_.SensorType -eq 'Temperature' -and $_.Identifier -match 'cpu' } | Sort-Object Value -Descending | Select-Object -First 1 }
      $gpuT = $s | Where-Object { $_.SensorType -eq 'Temperature' -and $_.Identifier -match 'gpu' -and $_.Name -match 'Core|GPU' } | Sort-Object Value -Descending | Select-Object -First 1
      $gpuL = $s | Where-Object { $_.SensorType -eq 'Load' -and $_.Identifier -match 'gpu' -and $_.Name -match 'Core|D3D 3D' } | Sort-Object Value -Descending | Select-Object -First 1
      if ($cpuT) { $o.cpuTemp = [math]::Round($cpuT.Value, 1) }
      if ($gpuT) { $o.gpuTemp = [math]::Round($gpuT.Value, 1) }
      if ($gpuL) { $o.gpuLoad = [math]::Round($gpuL.Value, 0) }
      $o.src = $ns.Split('/')[1]
      break
    }
  }
  # GPU-Name
  if (-not $script:gpuName) {
    $vc = Get-CimInstance -ClassName Win32_VideoController | Sort-Object AdapterRAM -Descending | Select-Object -First 1
    if ($vc) { $script:gpuName = $vc.Name }
  }
  $o.gpuName = $script:gpuName
  [Console]::Out.WriteLine(($o | ConvertTo-Json -Compress))
  [Console]::Out.Flush()
  if ($loops -gt 0 -and $i -ge $loops) { break }
  if (-not (Get-Process -Id $own -ErrorAction SilentlyContinue)) { exit }
  Start-Sleep -Seconds 12
}
