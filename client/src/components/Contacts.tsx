import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus, Mail, Phone, MapPin, Edit, Trash2 } from "lucide-react";

const sampleContacts = [
  {
    id: 1,
    name: "Sarah Johnson",
    email: "sarah@example.com",
    phone: "+1 234 567 8901",
    company: "TechCorp Inc.",
    position: "Marketing Manager",
    location: "New York, NY",
    avatar: "SJ",
    status: "active"
  },
  {
    id: 2,
    name: "Michael Chen",
    email: "michael@example.com",
    phone: "+1 234 567 8902",
    company: "StartupXYZ",
    position: "CEO",
    location: "San Francisco, CA",
    avatar: "MC",
    status: "lead"
  },
  {
    id: 3,
    name: "Emily Rodriguez",
    email: "emily@example.com",
    phone: "+1 234 567 8903",
    company: "DesignStudio",
    position: "Creative Director",
    location: "Los Angeles, CA",
    avatar: "ER",
    status: "active"
  },
  {
    id: 4,
    name: "David Thompson",
    email: "david@example.com",
    phone: "+1 234 567 8904",
    company: "Enterprise Corp",
    position: "Sales Director",
    location: "Chicago, IL",
    avatar: "DT",
    status: "prospect"
  }
];

export function Contacts() {
  const [searchTerm, setSearchTerm] = useState("");
  const [contacts] = useState(sampleContacts);

  const filteredContacts = contacts.filter(contact =>
    contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.company.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-success/20 text-success';
      case 'lead': return 'bg-primary/20 text-primary';
      case 'prospect': return 'bg-warning/20 text-warning';
      default: return 'bg-muted/20 text-muted-foreground';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Contacts</h1>
          <p className="text-muted-foreground mt-2">Manage your customer relationships</p>
        </div>
        <Button className="bg-gradient-primary hover:opacity-90 text-white shadow-floating">
          <Plus size={20} className="mr-2" />
          Add Contact
        </Button>
      </div>

      {/* Search & Filters */}
      <Card className="p-6 bg-gradient-card shadow-card">
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={20} />
            <Input
              placeholder="Search contacts by name or company..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button variant="outline">Filter</Button>
          <Button variant="outline">Export</Button>
        </div>
      </Card>

      {/* Contacts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredContacts.map((contact) => (
          <Card key={contact.id} className="p-6 bg-gradient-card shadow-card hover:shadow-elevated transition-all duration-300 animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-primary rounded-full flex items-center justify-center text-white font-semibold">
                  {contact.avatar}
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">{contact.name}</h3>
                  <p className="text-sm text-muted-foreground">{contact.position}</p>
                </div>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(contact.status)}`}>
                {contact.status}
              </span>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail size={16} />
                <span>{contact.email}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone size={16} />
                <span>{contact.phone}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin size={16} />
                <span>{contact.location}</span>
              </div>
            </div>

            <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/50">
              <p className="text-sm font-medium text-foreground">{contact.company}</p>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" className="p-2">
                  <Edit size={16} />
                </Button>
                <Button size="sm" variant="outline" className="p-2 text-destructive hover:text-destructive">
                  <Trash2 size={16} />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4 bg-gradient-card shadow-card text-center">
          <h4 className="text-2xl font-bold text-foreground">{contacts.length}</h4>
          <p className="text-sm text-muted-foreground">Total Contacts</p>
        </Card>
        <Card className="p-4 bg-gradient-card shadow-card text-center">
          <h4 className="text-2xl font-bold text-success">{contacts.filter(c => c.status === 'active').length}</h4>
          <p className="text-sm text-muted-foreground">Active</p>
        </Card>
        <Card className="p-4 bg-gradient-card shadow-card text-center">
          <h4 className="text-2xl font-bold text-primary">{contacts.filter(c => c.status === 'lead').length}</h4>
          <p className="text-sm text-muted-foreground">Leads</p>
        </Card>
        <Card className="p-4 bg-gradient-card shadow-card text-center">
          <h4 className="text-2xl font-bold text-warning">{contacts.filter(c => c.status === 'prospect').length}</h4>
          <p className="text-sm text-muted-foreground">Prospects</p>
        </Card>
      </div>
    </div>
  );
}