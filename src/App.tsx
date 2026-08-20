import Sidebar from "@/components/layout/Sidebar";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppProvider, useApp } from "@/context/AppContext";
import { prefetchOleData } from "@/hooks/ole/useOleData";
import { BUILD_BASENAME, includesApp } from "@/lib/buildContext";
import BayDetail from "@/pages/BayDetail";
import CycleTimeWorkcells from "@/pages/cycletime/CycleTimeWorkcells";
import CycleTime4QReport from "@/pages/cycletime/CycleTime4QReport";
import CycleTimeChat from "@/pages/cycletime/CycleTimeChat";
import DemandCompletionReport from "@/pages/cycletime/DemandCompletionReport";
import IncompletionReport from "@/pages/cycletime/IncompletionReport";
import IncompletionReportDetail from "@/pages/cycletime/IncompletionReportDetail";
import PlantRunnerDashboard from "@/pages/cycletime/PlantRunnerDashboard";
import ProcessRegistry from "@/pages/cycletime/ProcessRegistry";
import ProcessesGlobal from "@/pages/cycletime/ProcessesGlobal";
import WorkcellCoverage from "@/pages/cycletime/WorkcellCoverage";
import CycleTimeHomeNew from "@/pages/cycletime/CycleTimeHomeNew";
import CycleTimeModel from "@/pages/cycletime/CycleTimeModel";
import CycleTimeWorkcellModels from "@/pages/cycletime/CycleTimeWorkcellModels";
import Documents from "@/pages/Documents";
import EBuildPlan from "@/pages/ebuild/eBuildPlan";
import FloorMap from "@/pages/FloorMap";
import MachineMoverHome from "@/pages/machinemover/MachineMoverHome";
import MachineMoverApprovals from "@/pages/machinemover/MachineMoverApprovals";
import MachineMoverReports from "@/pages/machinemover/MachineMoverReports";
import BayManagement from "@/pages/fsms/BayManagement";
import LayoutEditor from "@/pages/fsms/LayoutEditor";
import FsmsDashboard from "@/pages/fsms/FsmsDashboard";
import FsmsPlants from "@/pages/fsms/FsmsPlants";
import FsmsSubmissions from "@/pages/fsms/FsmsSubmissions";
import GlobalOverview from "@/pages/GlobalOverview";
import IEBaseline from "@/pages/iebaseline/IEBaseline";
import IEBaselineEdit from "@/pages/iebaseline/IEBaselineEdit";
import ModuleAdmin from "@/pages/iebaseline/ModuleAdmin";
import ModuleOverview from "@/pages/iebaseline/ModuleOverview";
import IPKConfig from "@/pages/ipk/IPKConfig";
import IPKDashboard from "@/pages/ipk/IPKDashboard";
import IPKHistory from "@/pages/ipk/IPKHistory";
import IPKHome from "@/pages/ipk/IPKHome";
import IPKMatrix from "@/pages/ipk/IPKMatrix";
import IPKResults from "@/pages/ipk/IPKResults";
import IPKSimulate from "@/pages/ipk/IPKSimulate";
import IPKWorkcells from "@/pages/ipk/IPKWorkcells";
import KioskMode from "@/pages/KioskMode";
import LBRAssemblyDetail from "@/pages/lbr/LBRAssemblyDetail";
import LBRGlobalConfig from "@/pages/lbr/LBRGlobalConfig";
import LBRHome from "@/pages/lbr/LBRHome";
import LBRPlaybookDetail from "@/pages/lbr/LBRPlaybookDetail";
import LBRWorkcellConfig from "@/pages/lbr/LBRWorkcellConfig";
import LBRWorkcellProfile from "@/pages/lbr/LBRWorkcellProfile";
import Login from "@/pages/Login";
import NotFound from "@/pages/NotFound";
import OLE4QReport from "@/pages/ole/OLE4QReport";
import OlePlantReport from "@/pages/ole/OlePlantReport";
import OLESmh from "@/pages/ole/OLESmh";
import OleWorkcellReport from "@/pages/ole/OleWorkcellReport";
import OleWowAnalysis from "@/pages/ole/OleWowAnalysis";
import Plants from "@/pages/Plants";
import PPQT2AWorkcell from "@/pages/ppqt/dash2/PPQT2AWorkcell";
import PPQT2AWorkcells from "@/pages/ppqt/dash2/PPQT2AWorkcells";
import PPQTAssemblyDetail from "@/pages/ppqt/PPQTAssemblyDetail";
import PPQTConfig from "@/pages/ppqt/PPQTConfig";
import PPQTHome from "@/pages/ppqt/PPQTHome";
import PPQTProcessDetail from "@/pages/ppqt/PPQTProcessDetail";
import PPQTSubWorkcenterProfile from "@/pages/ppqt/PPQTSubWorkcenterProfile";
import PPQTWorkcellProfile from "@/pages/ppqt/PPQTWorkcellProfile";
import PPQTWorkcells from "@/pages/ppqt/PPQTWorkcells";
import Reports from "@/pages/Reports";
import ReportA from "@/pages/ReportA";
import Settings from "@/pages/Settings";
import VaNvaHome from "@/pages/vanva/VaNvaHome";
import VaNvaUpload from "@/pages/vanva/VaNvaUpload";
import VaNvaWorkcellDetail from "@/pages/vanva/VaNvaWorkcellDetail";
import VaNvaWorkcells from "@/pages/vanva/VaNvaWorkcells";
import WorkcellsTable from "@/pages/WorkcellsTable";
import WorkcellView from "@/pages/WorkcellView";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useParams } from "react-router-dom";
import MapPage from "./pages/MapPage";
import DowntimeManagement from "./pages/ole/DowntimeManagement";

