import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useUser } from './UserContext';

export interface SelectedContact {
  id: string; // phone number acting as ID locally
  name: string; 
}

interface SelectionContextType {
  selectedContactIds: string[];
  selectedContacts: SelectedContact[];
  isSelectionMode: boolean;
  toggleSelection: (contact: SelectedContact, forceSelect?: boolean) => void;
  clearSelection: () => void;
}

const SelectionContext = createContext<SelectionContextType | undefined>(undefined);

export function SelectionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<SelectedContact[]>([]);

  useEffect(() => {
    let isMounted = true;
    
    const initContacts = async () => {
      let currentUserId = user?.id;
      if (!currentUserId && supabase.auth) {
        try {
          const { data } = await supabase.auth.getUser();
          currentUserId = data?.user?.id;
        } catch (e) {}
      }

      if (currentUserId) {
        try {
          const { data, error } = await supabase.from('selected_contacts')
            .select(`
              contact_id,
              profiles!inner (
                phone,
                name
              )
            `)
            .eq('user_id', currentUserId);
          
          if (isMounted && !error && data) {
            const loadedIds: string[] = [];
            const loadedContacts: SelectedContact[] = [];
            data.forEach((c: any) => {
              const fetchedPhone = c.profiles?.phone || c.contact_id;
              const fetchedName = c.profiles?.name || 'Unknown';
              loadedIds.push(fetchedPhone);
              loadedContacts.push({ id: fetchedPhone, name: fetchedName });
            });
            setSelectedContactIds(loadedIds);
            setSelectedContacts(loadedContacts);
          }
        } catch (err) {
          console.error('Initial sync error', err);
        }
      }
    };

    initContacts();

    return () => { isMounted = false; };
  }, [user]);

  const toggleSelection = async (contact: SelectedContact, forceSelect?: boolean) => {
    let currentUserId = user?.id;
    if (!currentUserId && supabase.auth) {
        try {
          const { data } = await supabase.auth.getUser();
          currentUserId = data?.user?.id;
        } catch (e) {}
    }
    
    // Check if selecting or deselecting
    const isCurrentlySelected = selectedContactIds.includes(contact.id);
    const willBeSelected = forceSelect !== undefined ? forceSelect : !isCurrentlySelected;

    if (willBeSelected === isCurrentlySelected) return; // No change

    // Optimistically update UI
    if (willBeSelected) {
      setSelectedContactIds(prev => [...prev, contact.id]);
      setSelectedContacts(prev => [...prev, contact]);
    } else {
      setSelectedContactIds(prev => prev.filter(id => id !== contact.id));
      setSelectedContacts(prev => prev.filter(c => c.id !== contact.id));
    }

    if (!currentUserId) return;

    try {
      // Resolve UUID out of phone number from profiles table
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('phone', contact.id)
        .maybeSingle();

      const resolvedContactId = profile?.id;

      if (!resolvedContactId) {
         console.warn("Contact has no matching profile in Supabase to sync selection.");
         return;
      }

      if (willBeSelected) {
        const { error } = await supabase.from('selected_contacts').insert({
          user_id: currentUserId,
          contact_id: resolvedContactId
        });
        if (error) console.error("Error inserting selected contact", error);
      } else {
        const { error } = await supabase.from('selected_contacts')
          .delete()
          .match({ user_id: currentUserId, contact_id: resolvedContactId });
        if (error) console.error("Error deleting selected contact", error);
      }
    } catch (err) {
      console.error("Selection sync failed:", err);
    }
  };

  const clearSelection = async () => {
    setSelectedContactIds([]);
    setSelectedContacts([]);
    
    let currentUserId = user?.id;
    if (currentUserId) {
      try {
        await supabase.from('selected_contacts').delete().match({ user_id: currentUserId });
      } catch (err) {
        console.error("Error clearing selection", err);
      }
    }
  };

  const isSelectionMode = selectedContactIds.length > 0;

  return (
    <SelectionContext.Provider value={{ selectedContactIds, selectedContacts, isSelectionMode, toggleSelection, clearSelection }}>
      {children}
    </SelectionContext.Provider>
  );
}

export function useSelection() {
  const context = useContext(SelectionContext);
  if (context === undefined) {
    throw new Error('useSelection must be used within a SelectionProvider');
  }
  return context;
}
