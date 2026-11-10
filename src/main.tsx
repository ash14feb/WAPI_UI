import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { AccountProvider } from "./accounts/AccountContext";
import { App } from "./App";
import { ToastHost } from "./components/Toast";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <AccountProvider>
          <App />
          <ToastHost />
        </AccountProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
