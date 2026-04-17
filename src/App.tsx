import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import GlobalOverview from "@/pages/GlobalOverview";
import WorkcellView from "@/pages/WorkcellView";
import BayDetail from "@/pages/BayDetail";
import KioskMode from "@/pages/KioskMode";
import Login from "@/pages/Login";
import NotFound from "@/pages/NotFound";
import Documents from "@/pages/Documents";
import WorkcellsTable from "@/pages/WorkcellsTable";
import Reports from "@/pages/Reports";
import Settings from "@/pages/Settings";
import Plants from "@/pages/Plants";
import FloorMap from "@/pages/FloorMap";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/kiosk/:bayId" element={<KioskMode />} />
          <Route path="/*" element={<AppShell />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

function AppShell() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/" element={<div className="p-6"><GlobalOverview /></div>} />
            <Route path="/workcells" element={<WorkcellsTable />} />
            <Route path="/workcell/:id" element={<WorkcellView />} />
            <Route path="/bay/:id" element={<BayDetail />} />
            <Route path="/documents" element={<div className="p-6"><Documents /></div>} />
            <Route path="/reports" element={<div className="p-6"><Reports /></div>} />
            <Route path="/plants" element={<Plants />} />
            <Route path="/floor-map" element={<FloorMap />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default App;
