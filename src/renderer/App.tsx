// This file is the main entry point for the React application. It sets up the overall layout, routing, 
// and global state management for the app. It also handles loading settings and downloads on startup 
// and applies the selected theme to the app.
import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useSettingsStore } from "@/renderer/stores/settingsStore";
import { useDownloadStore } from "@/renderer/stores/downloadStore";
import { useUIStore } from "@/renderer/stores/uiStore";
import TopNavBar from "@/renderer/components/TopNavBar";
import ToastContainer from "@/renderer/components/Toast";
import HomeView from "@/renderer/views/HomeView";
import VideoDownloadView from "@/renderer/views/VideoDownloadView";
import AudioExtractView from "@/renderer/views/AudioExtractView";
import PlaylistView from "@/renderer/views/PlaylistView";
import ClipsView from "@/renderer/views/ClipsView";
import QueueView from "@/renderer/views/QueueView";
import SettingsView from "@/renderer/views/SettingsView";

// The AppContent component is responsible for rendering the main content of the app 
// including the top navigation bar and the different views based on the current route.
// It also loads settings and downloads on startup and applies the selected theme.  
function AppContent() {
  const location = useLocation();
  const loadSettings = useSettingsStore((s) => s.loadSettings);
  const theme = useSettingsStore((s) => s.theme);
  const subscribeToEvents = useDownloadStore((s) => s.subscribeToEvents);
  const setActiveTab = useUIStore((s) => s.setActiveTab);
  const loadDownloads = useDownloadStore((s) => s.loadDownloads);
  const verifyDownloads = useDownloadStore((s) => s.verifyDownloads);

  useEffect(() => {
    loadSettings();
    loadDownloads();
    const cleanup = subscribeToEvents();
    
    // Periodically check if files were deleted from OS for 30 seconds and update status accordingly
    const interval = setInterval(verifyDownloads, 30000);
    
    return () => {
      cleanup();
      clearInterval(interval);
    };
  }, [loadSettings, loadDownloads, verifyDownloads, subscribeToEvents]);

  // Update active tab in UI store based on current route
  useEffect(() => {
    setActiveTab(location.pathname);
  }, [location.pathname, setActiveTab]);

  // Apply theme to html element
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Helper function to render a view and apply active class based on current route
  // This allows us to keep all views mounted and just show/hide them based on the route, which preserves state in each view
  const renderView = (path: string, component: React.ReactNode) => {
    const isActive = location.pathname === path;
    return (
      <div className={`tab-view ${isActive ? 'active' : ''}`} key={path}>
        {component}
      </div>
    );
  };

  return (
    // The main app container with top navigation and content area. 
    // The content area renders different views based on the current route.
    <div
      className="app"
      style={{
        padding: "16px",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        WebkitAppRegion: "drag" 
      } as any}
    >
      <TopNavBar />
      <main
        className="app-content"
        style={{
          marginTop: "16px",
          flex: 1,
          overflow: "hidden",
          position: "relative",
          WebkitAppRegion: "no-drag"
        } as any}
      >
        {renderView("/", <HomeView />)}
        {renderView("/video", <VideoDownloadView />)}
        {renderView("/audio", <AudioExtractView />)}
        {renderView("/playlist", <PlaylistView />)}
        {renderView("/clips", <ClipsView />)}
        {renderView("/queue", <QueueView />)}
        {renderView("/settings", <SettingsView />)}
      </main>
      <ToastContainer />
    </div>
  );
}

export default function App() {
  return <AppContent />;
}
