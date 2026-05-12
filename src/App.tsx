import Sidebar from "@/components/layout/Sidebar";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppProvider } from "@/context/AppContext";
import KioskMode from "@/pages/KioskMode";
import Login from "@/pages/Login";
import NotFound from "@/pages/NotFound";
import OLE4QReport from "@/pages/ole/OLE4QReport";
import OLESmh from "@/pages/ole/OLESmh";
import OlePlantReport from "@/pages/ole/OlePlantReport";
import OleWorkcellReport from "@/pages/ole/OleWorkcellReport";
import OleWowAnalysis from "@/pages/ole/OleWowAnalysis";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import MapPage from "./pages/MapPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter basename="/ietools/ole">
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
            <Route path="/" element={<Navigate to="/map" replace />} />
            <Route path="/map" element={<MapPage />} />
            <Route path="/smh" element={<OLESmh />} />
            <Route path="/4q" element={<OLE4QReport />} />
            <Route path="/analysis" element={<OleWowAnalysis />} />
            <Route path="/report" element={<OlePlantReport />} />
            <Route path="/report/wc/:workcell" element={<OleWorkcellReport />} />
            {/* <Route path="/workcells" element={<WorkcellsTable />} /> */}
            {/* <Route path="/workcell/:id" element={<WorkcellView />} /> */}
            {/* <Route path="/bay/:id" element={<BayDetail />} /> */}
            {/* <Route path="/documents" element={<Documents />} /> */}
            {/* <Route path="/reports" element={<Reports />} /> */}
            {/* <Route path="/plants" element={<Plants />} /> */}
            {/* <Route path="/floor-map" element={<FloorMap />} /> */}
            {/* <Route path="/ole" element={<OLEOverview />} /> */}
            {/* <Route path="/ole/downtime" element={<DowntimeManagement />} /> */}
            {/* <Route path="/ole/transfer" element={<TransferManHour />} /> */}
            {/* <Route path="/ole/home1" element={<OLEHome1 />} /> */}
            {/* <Route path="/ole/home2" element={<OLEHome2 />} /> */}
            {/* <Route path="/ole/home3" element={<OLEHome3 />} /> */}
            {/* <Route path="/ole/home5" element={<OLEHome5 />} /> */}
            {/* <Route path="/ole/:workcell" element={<OLEWorkcell />} /> */}
            {/* <Route path="/settings" element={<Settings />} /> */}
            {/* <Route path="/ole-mart-api" element={<OleMartApiTest />} /> */}
            {/* <Route path="/ebuild" element={<EBuildPlan />} /> */}
            {/* <Route path="/iebaseline" element={<IEBaseline />} /> */}
            {/* <Route path="/iebaseline/edit" element={<IEBaselineEdit />} /> */}
            {/* <Route path="/iebaseline/module/:moduleId" element={<ModuleOverview />} /> */}
            {/* <Route path="/iebaseline/admin/:moduleId" element={<ModuleAdmin />} /> */}
            {/* <Route path="/fsms/editor" element={<LayoutEditor />} /> */}
            {/* <Route path="/fsms/bays" element={<BayManagement />} /> */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default App;
