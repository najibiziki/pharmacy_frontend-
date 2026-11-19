import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Home from "../pages/public/Home";
import Login from "../pages/auth/Login";
import Register from "../pages/auth/Register";
import ForgotPassword from "../pages/auth/ForgotPassword";

import RoleRoute from "./RoleRoute";

const ClaimPharmacy = lazy(() => import("../pages/pharmacy/ClaimPharmacy"));
const PharmacyDashboard = lazy(() => import("../pages/pharmacy/Dashboard"));
const ClaimsAdmin = lazy(() => import("../pages/admin/ClaimsAdmin"));
const AdminPharmacies = lazy(() => import("../pages/admin/Pharmacies"));
const AdminPharmacyDetails = lazy(
  () => import("../pages/admin/PharmacyDetails"),
);
const AdminPayments = lazy(() => import("../pages/admin/Payments"));

function AppRoutes() {
  return (
    <BrowserRouter>
      <Suspense
        fallback={
          <div style={{ padding: 40, textAlign: "center" }}>Loading…</div>
        }
      >
        <Routes>
          <Route path="/" element={<Home />} />

          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />

          <Route
            path="/claim-pharmacy/:pharmacyId"
            element={<ClaimPharmacy />}
          />

          <Route element={<RoleRoute roles={["pharmacist", "admin"]} />}>
            <Route path="/pharmacy/dashboard" element={<PharmacyDashboard />} />
          </Route>

          <Route element={<RoleRoute roles={["admin"]} />}>
            <Route path="/admin/claims" element={<ClaimsAdmin />} />
            <Route path="/admin/pharmacies" element={<AdminPharmacies />} />
            <Route
              path="/admin/pharmacies/:id"
              element={<AdminPharmacyDetails />}
            />
            <Route path="/admin/payments" element={<AdminPayments />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default AppRoutes;
