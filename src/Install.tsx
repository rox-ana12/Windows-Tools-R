import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import "./Install.css";

interface AppItem {
  name: string;
  winget_id: string;
  category: string;
  desc: string;
}

interface OperationEvent {
  app_name: string;
  action: string;
  success: boolean;
  message: string;
}

const APP_CATALOG: AppItem[] = [
  { name: "Brave", winget_id: "Brave.Brave", category: "Browsers", desc: "Privacy-focused browser that blocks ads and trackers." },
  { name: "Chrome", winget_id: "Google.Chrome", category: "Browsers", desc: "Widely used browser with Google integration." },
  { name: "Chromium", winget_id: "Hibbiki.Chromium", category: "Browsers", desc: "Open-source foundation for many browsers." },
  { name: "Edge", winget_id: "Microsoft.Edge", category: "Browsers", desc: "Modern browser built on Chromium by Microsoft." },
  { name: "Falkon", winget_id: "KDE.Falkon", category: "Browsers", desc: "Lightweight web browser focused on privacy." },
  { name: "Firefox", winget_id: "Mozilla.Firefox", category: "Browsers", desc: "Open-source browser known for customization." },
  { name: "Firefox ESR", winget_id: "Mozilla.Firefox.ESR", category: "Browsers", desc: "Extended support release of Firefox." },
  { name: "Floorp", winget_id: "Ablaze.Floorp", category: "Browsers", desc: "Open-source browser aiming for simple browsing." },
  { name: "LibreWolf", winget_id: "LibreWolf.LibreWolf", category: "Browsers", desc: "Privacy-focused Firefox fork." },
  { name: "Mullvad Browser", winget_id: "MullvadVPN.MullvadBrowser", category: "Browsers", desc: "Privacy browser in partnership with Tor." },
  { name: "Opera", winget_id: "Opera.Opera", category: "Browsers", desc: "Browser with built-in ad blocker and VPN." },
  { name: "Opera GX", winget_id: "Opera.OperaGX", category: "Browsers", desc: "Gaming browser with CPU/RAM limiters." },
  { name: "PaleMoon", winget_id: "MoonchildProductions.PaleMoon", category: "Browsers", desc: "Open-source browser based on Firefox." },
  { name: "Thorium AVX2", winget_id: "Alex313031.Thorium.AVX2", category: "Browsers", desc: "Fast Chromium fork with AVX2 optimizations." },
  { name: "Tor Browser", winget_id: "TorProject.TorBrowser", category: "Browsers", desc: "Anonymous browsing via Tor network." },
  { name: "UnGoogled Chromium", winget_id: "eloston.ungoogled-chromium", category: "Browsers", desc: "Chromium without Google integration." },
  { name: "Vivaldi", winget_id: "Vivaldi.Vivaldi", category: "Browsers", desc: "Highly customizable productivity browser." },
  { name: "Waterfox", winget_id: "Waterfox.Waterfox", category: "Browsers", desc: "Privacy-focused browser based on Firefox." },
  { name: "Zen Browser", winget_id: "Zen-Team.Zen-Browser", category: "Browsers", desc: "Modern privacy-focused browser on Firefox." },

  { name: "1Password", winget_id: "AgileBits.1Password", category: "Utilities", desc: "Password manager for secure credentials." },
  { name: "7-Zip", winget_id: "7zip.7zip", category: "Utilities", desc: "Free file archiver with high compression." },
  { name: "Advanced Renamer", winget_id: "HulubuluSoftware.AdvancedRenamer", category: "Utilities", desc: "Batch file renaming tool." },
  { name: "AIDA64", winget_id: "FinalWire.AIDA64.Business", category: "Utilities", desc: "System diagnostics and benchmarking." },
  { name: "AOMEI Backupper", winget_id: "AOMEI.Backupper.Standard", category: "Utilities", desc: "Backup and recovery software." },
  { name: "AOMEI Partition Assistant", winget_id: "AOMEI.PartitionAssistant", category: "Utilities", desc: "Disk partition management tool." },
  { name: "AnyDesk", winget_id: "AnyDesk.AnyDesk", category: "Utilities", desc: "Fast remote desktop software." },
  { name: "AutoHotkey", winget_id: "AutoHotkey.AutoHotkey", category: "Utilities", desc: "Scripting language for automation." },
  { name: "Bitwarden", winget_id: "Bitwarden.Bitwarden", category: "Utilities", desc: "Open-source password manager." },
  { name: "BleachBit", winget_id: "BleachBit.BleachBit", category: "Utilities", desc: "Disk space cleaner and privacy manager." },
  { name: "Bulk Crap Uninstaller", winget_id: "Klocman.BulkCrapUninstaller", category: "Utilities", desc: "Batch uninstaller with leftover cleanup." },
  { name: "Bulk Rename Utility", winget_id: "TGRMNSoftware.BulkRenameUtility", category: "Utilities", desc: "Recursive file renaming tool." },
  { name: "CCleaner", winget_id: "Piriform.CCleaner", category: "Utilities", desc: "System cleaner and optimizer." },
  { name: "CPU-Z", winget_id: "CPUID.CPU-Z", category: "Utilities", desc: "Hardware monitoring and diagnostics." },
  { name: "CrystalDiskInfo", winget_id: "CrystalDewWorld.CrystalDiskInfo", category: "Utilities", desc: "Disk health monitoring tool." },
  { name: "CrystalDiskMark", winget_id: "CrystalDewWorld.CrystalDiskMark", category: "Utilities", desc: "Disk benchmarking tool." },
  { name: "DevToys", winget_id: "DevToys-app.DevToys", category: "Utilities", desc: "Collection of dev utilities." },
  { name: "Dual Monitor Tools", winget_id: "GNE.DualMonitorTools", category: "Utilities", desc: "Multi-monitor management tools." },
  { name: "Everything", winget_id: "voidtools.Everything", category: "Utilities", desc: "Instant file search for Windows." },
  { name: "ExifCleaner", winget_id: "szTheory.exifcleaner", category: "Utilities", desc: "Remove EXIF metadata from images." },
  { name: "File Converter", winget_id: "AdrienAllard.FileConverter", category: "Utilities", desc: "Context menu file converter." },
  { name: "F.lux", winget_id: "flux.flux", category: "Utilities", desc: "Screen color temperature adjuster." },
  { name: "Google Drive", winget_id: "Google.GoogleDrive", category: "Utilities", desc: "Cloud storage and sync." },
  { name: "GPU-Z", winget_id: "TechPowerUp.GPU-Z", category: "Utilities", desc: "Graphics card information tool." },
  { name: "KDE Connect", winget_id: "KDE.KDEConnect", category: "Utilities", desc: "Phone-PC integration tool." },
  { name: "LockHunter", winget_id: "CrystalRich.LockHunter", category: "Utilities", desc: "Unlock files locked by processes." },
  { name: "Malwarebytes", winget_id: "Malwarebytes.Malwarebytes", category: "Utilities", desc: "Anti-malware protection." },
  { name: "Meld", winget_id: "Meld.Meld", category: "Utilities", desc: "Visual diff and merge tool." },
  { name: "NanaZip", winget_id: "M2Team.NanaZip", category: "Utilities", desc: "Open-source file archiver." },
  { name: "Nextcloud Desktop", winget_id: "Nextcloud.NextcloudDesktop", category: "Utilities", desc: "Nextcloud file sync client." },
  { name: "Nilesoft Shell", winget_id: "Nilesoft.Shell", category: "Utilities", desc: "Customizable file explorer." },
  { name: "Notion", winget_id: "Notion.Notion", category: "Utilities", desc: "All-in-one workspace." },
  { name: "Nushell", winget_id: "Nushell.Nushell", category: "Utilities", desc: "Modern shell and scripting." },
  { name: "OFGB", winget_id: "xM4ddy.OFGB", category: "Utilities", desc: "Remove ads from Windows 11." },
  { name: "Oracle VirtualBox", winget_id: "Oracle.VirtualBox", category: "Utilities", desc: "Cross-platform virtualization." },
  { name: "ownCloud Desktop", winget_id: "ownCloud.ownCloudDesktop", category: "Utilities", desc: "ownCloud file sync client." },
  { name: "PowerToys", winget_id: "Microsoft.PowerToys", category: "Utilities", desc: "Productivity tools by Microsoft." },
  { name: "qBittorrent", winget_id: "qBittorrent.qBittorrent", category: "Utilities", desc: "Open-source BitTorrent client." },
  { name: "Revo Uninstaller", winget_id: "RevoUninstaller.RevoUninstaller", category: "Utilities", desc: "Advanced software uninstaller." },
  { name: "Rufus", winget_id: "Rufus.Rufus", category: "Utilities", desc: "Create bootable USB drives." },
  { name: "TeamViewer", winget_id: "TeamViewer.TeamViewer", category: "Utilities", desc: "Remote access and control." },
  { name: "TeraCopy", winget_id: "CodeSector.TeraCopy", category: "Utilities", desc: "Enhanced file copy utility." },
  { name: "Total Commander", winget_id: "Ghisler.TotalCommander", category: "Utilities", desc: "Dual-pane file manager." },
  { name: "Transmission", winget_id: "Transmission.Transmission", category: "Utilities", desc: "Lightweight BitTorrent client." },
  { name: "UniGetUI", winget_id: "MartiCliment.UniGetUI", category: "Utilities", desc: "GUI for winget package manager." },
  { name: "WinRAR", winget_id: "RARLab.WinRAR", category: "Utilities", desc: "Popular file archiver." },
  { name: "WinZip", winget_id: "Corel.WinZip", category: "Utilities", desc: "File compression and archiving." },

  { name: "Betterbird", winget_id: "Betterbird.Betterbird", category: "Communications", desc: "Thunderbird fork with fixes." },
  { name: "BlueMail", winget_id: "Blix.BlueMail", category: "Communications", desc: "Versatile email client." },
  { name: "Discord", winget_id: "Discord.Discord", category: "Communications", desc: "Chat and voice for communities." },
  { name: "Franz", winget_id: "StefanMalzner.Franz", category: "Communications", desc: "Multi-service messaging app." },
  { name: "HexChat", winget_id: "HexChat.HexChat", category: "Communications", desc: "Open-source IRC client." },
  { name: "Microsoft Teams", winget_id: "Microsoft.Teams", category: "Communications", desc: "Microsoft 365 collaboration." },
  { name: "Mumble Client", winget_id: "Mumble.Mumble.Client", category: "Communications", desc: "Low-latency voice chat." },
  { name: "Mumble Server", winget_id: "Mumble.Mumble.Server", category: "Communications", desc: "Mumble voice server." },
  { name: "Pidgin", winget_id: "Pidgin.Pidgin", category: "Communications", desc: "Multi-protocol IM client." },
  { name: "Proton Mail", winget_id: "Proton.ProtonMail", category: "Communications", desc: "Encrypted email service." },
  { name: "Revolt", winget_id: "Revolt.RevoltDesktop", category: "Communications", desc: "Open-source chat platform." },
  { name: "Signal", winget_id: "OpenWhisperSystems.Signal", category: "Communications", desc: "Secure encrypted messaging." },
  { name: "Slack", winget_id: "SlackTechnologies.Slack", category: "Communications", desc: "Team collaboration platform." },
  { name: "Telegram", winget_id: "Telegram.TelegramDesktop", category: "Communications", desc: "Cloud messaging app." },
  { name: "Thunderbird", winget_id: "Mozilla.Thunderbird", category: "Communications", desc: "Free open-source email client." },
  { name: "Viber", winget_id: "Rakuten.Viber", category: "Communications", desc: "Messaging and VoIP app." },
  { name: "Zoom", winget_id: "Zoom.Zoom", category: "Communications", desc: "Video conferencing platform." },

  { name: "Aegisub", winget_id: "Aegisub.Aegisub", category: "Development", desc: "Subtitle creation and editing." },
  { name: "Android Studio", winget_id: "Google.AndroidStudio", category: "Development", desc: "Official Android IDE." },
  { name: "Arduino IDE", winget_id: "ArduinoSA.IDE.stable", category: "Development", desc: "Arduino programming platform." },
  { name: "Atom", winget_id: "GitHub.Atom", category: "Development", desc: "Hackable text editor." },
  { name: "AutoIt", winget_id: "AutoIt.AutoIt", category: "Development", desc: "Windows GUI automation." },
  { name: "Brackets", winget_id: "Adobe.Brackets", category: "Development", desc: "Web design editor." },
  { name: "CMake", winget_id: "Kitware.CMake", category: "Development", desc: "Build system generator." },
  { name: "Code::Blocks MinGW", winget_id: "CodeBlocks.CodeBlocks.MinGW", category: "Development", desc: "C/C++ IDE with MinGW." },
  { name: "Docker Desktop", winget_id: "Docker.DockerDesktop", category: "Development", desc: "Container management." },
  { name: "Eclipse C/C++", winget_id: "EclipseFoundation.Eclipse.CPP", category: "Development", desc: "IDE for C and C++." },
  { name: "Eclipse Java", winget_id: "EclipseFoundation.Eclipse.Java", category: "Development", desc: "IDE for Java developers." },
  { name: "Eclipse Java EE", winget_id: "EclipseFoundation.Eclipse.JEE", category: "Development", desc: "IDE for enterprise Java." },
  { name: "Eclipse PHP", winget_id: "EclipseFoundation.Eclipse.PHP", category: "Development", desc: "IDE for PHP developers." },
  { name: "Fork", winget_id: "Fork.Fork", category: "Development", desc: "Fast Git client." },
  { name: "Git", winget_id: "Git.Git", category: "Development", desc: "Distributed version control." },
  { name: "Git Butler", winget_id: "GitButler.GitButler", category: "Development", desc: "Git GUI client." },
  { name: "Git Extensions", winget_id: "GitExtensionsTeam.GitExtensions", category: "Development", desc: "Git GUI for Windows." },
  { name: "GitHub CLI", winget_id: "GitHub.cli", category: "Development", desc: "GitHub from command line." },
  { name: "GitHub Desktop", winget_id: "GitHub.GitHubDesktop", category: "Development", desc: "Git GUI by GitHub." },
  { name: "Gitify", winget_id: "Gitify.Gitify", category: "Development", desc: "GitHub notifications tool." },
  { name: "IntelliJ IDEA Community", winget_id: "JetBrains.IntelliJIDEA.Community", category: "Development", desc: "Free Java/Kotlin IDE." },
  { name: "JetBrains Toolbox", winget_id: "JetBrains.Toolbox", category: "Development", desc: "Manage JetBrains tools." },
  { name: "NetBeans", winget_id: "Apache.NetBeans", category: "Development", desc: "Free IDE for multiple languages." },
  { name: "Neovim", winget_id: "Neovim.Neovim", category: "Development", desc: "Extensible text editor." },
  { name: "Node.js Current", winget_id: "OpenJS.NodeJS", category: "Development", desc: "JavaScript runtime." },
  { name: "Node.js LTS", winget_id: "OpenJS.NodeJS.LTS", category: "Development", desc: "Node.js long-term support." },
  { name: "NVM for Windows", winget_id: "CoreyButler.NVMforWindows", category: "Development", desc: "Node.js version manager." },
  { name: "Oh My Posh", winget_id: "JanDeDobbeleer.OhMyPosh", category: "Development", desc: "Prompt theme engine." },
  { name: "PHPStorm", winget_id: "JetBrains.PhpStorm", category: "Development", desc: "PHP IDE by JetBrains." },
  { name: "Postman", winget_id: "Postman.Postman", category: "Development", desc: "API development platform." },
  { name: "Pulsar", winget_id: "Pulsar-Edit.Pulsar", category: "Development", desc: "Community-led Atom fork." },
  { name: "PyCharm", winget_id: "JetBrains.PyCharm", category: "Development", desc: "Python IDE by JetBrains." },
  { name: "Python 3", winget_id: "Python.Python.3.13", category: "Development", desc: "High-level programming language." },
  { name: "RubyMine", winget_id: "JetBrains.RubyMine", category: "Development", desc: "Ruby IDE by JetBrains." },
  { name: "Rust", winget_id: "Rustlang.Rust.MSVC", category: "Development", desc: "Systems programming language." },
  { name: "Sublime Text 4", winget_id: "SublimeHQ.SublimeText.4", category: "Development", desc: "Sophisticated text editor." },
  { name: "Thonny", winget_id: "AivarAnnamaa.Thonny", category: "Development", desc: "Python IDE for beginners." },
  { name: "Vim", winget_id: "vim.vim", category: "Development", desc: "Highly configurable text editor." },
  { name: "Visual Studio 2022", winget_id: "Microsoft.VisualStudio.2022.Community", category: "Development", desc: "Full-featured IDE." },
  { name: "VS Code", winget_id: "Microsoft.VisualStudioCode", category: "Development", desc: "Lightweight code editor." },
  { name: "VS Codium", winget_id: "VSCodium.VSCodium", category: "Development", desc: "Privacy-focused VS Code." },
  { name: "WampServer", winget_id: "Wampserver.Wampserver", category: "Development", desc: "PHP dev environment." },
  { name: "WebStorm", winget_id: "JetBrains.WebStorm", category: "Development", desc: "JavaScript IDE." },
  { name: "XAMPP 8.2", winget_id: "ApacheFriends.Xampp.8.2", category: "Development", desc: "Web server solution stack." },
  { name: "Zed", winget_id: "Zed.Zed", category: "Development", desc: "High-performance code editor." },

  { name: "Adobe Acrobat Reader", winget_id: "Adobe.Acrobat.Reader.64-bit", category: "Document", desc: "View and annotate PDFs." },
  { name: "AFFiNE", winget_id: "ToEverything.AFFiNE", category: "Document", desc: "Notion & Miro alternative." },
  { name: "Calibre", winget_id: "calibre.calibre", category: "Document", desc: "E-book management." },
  { name: "Foxit PDF Editor", winget_id: "Foxit.PhantomPDF", category: "Document", desc: "PDF editing software." },
  { name: "Foxit PDF Reader", winget_id: "Foxit.FoxitReader", category: "Document", desc: "Fast PDF viewer." },
  { name: "Grammarly", winget_id: "Grammarly.Grammarly", category: "Document", desc: "Writing assistant." },
  { name: "LibreOffice", winget_id: "TheDocumentFoundation.LibreOffice", category: "Document", desc: "Free office suite." },
  { name: "NAPS2", winget_id: "XPFPGHZZ8M7MMH", category: "Document", desc: "Document scanner to PDF." },
  { name: "Notepad++", winget_id: "Notepad++.Notepad++", category: "Document", desc: "Source code and text editor." },
  { name: "Obsidian", winget_id: "Obsidian.Obsidian", category: "Document", desc: "Knowledge base and notes." },
  { name: "Okular", winget_id: "KDE.Okular", category: "Document", desc: "Universal document viewer." },
  { name: "ONLYOffice", winget_id: "ONLYOFFICE.DesktopEditors", category: "Document", desc: "Open-source office suite." },
  { name: "PDF24 Creator", winget_id: "geeksoftwareGmbH.PDF24Creator", category: "Document", desc: "Free PDF creation tool." },
  { name: "PDFgear", winget_id: "PDFgear.PDFgear", category: "Document", desc: "Free PDF editor." },
  { name: "Scribus", winget_id: "Scribus.Scribus", category: "Document", desc: "Desktop publishing." },
  { name: "Sumatra PDF", winget_id: "SumatraPDF.SumatraPDF", category: "Document", desc: "Lightweight PDF viewer." },
  { name: "WinMerge", winget_id: "WinMerge.WinMerge", category: "Document", desc: "File comparison tool." },
  { name: "WPS Office", winget_id: "Kingsoft.WPSOffice", category: "Document", desc: "Free office suite." },
  { name: "Xournal++", winget_id: "Xournal++.Xournal++", category: "Document", desc: "Note-taking software." },

  { name: "AIMP", winget_id: "AIMP.AIMP", category: "Multimedia", desc: "Feature-rich music player." },
  { name: "Audacity", winget_id: "Audacity.Audacity", category: "Multimedia", desc: "Audio editor and recorder." },
  { name: "Blender", winget_id: "BlenderFoundation.Blender", category: "Multimedia", desc: "Free 3D creation suite." },
  { name: "Clementine", winget_id: "Clementine.Clementine", category: "Multimedia", desc: "Music player and organizer." },
  { name: "EarTrumpet", winget_id: "File-New-Project.EarTrumpet", category: "Multimedia", desc: "Advanced volume control." },
  { name: "FFmpeg", winget_id: "Gyan.FFmpeg", category: "Multimedia", desc: "Multimedia processing framework." },
  { name: "FreeCAD", winget_id: "FreeCAD.FreeCAD", category: "Multimedia", desc: "Parametric 3D CAD modeler." },
  { name: "FxSound", winget_id: "FxSound.FxSound", category: "Multimedia", desc: "Audio enhancement software." },
  { name: "GIMP 3", winget_id: "GIMP.GIMP.3", category: "Multimedia", desc: "Image manipulation program." },
  { name: "ImgBurn", winget_id: "LIGHTNINGUK.ImgBurn", category: "Multimedia", desc: "Disc burning software." },
  { name: "Inkscape", winget_id: "Inkscape.Inkscape", category: "Multimedia", desc: "Vector graphics editor." },
  { name: "iTunes", winget_id: "Apple.iTunes", category: "Multimedia", desc: "Media player and device manager." },
  { name: "Kdenlive", winget_id: "KDE.Kdenlive", category: "Multimedia", desc: "Open-source video editor." },
  { name: "K-Lite Codec Pack", winget_id: "CodecGuide.K-LiteCodecPack.Standard", category: "Multimedia", desc: "Essential audio/video codecs." },
  { name: "Kodi", winget_id: "XBMCFoundation.Kodi", category: "Multimedia", desc: "Media center software." },
  { name: "Krita", winget_id: "KDE.Krita", category: "Multimedia", desc: "Digital painting software." },
  { name: "OBS Studio", winget_id: "OBSProject.OBSStudio", category: "Multimedia", desc: "Recording and live streaming." },
  { name: "Paint.NET", winget_id: "dotPDN.PaintDotNet", category: "Multimedia", desc: "Free image editor." },
  { name: "Plex Desktop", winget_id: "Plex.Plex", category: "Multimedia", desc: "Media streaming client." },
  { name: "Plex Media Server", winget_id: "Plex.PlexMediaServer", category: "Multimedia", desc: "Media server software." },
  { name: "Shotcut", winget_id: "Meltytech.Shotcut", category: "Multimedia", desc: "Open-source video editor." },
  { name: "SMPlayer", winget_id: "SMPlayer.SMPlayer", category: "Multimedia", desc: "Multimedia player." },
  { name: "Spotify", winget_id: "Spotify.Spotify", category: "Multimedia", desc: "Music streaming service." },
  { name: "VLC", winget_id: "VideoLAN.VLC", category: "Multimedia", desc: "Versatile media player." },
];

