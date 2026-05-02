import Sidebar from "@/components/layout/Sidebar";
import { AppProvider } from "@/context/AppContext";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import BayDetail from "@/pages/BayDetail";
import Documents from "@/pages/Documents";
import FloorMap from "@/pages/FloorMap";
import GlobalOverview from "@/pages/GlobalOverview";
import KioskMode from "@/pages/KioskMode";
import Login from "@/pages/Login";
import NotFound from "@/pages/NotFound";
import OLEOverview from "@/pages/ole/OLEOverview";
import FourQGenerator from "@/pages/ole/FourQGenerator";
import OLEWorkcell from "@/pages/ole/OLEWorkcell";
import SMHStatus from "@/pages/ole/SMHStatus";
import DowntimeManagement from "@/pages/ole/DowntimeManagement";
import TransferManHour from "@/pages/ole/TransferManHour";
import OLEWoWAnalysis from "@/pages/ole/OLEWoWAnalysis";
import OLEHome1 from "@/pages/ole/OLEHome1";
import EBuildPlan from "@/pages/ebuild/eBuildPlan";
import IEBaseline from "@/pages/iebaseline/IEBaseline";
import IEBaselineEdit from "@/pages/iebaseline/IEBaselineEdit";
import ModuleOverview from "@/pages/iebaseline/ModuleOverview";
import ModuleAdmin from "@/pages/iebaseline/ModuleAdmin";
import LayoutEditor from "@/pages/fsms/LayoutEditor";
import BayManagement from "@/pages/fsms/BayManagement";
import OleMartApiTest from "@/pages/OleMartApiTest";
import Plants from "@/pages/Plants";
import Reports from "@/pages/Reports";
import Settings from "@/pages/Settings";
import WorkcellsTable from "@/pages/WorkcellsTable";
import WorkcellView from "@/pages/WorkcellView";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
  <TooltipProvider>
  <Toaster />
  <Sonner />
      <BrowserRouter>
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
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* <Header /> */}
        <main className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/" element={<GlobalOverview />} />
            <Route path="/workcells" element={<WorkcellsTable />} />
            <Route path="/workcell/:id" element={<WorkcellView />} />
            <Route path="/bay/:id" element={<BayDetail />} />
            <Route path="/documents" element={<Documents />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/plants" element={<Plants />} />
            <Route path="/floor-map" element={<FloorMap />} />
            <Route path="/ole" element={<OLEOverview />} />
            <Route path="/ole/smh-status" element={<SMHStatus />} />
            <Route path="/ole/4q" element={<FourQGenerator />} />
            <Route path="/ole/downtime" element={<DowntimeManagement />} />
            <Route path="/ole/transfer" element={<TransferManHour />} />
            <Route path="/ole/analysis" element={<OLEWoWAnalysis />} />
            <Route path="/ole/home1" element={<OLEHome1 />} />
            <Route path="/ole/:workcell" element={<OLEWorkcell />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/ole-mart-api" element={<OleMartApiTest />} />
            <Route path="/ebuild" element={<EBuildPlan />} />
            <Route path="/iebaseline" element={<IEBaseline />} />
            <Route path="/iebaseline/edit" element={<IEBaselineEdit />} />
            <Route path="/iebaseline/module/:moduleId" element={<ModuleOverview />} />
            <Route path="/iebaseline/admin/:moduleId" element={<ModuleAdmin />} />
            <Route path="/fsms/editor" element={<LayoutEditor />} />
            <Route path="/fsms/bays" element={<BayManagement />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default App;