/** The retired cycle-time URLs, kept alive as redirects.
 *
 *  `/cycle-time/wc/:customer` and `/cycle-time/models/:customer` both now mean
 *  `/cycle-time/:customer`. `replace` so the dead URL does not sit in history —
 *  otherwise Back lands on the redirect and bounces the user forward again.
 *  The query string rides along: RegistrySearch and PlantRunnerDashboard both
 *  deep-link with `?tab=`. */
function RedirectWorkcell() {
  const { customer = '' } = useParams();
  const { search } = useLocation();
  return <Navigate to={`/cycle-time/${encodeURIComponent(customer)}${search}`} replace />;
}

function RedirectModel() {
  const { customer = '', assembly = '' } = useParams();
  return <Navigate to={`/cycle-time/${encodeURIComponent(customer)}/${encodeURIComponent(assembly)}`} replace />;
}

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
              <Route path="/pulse/report-a" element={<ReportA />} />
              <Route path="/pulse/documents" element={<Documents />} />
            </>}

            {includesApp('fsms') && <>
              <Route path="/fsms" element={<Navigate to="/fsms/dashboard" replace />} />
              <Route path="/fsms/dashboard" element={<FsmsDashboard />} />
              <Route path="/fsms/submissions" element={<FsmsSubmissions />} />
              <Route path="/fsms/plants" element={<FsmsPlants />} />
              <Route path="/fsms/floor-map" element={<FloorMap />} />
              <Route path="/fsms/editor" element={<LayoutEditor />} />
              <Route path="/fsms/bays" element={<BayManagement />} />
            </>}

            {includesApp('cycle-time') && <>
              {/* /cycle-time/home is the landing page. */}
              <Route path="/cycle-time" element={<Navigate to="/cycle-time/home" replace />} />
              <Route path="/cycle-time/workcells" element={<CycleTimeWorkcells />} />

              {/* The OLD workcell page is gone. Not merely unlinked — routed to
                  a redirect, because unlinking leaves it alive at a URL that is
                  still in browser history, in bookmarks and in Teams messages,
                  and someone reading yesterday's numbers off a page nobody
                  maintains is worse than a 404. Same for the interim
                  /models/:customer shape. */}
              <Route path="/cycle-time/wc/:customer" element={<RedirectWorkcell />} />
              <Route path="/cycle-time/wc/:customer/:assembly" element={<RedirectModel />} />
              <Route path="/cycle-time/models/:customer" element={<RedirectWorkcell />} />
              <Route path="/cycle-time/completion" element={<DemandCompletionReport />} />
              <Route path="/cycle-time/4q" element={<CycleTime4QReport />} />
              <Route path="/cycle-time/ask" element={<CycleTimeChat />} />
              <Route path="/cycle-time/incompletion" element={<IncompletionReport />} />
              <Route path="/cycle-time/incompletion/:customer" element={<IncompletionReportDetail />} />
              <Route path="/cycle-time/plant-runners" element={<PlantRunnerDashboard />} />
              <Route path="/cycle-time/coverage" element={<WorkcellCoverage />} />
              {/* TEMP: candidate landing page. One of these two goes. */}
              <Route path="/cycle-time/home" element={<CycleTimeHomeNew />} />
              {/* /home2 was the candidate URL and is in people's history and
                  bookmarks. Redirect rather than 404 them. */}
              <Route path="/cycle-time/home2" element={<Navigate to="/cycle-time/home" replace />} />
              <Route path="/cycle-time/registry" element={<ProcessRegistry />} />
              <Route path="/cycle-time/processes" element={<ProcessesGlobal />} />

              {/* Last, and dynamic. Every static route above out-ranks these in
                  React Router's scoring, so a workcell can never shadow /home.
                  A workcell literally named "home" would — nothing in
                  CT_CUSTOMERS is, and the redirect above keeps old links alive. */}
              <Route path="/cycle-time/:customer" element={<CycleTimeWorkcellModels />} />
              <Route path="/cycle-time/:customer/:assembly" element={<CycleTimeModel />} />
            </>}

            {includesApp('ppqt') && <>
              <Route path="/ppqt/" element={<PPQT2AWorkcells />} />
              <Route path="/ppqt/workcell" element={<PPQTWorkcells />} />
              <Route path="/ppqt/workcell/:workcell" element={<PPQTWorkcellProfile />} />
              <Route path="/ppqt/workcell/:workcell/swc/:subWorkcenter" element={<PPQTSubWorkcenterProfile />} />
              <Route path="/ppqt/workcell/:workcell/swc/:subWorkcenter/proc/:process" element={<PPQTProcessDetail />} />
              <Route path="/ppqt/workcell/:workcell/swc/:subWorkcenter/proc/:process/asm/:assembly" element={<PPQTAssemblyDetail />} />
              <Route path="/ppqt/config" element={<PPQTConfig />} />
              {/* Main dashboard — league table → tabbed workcell page (DASH / Report / Triage) */}
              <Route path="/ppqt/dash2" element={<PPQTHome />} />
              <Route path="/ppqt/dash2a/:workcell" element={<PPQT2AWorkcell />} />
            </>}

            {includesApp('ipk') && <>
              <Route path="/ipk" element={<IPKHome />} />
              <Route path="/ipk/workcells" element={<IPKWorkcells />} />
              <Route path="/ipk/:workcell" element={<IPKDashboard />} />
              <Route path="/ipk/:workcell/simulate" element={<IPKSimulate />} />
              <Route path="/ipk/:workcell/results/:runId" element={<IPKResults />} />
              <Route path="/ipk/:workcell/history" element={<IPKHistory />} />
              <Route path="/ipk/:workcell/matrix" element={<IPKMatrix />} />
              <Route path="/ipk/:workcell/config" element={<IPKConfig />} />
            </>}

            {includesApp('lbr') && <>
              <Route path="/lbr" element={<LBRHome />} />
              <Route path="/lbr/config" element={<LBRGlobalConfig />} />
              <Route path="/lbr/:workcell" element={<LBRWorkcellProfile />} />
              <Route path="/lbr/:workcell/config" element={<LBRWorkcellConfig />} />
              <Route path="/lbr/:workcell/:assembly" element={<LBRAssemblyDetail />} />
              <Route path="/lbr/:workcell/:assembly/:playbook" element={<LBRPlaybookDetail />} />
            </>}

            {includesApp('va-nva') && <>
              <Route path="/va-nva" element={<VaNvaHome />} />
              <Route path="/va-nva/workcells" element={<VaNvaWorkcells />} />
              <Route path="/va-nva/wc/:id" element={<VaNvaWorkcellDetail />} />
              <Route path="/va-nva/upload" element={<VaNvaUpload />} />
            </>}

            {includesApp('ebuild') && <>
              <Route path="/ebuild" element={<EBuildPlan />} />
            </>}

            {includesApp('machine-mover') && <>
              <Route path="/machine-mover" element={<MachineMoverHome />} />
              <Route path="/machine-mover/approvals" element={<MachineMoverApprovals />} />
              <Route path="/machine-mover/reports" element={<MachineMoverReports />} />
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
