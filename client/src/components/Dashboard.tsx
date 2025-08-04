import { Card } from "@/components/ui/card";
import { TrendingUp, Users, Building2, DollarSign, Calendar, Target } from "lucide-react";

export function Dashboard() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-2">Welcome back! Here's what's happening with your business today.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6 bg-gradient-card shadow-card hover:shadow-elevated transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Revenue</p>
              <p className="text-2xl font-bold text-foreground">$124,563</p>
              <p className="text-sm text-success flex items-center gap-1 mt-1">
                <TrendingUp size={14} />
                +12.5% from last month
              </p>
            </div>
            <div className="w-12 h-12 bg-gradient-primary rounded-lg flex items-center justify-center">
              <DollarSign className="text-white" size={24} />
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-gradient-card shadow-card hover:shadow-elevated transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Contacts</p>
              <p className="text-2xl font-bold text-foreground">2,847</p>
              <p className="text-sm text-success flex items-center gap-1 mt-1">
                <TrendingUp size={14} />
                +8.2% from last month
              </p>
            </div>
            <div className="w-12 h-12 bg-gradient-success rounded-lg flex items-center justify-center">
              <Users className="text-white" size={24} />
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-gradient-card shadow-card hover:shadow-elevated transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Active Deals</p>
              <p className="text-2xl font-bold text-foreground">156</p>
              <p className="text-sm text-warning flex items-center gap-1 mt-1">
                <Target size={14} />
                23 closing this week
              </p>
            </div>
            <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
              <Target className="text-primary-foreground" size={24} />
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-gradient-card shadow-card hover:shadow-elevated transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Companies</p>
              <p className="text-2xl font-bold text-foreground">847</p>
              <p className="text-sm text-success flex items-center gap-1 mt-1">
                <Building2 size={14} />
                +15 new this month
              </p>
            </div>
            <div className="w-12 h-12 bg-accent rounded-lg flex items-center justify-center">
              <Building2 className="text-accent-foreground" size={24} />
            </div>
          </div>
        </Card>
      </div>

      {/* Recent Activity & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <Card className="p-6 bg-gradient-card shadow-card">
          <h3 className="text-lg font-semibold text-foreground mb-4">Recent Activity</h3>
          <div className="space-y-4">
            {[
              { action: "New contact added", contact: "Sarah Johnson", time: "2 minutes ago", type: "contact" },
              { action: "Deal closed", contact: "TechCorp Inc.", time: "1 hour ago", type: "deal" },
              { action: "Meeting scheduled", contact: "John Smith", time: "3 hours ago", type: "meeting" },
              { action: "Email sent", contact: "Marketing Team", time: "5 hours ago", type: "email" },
            ].map((activity, index) => (
              <div key={index} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  activity.type === 'contact' ? 'bg-success/20 text-success' :
                  activity.type === 'deal' ? 'bg-primary/20 text-primary' :
                  activity.type === 'meeting' ? 'bg-warning/20 text-warning' :
                  'bg-accent/20 text-accent-foreground'
                }`}>
                  {activity.type === 'contact' && <Users size={16} />}
                  {activity.type === 'deal' && <DollarSign size={16} />}
                  {activity.type === 'meeting' && <Calendar size={16} />}
                  {activity.type === 'email' && <TrendingUp size={16} />}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{activity.action}</p>
                  <p className="text-xs text-muted-foreground">{activity.contact} • {activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Quick Actions */}
        <Card className="p-6 bg-gradient-card shadow-card">
          <h3 className="text-lg font-semibold text-foreground mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "Add Contact", icon: Users, color: "success" },
              { label: "New Deal", icon: Target, color: "primary" },
              { label: "Schedule Meeting", icon: Calendar, color: "warning" },
              { label: "Add Company", icon: Building2, color: "accent" },
            ].map((action, index) => {
              const Icon = action.icon;
              return (
                <button
                  key={index}
                  className={`p-4 rounded-lg border-2 border-dashed transition-all duration-200 hover:scale-105 ${
                    action.color === 'success' ? 'border-success/30 hover:border-success hover:bg-success/5' :
                    action.color === 'primary' ? 'border-primary/30 hover:border-primary hover:bg-primary/5' :
                    action.color === 'warning' ? 'border-warning/30 hover:border-warning hover:bg-warning/5' :
                    'border-accent/30 hover:border-accent hover:bg-accent/5'
                  }`}
                >
                  <Icon size={24} className={`mx-auto mb-2 ${
                    action.color === 'success' ? 'text-success' :
                    action.color === 'primary' ? 'text-primary' :
                    action.color === 'warning' ? 'text-warning' :
                    'text-accent-foreground'
                  }`} />
                  <p className="text-sm font-medium text-foreground">{action.label}</p>
                </button>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}