import Sidebar from "@/components/layout/Sidebar";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppProvider, useApp } from "@/context/AppContext";
import KioskMode from "@/pages/KioskMode";
import Login from "@/pages/Login";
import BayDetail from "@/pages/BayDetail";
import Documents from "@/pages/Documents";
import EBuildPlan from "@/pages/ebuild/eBuildPlan";
import FloorMap from "@/pages/FloorMap";
import BayManagement from "@/pages/fsms/BayManagement";
import LayoutEditor from "@/pages/fsms/LayoutEditor";
import GlobalOverview from "@/pages/GlobalOverview";
import IEBaseline from "@/pages/iebaseline/IEBaseline";
import IEBaselineEdit from "@/pages/iebaseline/IEBaselineEdit";
import ModuleAdmin from "@/pages/iebaseline/ModuleAdmin";
import ModuleOverview from "@/pages/iebaseline/ModuleOverview";
import NotFound from "@/pages/NotFound";
import Plants from "@/pages/Plants";
import Reports from "@/pages/Reports";
import Settings from "@/pages/Settings";
import WorkcellsTable from "@/pages/WorkcellsTable";
import WorkcellView from "@/pages/WorkcellView";
import OLE4QReport from "@/pages/ole/OLE4QReport";
import OLESmh from "@/pages/ole/OLESmh";
import OlePlantReport from "@/pages/ole/OlePlantReport";
import OleWorkcellReport from "@/pages/ole/OleWorkcellReport";
import OleWowAnalysis from "@/pages/ole/OleWowAnalysis";
import { BUILD_BASENAME, includesApp } from "@/lib/buildContext";
import { prefetchOleData } from "@/hooks/ole/useOleData";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import MapPage from "./pages/MapPage";
import DowntimeManagement from "./pages/ole/DowntimeManagement";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter basename={BUILD_BASENAME}>
        <AppProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/kiosk/:bayId" element={<KioskMode />} />
            <Route path="/*" element={<AppShell />} />
          </Routes>
        </AppProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

function AppShell() {
  const { pathname } = useLocation();
  useEffect(() => {
    if (!includesApp('ole')) return;
    if (pathname === '/' || pathname === '/ole/map' || pathname.startsWith('/ole/report')) {
      prefetchOleData();
    }
  }, [pathname]);
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* <Header /> */}
        <main className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/" element={<HomeRedirect />} />

            {includesApp('ole') && <>
              <Route path="/ole" element={<Navigate to="/ole/map" replace />} />
              <Route path="/ole/map" element={<MapPage />} />
              <Route path="/ole/smh" element={<OLESmh />} />
              <Route path="/ole/4q" element={<OLE4QReport />} />
              <Route path="/ole/analysis" element={<OleWowAnalysis />} />
              <Route path="/ole/report" element={<OlePlantReport />} />
              <Route path="/ole/report/wc/:workcell" element={<OleWorkcellReport />} />
              <Route path="/ole/downtime" element={<DowntimeManagement />} />
            </>}

            {includesApp('pulse') && <>
              <Route path="/pulse" element={<Navigate to="/pulse/overview" replace />} />
              <Route path="/pulse/overview" element={<GlobalOverview />} />
              <Route path="/pulse/plants" element={<Plants />} />
              <Route path="/pulse/workcells" element={<WorkcellsTable />} />
              <Route path="/pulse/workcell/:id" element={<WorkcellView />} />
              <Route path="/pulse/bay/:id" element={<BayDetail />} />
              <Route path="/pulse/reports" element={<Reports />} />
              <Route path="/pulse/documents" element={<Documents />} />
            </>}

            {includesApp('fsms') && <>
              <Route path="/fsms" element={<Navigate to="/fsms/plants" replace />} />
              <Route path="/fsms/plants" element={<Plants />} />
              <Route path="/fsms/floor-map" element={<FloorMap />} />
              <Route path="/fsms/editor" element={<LayoutEditor />} />
              <Route path="/fsms/bays" element={<BayManagement />} />
            </>}

            {includesApp('ebuild') && <>
              <Route path="/ebuild" element={<EBuildPlan />} />
            </>}

            {includesApp('iebaseline') && <>
              <Route path="/iebaseline" element={<IEBaseline />} />
              <Route path="/iebaseline/edit" element={<IEBaselineEdit />} />
              <Route path="/iebaseline/module/:moduleId" element={<ModuleOverview />} />
              <Route path="/iebaseline/admin/:moduleId" element={<ModuleAdmin />} />
            </>}

            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

/** Sends `/` to the active app's first nav item (so each build lands on its own home). */
function HomeRedirect() {
  const { activeApp } = useApp();
  const to = activeApp.navItems[0]?.to ?? '/map';
  return <Navigate to={to} replace />;
}

export default App;
