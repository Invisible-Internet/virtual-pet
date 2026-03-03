param(
  [switch]$SkipOutputDevice
)

$ErrorActionPreference = "Stop"

function Await-WinRt {
  param(
    [Parameter(Mandatory = $true)] [object]$Operation,
    [Parameter(Mandatory = $true)] [Type]$ResultType
  )

  $taskType = [System.WindowsRuntimeSystemExtensions].GetMethods() |
    Where-Object {
      $_.Name -eq "AsTask" -and
      $_.IsGenericMethod -and
      $_.GetParameters().Count -eq 1
    } |
    Select-Object -First 1
  if ($null -eq $taskType) {
    throw "winrt_await_unavailable"
  }
  $task = $taskType.MakeGenericMethod($ResultType).Invoke($null, @($Operation))
  $task.Wait()
  return $task.Result
}

function Get-DefaultRenderEndpointInfo {
  Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

namespace VirtualPetAudio {
  enum EDataFlow { eRender, eCapture, eAll, EDataFlow_enum_count }
  enum ERole { eConsole, eMultimedia, eCommunications, ERole_enum_count }

  [StructLayout(LayoutKind.Sequential)]
  struct PROPERTYKEY {
    public Guid fmtid;
    public int pid;
  }

  [StructLayout(LayoutKind.Explicit)]
  struct PROPVARIANT {
    [FieldOffset(0)] public ushort vt;
    [FieldOffset(8)] public IntPtr pointerValue;
  }

  [ComImport]
  [Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
  class MMDeviceEnumeratorComObject {}

  [Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IMMDeviceEnumerator {
    int NotImpl1();
    [PreserveSig]
    int GetDefaultAudioEndpoint(EDataFlow dataFlow, ERole role, out IMMDevice ppDevice);
  }

  [Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IMMDevice {
    [PreserveSig]
    int Activate(ref Guid iid, int dwClsCtx, IntPtr pActivationParams, [MarshalAs(UnmanagedType.IUnknown)] out object ppInterface);
    [PreserveSig]
    int OpenPropertyStore(int stgmAccess, out IPropertyStore ppProperties);
    [PreserveSig]
    int GetId([MarshalAs(UnmanagedType.LPWStr)] out string ppstrId);
    [PreserveSig]
    int GetState(out int pdwState);
  }

  [Guid("886d8eeb-8cf2-4446-8d02-cdba1dbdcf99"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IPropertyStore {
    [PreserveSig]
    int GetCount(out int cProps);
    [PreserveSig]
    int GetAt(int iProp, out PROPERTYKEY pkey);
    [PreserveSig]
    int GetValue(ref PROPERTYKEY key, out PROPVARIANT pv);
    [PreserveSig]
    int SetValue(ref PROPERTYKEY key, ref PROPVARIANT propvar);
    [PreserveSig]
    int Commit();
  }

  public static class AudioEndpoint {
    [DllImport("ole32.dll")]
    static extern int PropVariantClear(ref PROPVARIANT pvar);

    public static string GetDefaultRenderEndpointName() {
      var enumerator = (IMMDeviceEnumerator)(new MMDeviceEnumeratorComObject());
      IMMDevice device;
      Marshal.ThrowExceptionForHR(enumerator.GetDefaultAudioEndpoint(EDataFlow.eRender, ERole.eMultimedia, out device));
      IPropertyStore properties;
      Marshal.ThrowExceptionForHR(device.OpenPropertyStore(0, out properties));
      var key = new PROPERTYKEY {
        fmtid = new Guid("a45c254e-df1c-4efd-8020-67d146a850e0"),
        pid = 14,
      };
      PROPVARIANT value;
      Marshal.ThrowExceptionForHR(properties.GetValue(ref key, out value));
      try {
        return Marshal.PtrToStringUni(value.pointerValue);
      } finally {
        PropVariantClear(ref value);
      }
    }

    public static string GetDefaultRenderEndpointId() {
      var enumerator = (IMMDeviceEnumerator)(new MMDeviceEnumeratorComObject());
      IMMDevice device;
      Marshal.ThrowExceptionForHR(enumerator.GetDefaultAudioEndpoint(EDataFlow.eRender, ERole.eMultimedia, out device));
      string id;
      Marshal.ThrowExceptionForHR(device.GetId(out id));
      return id;
    }
  }
}
"@ | Out-Null

  return @{
    name = [VirtualPetAudio.AudioEndpoint]::GetDefaultRenderEndpointName()
    id = [VirtualPetAudio.AudioEndpoint]::GetDefaultRenderEndpointId()
  }
}

$result = [ordered]@{
  ok = $true
  source = "GSMTC"
  ts = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  isPlaying = $false
  playbackStatus = "Idle"
  sourceAppUserModelId = $null
  title = $null
  artist = $null
  album = $null
  outputDeviceName = $null
  outputDeviceId = $null
  error = $null
}

try {
  Add-Type -AssemblyName System.Runtime.WindowsRuntime
  $null = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime]
  $null = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties, Windows.Media.Control, ContentType = WindowsRuntime]
  $manager = Await-WinRt ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
  $session = $manager.GetCurrentSession()

  if ($null -ne $session) {
    $mediaProps = Await-WinRt ($session.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
    $playbackInfo = $session.GetPlaybackInfo()
    $statusText = [string]$playbackInfo.PlaybackStatus
    $result.isPlaying = $statusText -eq "Playing" -or $statusText -eq "Changing"
    $result.playbackStatus = $statusText
    $result.sourceAppUserModelId = $session.SourceAppUserModelId
    $result.title = $mediaProps.Title
    $result.artist = $mediaProps.Artist
    $result.album = $mediaProps.AlbumTitle
  }

  if (-not $SkipOutputDevice) {
    try {
      $endpoint = Get-DefaultRenderEndpointInfo
      $result.outputDeviceName = $endpoint.name
      $result.outputDeviceId = $endpoint.id
    } catch {
      $result.outputDeviceName = $null
      $result.outputDeviceId = $null
    }
  }
} catch {
  $result.ok = $false
  $result.error = $_.Exception.Message
}

$result | ConvertTo-Json -Depth 8 -Compress
