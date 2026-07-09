"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { subscribeConversations, getContacts, addContact, removeContact, createDirectConversation, deleteConversation } from "@/lib/firestore";
import { type Conversation, type Contact, getPlayerById, RALLY_USER } from "@/lib/mock-data";
import ConversationCard from "@/components/conversation-card";
import { MessageSquare, Users, Plus, UserPlus, Trash2, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export default function MessagesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [convos, setConvos] = useState<Conversation[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filter, setFilter] = useState<"all" | "direct" | "group">("all");
  const [addContactEmail, setAddContactEmail] = useState("");
  const [addContactOpen, setAddContactOpen] = useState(false);
  const [addContactError, setAddContactError] = useState("");

  // Live subscription so unread badges and last messages update in real time.
  useEffect(() => {
    if (!user) return;
    const unsub = subscribeConversations(user.id, setConvos);
    getContacts(user.id).then(setContacts);
    return unsub;
  }, [user]);

  const filtered = convos.filter((c) => {
    if (filter === "all") return true;
    if (filter === "direct") return c.type === "direct" || (!c.type && !c.participants?.includes("rally") && !c.participants?.includes("ai"));
    return c.type === "group" || c.participants?.includes("rally") || c.participants?.includes("ai");
  });

  const handleDelete = async (convId: string) => {
    await deleteConversation(convId);
    setConvos((prev) => prev.filter((c) => c.id !== convId));
  };

  const handleStartChat = async (contactId: string, contactName: string) => {
    if (!user) return;
    const convId = await createDirectConversation(user.id, contactId, user.firstName || user.name, contactName);
    router.push(`/dashboard/messages/${convId}/`);
  };

  const handleAddContact = async () => {
    if (!user || !addContactEmail.trim()) return;
    setAddContactError("");
    // Look up user by email in known players (mock) or Firestore
    const { getPlayers } = await import("@/lib/firestore");
    const allPlayers = await getPlayers();
    const found = allPlayers.find(
      (p) => p.email?.toLowerCase() === addContactEmail.trim().toLowerCase() && p.id !== user.id && p.id !== RALLY_USER.id
    );
    if (!found) {
      setAddContactError("No user found with that email");
      return;
    }
    if (contacts.find((c) => c.id === found.id)) {
      setAddContactError("Already in your contacts");
      return;
    }
    const contact: Contact = {
      id: found.id,
      name: found.firstName ? `${found.firstName} ${found.lastName || ""}`.trim() : found.name,
      email: found.email,
      avatar: found.avatar,
      addedAt: new Date().toISOString(),
    };
    await addContact(user.id, contact);
    setContacts((prev) => [...prev, contact]);
    setAddContactEmail("");
    setAddContactOpen(false);
  };

  const handleRemoveContact = async (contactId: string) => {
    if (!user) return;
    await removeContact(user.id, contactId);
    setContacts((prev) => prev.filter((c) => c.id !== contactId));
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="p-4 border-b">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <MessageSquare className="h-6 w-6" /> Messages
        </h1>
      </div>

      <Tabs defaultValue="chats" className="w-full">
        <TabsList className="w-full grid grid-cols-2 mx-0 rounded-none border-b">
          <TabsTrigger value="chats" className="gap-1.5"><MessageCircle className="h-4 w-4" />Chats</TabsTrigger>
          <TabsTrigger value="contacts" className="gap-1.5"><Users className="h-4 w-4" />Contacts</TabsTrigger>
        </TabsList>

        {/* === CHATS TAB === */}
        <TabsContent value="chats" className="mt-0">
          {/* Filter pills */}
          <div className="flex gap-2 px-4 py-2 border-b">
            {([["all", "All"], ["direct", "Direct"], ["group", "Groups"]] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                aria-pressed={filter === key}
                onClick={() => setFilter(key)}
                className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <Badge variant={filter === key ? "default" : "outline"} className="cursor-pointer">
                  {label}
                </Badge>
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No conversations yet</p>
              <p className="text-sm mt-1">Accept a match or start a chat from your contacts!</p>
            </div>
          ) : (
            filtered.map((c) => (
              <ConversationCard
                key={c.id}
                conversation={c}
                currentUserId={user?.id || ""}
                onDelete={() => handleDelete(c.id)}
              />
            ))
          )}
        </TabsContent>

        {/* === CONTACTS TAB === */}
        <TabsContent value="contacts" className="mt-0">
          <div className="p-4 border-b flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{contacts.length} contact{contacts.length !== 1 ? "s" : ""}</p>
            <Dialog open={addContactOpen} onOpenChange={setAddContactOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="gap-1.5"><UserPlus className="h-4 w-4" />Add Contact</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Contact by Email</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 pt-2">
                  <Input
                    placeholder="Enter email address..."
                    value={addContactEmail}
                    onChange={(e) => setAddContactEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddContact()}
                  />
                  {addContactError && <p className="text-sm text-red-500">{addContactError}</p>}
                  <Button onClick={handleAddContact} className="w-full">Add Contact</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          {contacts.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No contacts yet</p>
              <p className="text-sm mt-1">Add contacts by email or they&apos;ll be added automatically from matches</p>
            </div>
          ) : (
            contacts.map((contact) => (
              <div key={contact.id} className="flex items-center gap-3 p-4 border-b hover:bg-muted/50 transition-colors">
                <div className="w-10 h-10 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-white font-bold flex-shrink-0">
                  {contact.avatar || contact.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{contact.name}</p>
                  {contact.email && <p className="text-xs text-muted-foreground truncate">{contact.email}</p>}
                </div>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0"
                    onClick={() => handleStartChat(contact.id, contact.name)}
                  >
                    <MessageCircle className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-red-500 hover:text-red-600"
                    onClick={() => handleRemoveContact(contact.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
