import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useUser } from './UserContext';

export interface SelectedContact {
  id: string; // phone number acting as ID
  name: string; 
}

interface SelectionContextType {
  selectedContactIds: string[];
  isSelectionMode: boolean;
  toggleSelection: (contact: SelectedContact, forceSelect?: boolean) => void;
  clearSelection: () => void;
}

const SelectionContext = createContext<SelectionContextType | undefined>(undefined);

export function SelectionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  // To keep track of name as well if needed in future
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
            .select('*')
            .eq('user_id', currentUserId);
          
          if (isMounted && !error && data) {
            const loadedIds: string[] = [];
            const loadedContacts: SelectedContact[] = [];
            data.forEach((c: any) => {
              const fetchedPhone = c.contact_number || c.phone;
              const fetchedName = c.contact_name || c.name || 'Unknown';
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
    
    setSelectedContactIds(prev => {
      const isSelected = prev.includes(contact.id);
      const willBeSelected = forceSelect !== undefined ? forceSelect : !isSelected;
      
      let nextState = [...prev];
      if (willBeSelected) {
        if (!isSelected) nextState.push(contact.id);
        
        if (currentUserId) {
          supabase.from('selected_contacts').upsert({
            user_id: currentUserId,
            contact_number: contact.id, // using phone as id for data consistency
            contact_name: contact.name
          }).then(({error}) => { if (error) console.error("Error saving contact", error); });
        }
      } else {
        nextState = nextState.filter(id => id !== contact.id);
        
        if (currentUserId) {
          supabase.from('selected_contacts')
            .delete()
            .match({ user_id: currentUserId, contact_number: contact.id })
            .then(({error}) => { if (error) console.error("Error deleting contact", error); });
        }
      }
      return nextState;
    });

    setSelectedContacts(prev => {
      const isSelected = prev.some(c => c.id === contact.id);
      const willBeSelected = forceSelect !== undefined ? forceSelect : !isSelected;
      let nextState = [...prev];
      if (willBeSelected && !isSelected) {
        nextState.push(contact);
      } else if (!willBeSelected) {
        nextState = nextState.filter(c => c.id !== contact.id);
      }
      return nextState;
    });
  };

  const clearSelection = () => {
    setSelectedContactIds([]);
    setSelectedContacts([]);
    
    let currentUserId = user?.id;
    if (currentUserId) {
      // It might be better to just clear them matching user_id instead of individually
      supabase.from('selected_contacts').delete().match({ user_id: currentUserId })
      .then(({error}) => { if (error) console.error("Error clearing selection", error) });
    }
  };

  const isSelectionMode = selectedContactIds.length > 0;

  return (
    <SelectionContext.Provider value={{ selectedContactIds, isSelectionMode, toggleSelection, clearSelection }}>
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
