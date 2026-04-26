import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { useEffect } from 'react'
import { useAuthStore } from '@/stores/auth-store'
import { seedDemoData } from '@/services/seed-data'
import { startBackupScheduler } from '@/services/auto-backup'
import { AppShell } from '@/components/layout/AppShell'
import { Login } from '@/pages/auth/Login'
import { Dashboard } from '@/pages/Dashboard'
import { RecipeList } from '@/pages/recipes/RecipeList'
import { RecipeBuilder } from '@/pages/recipes/RecipeBuilder'
import { CostingCalculator } from '@/pages/costing/CostingCalculator'
import { CostingList } from '@/pages/costing/CostingList'
import { ChemicalMaster } from '@/pages/chemicals/ChemicalMaster'
import { ProcessLibrary } from '@/pages/processes/ProcessLibrary'
import { Analytics } from '@/pages/analytics/Analytics'
import { DataAnalytics } from '@/pages/analytics/DataAnalytics'
import { Reports } from '@/pages/reports/Reports'
import { Scheduling } from '@/pages/scheduling/Scheduling'
import { ShopFloor } from '@/pages/shopfloor/ShopFloor'
import { RecipeCompare } from '@/pages/tools/RecipeCompare'
import { EIMScore } from '@/pages/tools/EIMScore'
import { Chat } from '@/pages/communication/Chat'
import { Mail } from '@/pages/communication/Mail'
import { Notifications } from '@/pages/communication/Notifications'
import { Settings } from '@/pages/settings/Settings'
import { WashRequisition } from '@/pages/requisitions/WashRequisition'
import { AdminPanel } from '@/pages/admin/AdminPanel'
import { Profile } from '@/pages/profile/Profile'
import { Help } from '@/pages/help/Help'
import { Manual } from '@/pages/help/Manual'
import { BarcodeScanner } from '@/pages/scanner/BarcodeScanner'
import { RecipeScanner } from '@/pages/scanner/RecipeScanner'
import { RecipeAssistant } from '@/pages/assistant/RecipeAssistant'
import { ApprovalWorkflow } from '@/pages/approval/ApprovalWorkflow'
import { BatchCalculator } from '@/pages/tools/BatchCalculator'
import { ChemicalStockAlert } from '@/pages/tools/ChemicalStockAlert'
import { RecipeCloner } from '@/pages/tools/RecipeCloner'
import { CostEstimator } from '@/pages/tools/CostEstimator'
import { RecipeTemplateManager } from '@/pages/templates/RecipeTemplateManager'
import { VersionHistory } from '@/pages/admin/VersionHistory'

const queryClient = new QueryClient()

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />
}

function App() {
  // Auto-seed demo data on first launch (only if DB is empty)
  useEffect(() => {
    seedDemoData(false).then(result => {
      if (result.success) {
        console.log('[Seed]', result.message)
      } else {
        console.log('[Seed] Skipped:', result.message)
      }
    }).catch(err => {
      console.error('[Seed] Error:', err)
    })

    // Start auto-backup scheduler if enabled
    startBackupScheduler()
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppShell>
                  <Dashboard />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/recipes"
            element={
              <ProtectedRoute>
                <AppShell>
                  <RecipeList />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/recipes/builder"
            element={
              <ProtectedRoute>
                <AppShell>
                  <RecipeBuilder />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/costing"
            element={
              <ProtectedRoute>
                <AppShell>
                  <CostingCalculator />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/chemicals"
            element={
              <ProtectedRoute>
                <AppShell>
                  <ChemicalMaster />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/processes"
            element={
              <ProtectedRoute>
                <AppShell>
                  <ProcessLibrary />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/analytics"
            element={
              <ProtectedRoute>
                <AppShell>
                  <Analytics />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports"
            element={
              <ProtectedRoute>
                <AppShell>
                  <Reports />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/scheduling"
            element={
              <ProtectedRoute>
                <AppShell>
                  <Scheduling />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/shop-floor"
            element={
              <ProtectedRoute>
                <AppShell>
                  <ShopFloor />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/compare"
            element={
              <ProtectedRoute>
                <AppShell>
                  <RecipeCompare />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/chat"
            element={
              <ProtectedRoute>
                <AppShell>
                  <Chat />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <AppShell>
                  <Settings />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/costing-list"
            element={
              <ProtectedRoute>
                <AppShell>
                  <CostingList />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/data-analytics"
            element={
              <ProtectedRoute>
                <AppShell>
                  <DataAnalytics />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/eim-score"
            element={
              <ProtectedRoute>
                <AppShell>
                  <EIMScore />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/wash-requisition"
            element={
              <ProtectedRoute>
                <AppShell>
                  <WashRequisition />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AppShell>
                  <AdminPanel />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/mail"
            element={
              <ProtectedRoute>
                <AppShell>
                  <Mail />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/notifications"
            element={
              <ProtectedRoute>
                <AppShell>
                  <Notifications />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <AppShell>
                  <Profile />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/help"
            element={
              <ProtectedRoute>
                <AppShell>
                  <Help />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/manual"
            element={
              <ProtectedRoute>
                <AppShell>
                  <Manual />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/scanner"
            element={
              <ProtectedRoute>
                <AppShell>
                  <BarcodeScanner />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/recipe-scanner"
            element={
              <ProtectedRoute>
                <AppShell>
                  <RecipeScanner />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/ai-assistant"
            element={
              <ProtectedRoute>
                <AppShell>
                  <RecipeAssistant />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/approval"
            element={
              <ProtectedRoute>
                <AppShell>
                  <ApprovalWorkflow />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/batch-calculator"
            element={
              <ProtectedRoute>
                <AppShell>
                  <BatchCalculator />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/stock-alerts"
            element={
              <ProtectedRoute>
                <AppShell>
                  <ChemicalStockAlert />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/recipe-cloner"
            element={
              <ProtectedRoute>
                <AppShell>
                  <RecipeCloner />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/cost-estimator"
            element={
              <ProtectedRoute>
                <AppShell>
                  <CostEstimator />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/templates"
            element={
              <ProtectedRoute>
                <AppShell>
                  <RecipeTemplateManager />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/version-history"
            element={
              <ProtectedRoute>
                <AppShell>
                  <VersionHistory />
                </AppShell>
              </ProtectedRoute>
            }
          />
        </Routes>
        <Toaster richColors position="top-right" />
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
