import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../../services/api/client';
import { useAuth } from './AuthProvider';

export interface UserSettings {
  hiddenIndices?: string[];
}

interface SettingsContextType {
  settings: UserSettings;
  updateSettings: (newSettings: Partial<UserSettings>) => Promise<void>;
  isLoading: boolean;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const [settings, setSettings] = useState<UserSettings>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!session) {
      setSettings({});
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    const fetchSettings = async () => {
      try {
        const data = await api.get('/api/settings');
        if (isMounted) {
          setSettings(data || {});
        }
      } catch (error) {
        console.error('Failed to fetch user settings:', error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchSettings();
    
    return () => {
      isMounted = false;
    };
  }, [session]);

  const updateSettings = async (newSettings: Partial<UserSettings>) => {
    if (!session) return;
    
    const updated = { ...settings, ...newSettings };
    setSettings(updated);

    try {
      await api.put('/api/settings', updated);
    } catch (error) {
      console.error('Failed to update user settings:', error);
    }
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, isLoading }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
