import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import ToursPage from './ui/pages/ToursPage'
import ContactPage from './ui/pages/ContactPage'
import AuthPage from './ui/pages/AuthPage'
import AccountPage from './ui/pages/AccountPage'
import ReservationsAdminPage from './ui/pages/admin/ReservationsAdminPage'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />}>
          <Route index element={<ToursPage />} />
          <Route path="contact" element={<ContactPage />} />
          <Route path="auth" element={<AuthPage />} />
          <Route path="account" element={<AccountPage />} />
          <Route path="admin/reservation" element={<ReservationsAdminPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
