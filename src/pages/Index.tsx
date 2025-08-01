import { useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Dashboard } from "@/components/Dashboard";
import { Contacts } from "@/components/Contacts";
import { AIChat } from "@/components/AIChat";

const Index = () => {
  const [activeSection, setActiveSection] = useState("dashboard");

  const renderContent = () => {
    switch (activeSection) {
      case "dashboard":
        return <Dashboard />;
      case "contacts":
        return <Contacts />;
      case "companies":
        return <div className="text-center py-20"><h2 className="text-2xl text-muted-foreground">Companies section coming soon</h2></div>;
      case "deals":
        return <div className="text-center py-20"><h2 className="text-2xl text-muted-foreground">Deals section coming soon</h2></div>;
      case "analytics":
        return <div className="text-center py-20"><h2 className="text-2xl text-muted-foreground">Analytics section coming soon</h2></div>;
      case "calendar":
        return <div className="text-center py-20"><h2 className="text-2xl text-muted-foreground">Calendar section coming soon</h2></div>;
      case "email":
        return <div className="text-center py-20"><h2 className="text-2xl text-muted-foreground">Email section coming soon</h2></div>;
      case "calls":
        return <div className="text-center py-20"><h2 className="text-2xl text-muted-foreground">Calls section coming soon</h2></div>;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <div className="w-64 flex-shrink-0">
        <Sidebar activeSection={activeSection} onSectionChange={setActiveSection} />
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8 overflow-auto">
        {renderContent()}
      </div>

      {/* AI Chat Bot */}
      <AIChat />
    </div>
  );
};

export default Index;
