param()

$ErrorActionPreference = "Stop"

$result = [ordered]@{
  ok = $false
  source = "WIN32_FOREGROUND_WINDOW"
  ts = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  windowId = $null
  processId = $null
  processName = $null
  title = $null
  bounds = $null
  error = $null
}

try {
  Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Text;

namespace VirtualPetForegroundWindow {
  [StructLayout(LayoutKind.Sequential)]
  public struct RECT {
    public int Left;
    public int Top;
    public int Right;
    public int Bottom;
  }

  public static class User32 {
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
  }
}
"@ | Out-Null

  $foregroundWindow = [VirtualPetForegroundWindow.User32]::GetForegroundWindow()
  if ($foregroundWindow -eq [IntPtr]::Zero) {
    throw "foreground_window_unavailable"
  }

  $rect = New-Object VirtualPetForegroundWindow.RECT
  $gotRect = [VirtualPetForegroundWindow.User32]::GetWindowRect($foregroundWindow, [ref]$rect)
  if (-not $gotRect) {
    throw "foreground_window_rect_failed"
  }

  $width = [int]($rect.Right - $rect.Left)
  $height = [int]($rect.Bottom - $rect.Top)
  if ($width -le 0 -or $height -le 0) {
    throw "foreground_window_invalid_bounds"
  }

  [uint32]$processId = 0
  $null = [VirtualPetForegroundWindow.User32]::GetWindowThreadProcessId($foregroundWindow, [ref]$processId)

  $titleBuffer = New-Object System.Text.StringBuilder 1024
  $null = [VirtualPetForegroundWindow.User32]::GetWindowText($foregroundWindow, $titleBuffer, $titleBuffer.Capacity)
  $title = $titleBuffer.ToString().Trim()

  $processName = $null
  if ($processId -gt 0) {
    try {
      $processName = (Get-Process -Id ([int]$processId) -ErrorAction Stop).ProcessName
    } catch {
      $processName = $null
    }
  }

  $windowHandle = $foregroundWindow.ToInt64()
  $windowId = "0x{0:X}" -f $windowHandle

  $result.ok = $true
  $result.windowId = $windowId
  $result.processId = [int]$processId
  $result.processName = if ([string]::IsNullOrWhiteSpace($processName)) { $null } else { $processName }
  $result.title = if ([string]::IsNullOrWhiteSpace($title)) { $null } else { $title }
  $result.bounds = [ordered]@{
    x = [int]$rect.Left
    y = [int]$rect.Top
    width = $width
    height = $height
  }
} catch {
  $result.ok = $false
  $result.error = $_.Exception.Message
}

$result | ConvertTo-Json -Depth 6 -Compress
