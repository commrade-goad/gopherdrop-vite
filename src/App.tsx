import * as React from "react";
import { Dashboard } from "@/components/dashboard";
import { Setting } from "@/components/setting";

export function App() {
  const [activePage, setActivePage] = React.useState(() => {
    return localStorage.getItem("gopherdrop-active-page") || "dashboard";
  });

  const navigate = (page: string) => {
    setActivePage(page);
    localStorage.setItem("gopherdrop-active-page", page);
  };

  if (activePage === "settings") {
    return <Setting onNavigate={navigate} />;
  }

  // Default to dashboard
  return <Dashboard onNavigate={navigate} />;
}

export default App;
