!macro customInstall
  ; Phone Connect: let phones reach the engine over the LAN. The installer is
  ; elevated, so this rule is created once at install time and always points
  ; at this exact .exe — no per-run elevation dialogs for the user.
  nsExec::ExecToLog 'netsh advfirewall firewall delete rule name="Ultimate Media Vault - Phone Connect"'
  ; Upgrades from the pre-rebrand product may leave the old program-bound rule.
  nsExec::ExecToLog 'netsh advfirewall firewall delete rule name="FacebookGrabContents - Phone Connect"'
  nsExec::ExecToLog 'netsh advfirewall firewall add rule name="Ultimate Media Vault - Phone Connect" dir=in action=allow program="$INSTDIR\mediavault.exe" enable=yes profile=any'
!macroend

!macro customUnInstall
  ; Leave no dead rules behind on uninstall.
  nsExec::ExecToLog 'netsh advfirewall firewall delete rule name="Ultimate Media Vault - Phone Connect"'
!macroend
