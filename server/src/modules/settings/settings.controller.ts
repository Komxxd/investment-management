import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../../shared/types';

export const getSettings = async (req: Request, res: Response) => {
  try {
    const { user, supabase } = req as unknown as AuthenticatedRequest;

    const { data, error } = await supabase
      .from('user_settings')
      .select('settings')
      .eq('user_id', user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No row found, return empty settings
        return res.status(200).json({});
      }
      console.error('Error fetching settings:', error);
      return res.status(500).json({ error: 'Failed to fetch settings' });
    }

    res.status(200).json(data?.settings || {});
  } catch (error) {
    console.error('Server error in getSettings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateSettings = async (req: Request, res: Response) => {
  try {
    const { user, supabase } = req as unknown as AuthenticatedRequest;
    const settings = req.body;

    const { data, error } = await supabase
      .from('user_settings')
      .upsert({ 
        user_id: user.id, 
        settings: settings,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      })
      .select('settings')
      .single();

    if (error) {
      console.error('Error updating settings:', error);
      return res.status(500).json({ error: 'Failed to update settings' });
    }

    res.status(200).json(data?.settings);
  } catch (error) {
    console.error('Server error in updateSettings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
