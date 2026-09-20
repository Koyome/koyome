' Koyome.me local site server - hidden launcher.
' Starts node detached (no console window, independent of whatever
' launched it). Double-click anytime to start the site in the
' background. The copy in the Startup folder runs this at logon.
' Stop the server: Task Manager -> Details -> node.exe -> End task.
Set ws = CreateObject("WScript.Shell")
ws.CurrentDirectory = "C:\Users\Public\koyome-site"
ws.Run """C:\Users\Public\koyome-node\node.exe"" ""C:\Users\Public\koyome-site\server.js""", 0, False