function Install() {
  const [wingetAvailable, setWingetAvailable] = useState<boolean | null>(null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [statuses, setStatuses] = useState<Record<string, { installing: boolean; msg: string; success?: boolean }>>({});
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0, appName: "", action: "" as "install" | "uninstall" | "" });
  const [batchMessage, setBatchMessage] = useState<string | null>(null);
  const [pendingOps, setPendingOps] = useState(0);
  const pendingOpsRef = useRef(0);

  useEffect(() => {
    invoke<boolean>("check_winget").then(setWingetAvailable);
  }, []);

  const checkInstalled = useCallback(async () => {
    try {
      const ids = APP_CATALOG.map((a) => a.winget_id);
      const results = await invoke<string[]>("check_apps_installed", { apps: ids });
      const newStatuses: Record<string, { installing: boolean; msg: string; success: boolean }> = {};
      for (let i = 0; i < APP_CATALOG.length; i++) {
        newStatuses[APP_CATALOG[i].name] = {
          installing: false,
          msg: results[i] === "installed" ? "Installed" : "Not installed",
          success: results[i] === "installed",
        };
      }
      setStatuses(newStatuses);
    } catch (e) {
      console.error("check_apps_installed failed:", e);
    }
  }, []);

  useEffect(() => {
    if (wingetAvailable) checkInstalled();
  }, [wingetAvailable, checkInstalled]);

  useEffect(() => {
    const unlisten = listen<OperationEvent>("operation-done", (event) => {
      const { app_name, success, message } = event.payload;
      setStatuses((prev) => ({ ...prev, [app_name]: { installing: false, msg: success ? "Installed" : message, success } }));
      setPendingOps((prev) => Math.max(0, prev - 1));
    });
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  useEffect(() => {
    if (!batchRunning || pendingOps > 0) return;
    (async () => {
      await new Promise((r) => setTimeout(r, 500));
      await checkInstalled();
      getCurrentWindow().show();
      setBatchRunning(false);
      setSelected(new Set());
    })();
  }, [pendingOps, batchRunning, checkInstalled]);

  const toggleSelect = (wingetId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(wingetId)) next.delete(wingetId);
      else next.add(wingetId);
      return next;
    });
  };

  const uninstall = (item: AppItem) => {
    setStatuses((prev) => ({ ...prev, [item.name]: { installing: true, msg: "Uninstalling..." } }));
    invoke("uninstall_app", { wingetId: item.winget_id, appName: item.name });
    setSelected((prev) => { const next = new Set(prev); next.delete(item.winget_id); return next; });
  };

  const installSelected = () => {
    const selectedApps = filtered.filter((a) => selected.has(a.winget_id));
    if (selectedApps.length === 0) return;
    const alreadyInstalled = selectedApps.filter((a) => statuses[a.name]?.success);
    const toInstall = selectedApps.filter((a) => !statuses[a.name]?.success);
    if (toInstall.length === 0) {
      setBatchMessage("All selected apps are already installed.");
      return;
    }
    setBatchRunning(true);
    pendingOpsRef.current = toInstall.length;
    setPendingOps(toInstall.length);
    setBatchProgress({ current: 0, total: toInstall.length, appName: "", action: "install" });
    for (const app of toInstall) {
      setStatuses((prev) => ({ ...prev, [app.name]: { installing: true, msg: "Installing..." } }));
      invoke("install_app", { wingetId: app.winget_id, appName: app.name });
    }
    if (alreadyInstalled.length > 0) {
      const names = alreadyInstalled.map((a) => a.name).join(", ");
      setBatchMessage(`Skipped already installed: ${names}`);
    }
  };

  const uninstallSelected = () => {
    const selectedApps = filtered.filter((a) => selected.has(a.winget_id));
    if (selectedApps.length === 0) return;
    const toUninstall = selectedApps.filter((a) => statuses[a.name]?.success);
    const notInstalled = selectedApps.filter((a) => !statuses[a.name]?.success);
    if (toUninstall.length === 0) {
      setBatchMessage("None of the selected apps are installed.");
      return;
    }
    setBatchRunning(true);
    pendingOpsRef.current = toUninstall.length;
    setPendingOps(toUninstall.length);
    setBatchProgress({ current: 0, total: toUninstall.length, appName: "", action: "uninstall" });
    for (const app of toUninstall) {
      setStatuses((prev) => ({ ...prev, [app.name]: { installing: true, msg: "Uninstalling..." } }));
      invoke("uninstall_app", { wingetId: app.winget_id, appName: app.name });
    }
    if (notInstalled.length > 0) {
      const names = notInstalled.map((a) => a.name).join(", ");
      setBatchMessage(`Skipped not installed: ${names}`);
    }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return APP_CATALOG;
    return APP_CATALOG.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.desc.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q)
    );
  }, [search]);

  const grouped = useMemo(() => {
    const map: Record<string, AppItem[]> = {};
    for (const app of filtered) {
      if (!map[app.category]) map[app.category] = [];
      map[app.category].push(app);
    }
    return map;
  }, [filtered]);

  if (wingetAvailable === false) {
    return (
      <div className="page-content">
        <h1 className="page-title">Install Apps</h1>
        <div className="action-banner error">winget not found. Install App Installer from Microsoft Store.</div>
      </div>
    );
  }

  if (wingetAvailable === null) {
    return <div className="page-content"><p>Checking winget availability...</p></div>;
  }

  const selCount = filtered.filter((a) => selected.has(a.winget_id)).length;

  return (
    <div className="page-content">
      <h1 className="page-title">Install Apps</h1>
      <p className="page-subtitle">Select applications to install via winget</p>

      <div className="install-search">
        <input
          type="text"
          placeholder="Search applications..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="search-input"
        />
        <span className="search-count">{filtered.length} app{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      <div className="install-actions">
        <div className="selection-bar">
          <span className="sel-count">{selCount} selected</span>
          <button className="action-btn" onClick={() => setSelected(new Set(filtered.map((a) => a.winget_id)))} disabled={batchRunning}>Select All</button>
          <button className="action-btn" onClick={() => setSelected(new Set())} disabled={batchRunning}>Clear</button>
          <button className="install-selected-btn" onClick={installSelected} disabled={selCount === 0 || batchRunning}>
            {batchRunning && batchProgress.action === "install" ? `Installing ${batchProgress.total - pendingOps}/${batchProgress.total}...` : `Install Selected (${selCount})`}
          </button>
          <button className="uninstall-selected-btn" onClick={uninstallSelected} disabled={selCount === 0 || batchRunning}>
            {batchRunning && batchProgress.action === "uninstall" ? `Uninstalling ${batchProgress.total - pendingOps}/${batchProgress.total}...` : `Uninstall Selected (${selCount})`}
          </button>
        </div>
        {batchRunning && (
          <div className="batch-progress">
            <div className="batch-info">
              {batchProgress.action === "install" ? "Installing" : "Uninstalling"} {batchProgress.total - pendingOps}/{batchProgress.total}
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${((batchProgress.total - pendingOps) / batchProgress.total) * 100}%` }} />
            </div>
          </div>
        )}
      </div>

      {batchMessage && (
        <div className="batch-notification">
          <span>{batchMessage}</span>
          <button className="notification-close" onClick={() => setBatchMessage(null)}>×</button>
        </div>
      )}
      <div className="install-catalog">
        {Object.entries(grouped).map(([category, apps]) => (
          <details key={category} className="install-category" open>
            <summary className="category-header">
              {category}
              <span className="category-count">{apps.length}</span>
            </summary>
            <div className="category-apps">
              {apps.map((app) => {
                const st = statuses[app.name];
                const installing = st?.installing;
                const done = st && !st.installing;
                const isChecked = selected.has(app.winget_id);
                return (
                  <div key={app.winget_id} className={`app-item ${done ? (st.success ? "installed" : "failed") : ""}`}>
                    <label className="app-check-label">
                      <input
                        type="checkbox"
                        className="app-checkbox"
                        checked={isChecked}
                        onChange={() => toggleSelect(app.winget_id)}
                        disabled={installing}
                      />
                      <div className="app-info">
                        <span className="app-name">{app.name}</span>
                        <span className="app-desc">{app.desc}</span>
                      </div>
                    </label>
                    <div className="app-action">
                      {installing ? (
                        <span className="installing-spinner">⟳</span>
                      ) : done && st.success ? (
                        <>
                          <span className="status-tag installed">✓ Installed</span>
                          <button className="uninstall-btn" onClick={() => uninstall(app)} disabled={batchRunning}>
                            Uninstall
                          </button>
                        </>
                      ) : st ? (
                        <span className="status-tag failed">✗ {st.msg}</span>
                      ) : (
                        <span className="status-tag loading">⟳ Loading...</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}

export default Install;
