import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import Auctions from "./pages/Auctions";
import AuctionDetail from "./pages/AuctionDetails";
import Dashboard from "./pages/Dashboard";
import DashboardOverview from "./pages/dashboard/DashboardOverview";
import MyBids from "./pages/dashboard/MyBids";
import MyProducts from "./pages/dashboard/MyProducts";
import NewProduct from "./pages/dashboard/NewProduct";
import Payments from "./pages/dashboard/Payments";
import Bank from "./pages/dashboard/Bank";
import Profile from "./pages/dashboard/Profile";
import Admin from "./pages/Admin";
import ProductApprovals from "./pages/dashboard/admin/ProductApprovals";
import AuctionManagement from "./pages/dashboard/admin/AuctionManagement";
import PaymentOversight from "./pages/dashboard/admin/PaymentOversight";
import UserManagement from "./pages/dashboard/admin/UserManagement";
import NotFound from "./pages/NotFound";
import Bids from "./pages/Bids";
import Notifications from "./pages/Notifications";
import Payment from "./pages/Payment";
import CreateAuction from "./pages/dashboard/CreateAuction";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/auctions" element={<Auctions />} />
            <Route path="/auctions/:id" element={<AuctionDetail />} />
            <Route path="/bids" element={<Bids />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/payment/:auctionId" element={<Payment />} />

            <Route path="/dashboard" element={<Dashboard />}>
              <Route index element={<DashboardOverview />} />
              <Route path="bids" element={<MyBids />} />
              <Route path="products" element={<MyProducts />} />
              <Route path="products/new" element={<NewProduct />} />
              <Route path="auctions/new" element={<CreateAuction />} />
              {/* <Route path="registrations" element={<MyRegistrations />} /> */}
              <Route path="payments" element={<Payments />} />
              <Route path="payments/:paymentId" element={<Bank />} />
              <Route path="profile" element={<Profile />} />
            </Route>

            <Route path="/admin" element={<Admin />}>
              <Route index element={<ProductApprovals />} />
              <Route path="auctions" element={<AuctionManagement />} />
              <Route path="payments" element={<PaymentOversight />} />
              <Route path="users" element={<UserManagement />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;