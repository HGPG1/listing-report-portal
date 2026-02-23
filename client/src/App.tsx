import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import AdminLayout from "./components/AdminLayout";
import AdminListings from "./pages/AdminListings";
import AdminListingEdit from "./pages/AdminListingEdit";
import AdminNewListing from "./pages/AdminNewListing";
import AdminAnalytics from "./pages/AdminAnalytics";
import SellerReport from "./pages/SellerReport";
import AccessDenied from "./pages/AccessDenied";

function Router() {
  return (
    <Switch>
      {/* Public seller report — no auth required */}
      <Route path="/report/:token" component={SellerReport} />

      {/* Admin routes */}
      <Route path="/admin">
        <AdminLayout><AdminListings /></AdminLayout>
      </Route>
      <Route path="/admin/listings/new">
        <AdminLayout><AdminNewListing /></AdminLayout>
      </Route>
      <Route path="/admin/listings/:id">
        {(params: { id: string }) => (
          <AdminLayout><AdminListingEdit id={parseInt(params.id)} /></AdminLayout>
        )}
      </Route>
      <Route path="/admin/analytics">
        <AdminLayout><AdminAnalytics /></AdminLayout>
      </Route>

      <Route path="/access-denied" component={AccessDenied} />
      <Route path="/" component={Home} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
