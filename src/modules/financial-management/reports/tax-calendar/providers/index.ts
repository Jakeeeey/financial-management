// providers/index.ts - Tax Calendar API provider
import type { TaxActivityForm, TaxActivity } from '../types';

const API_BASE_URL = '/api/fm/reports/tax-calendar';

/**
 * Parse error response safely
 */
async function parseErrorResponse(res: Response): Promise<string> {
  const contentType = res.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    try {
      const json = await res.json();
      return json.message || json.error || `HTTP ${res.status}`;
    } catch {
      return `HTTP ${res.status}`;
    }
  }
  return `HTTP ${res.status}`;
}

/**
 * Fetch all tax activities
 */
export async function fetchTaxActivities(): Promise<TaxActivity[]> {
  try {
    console.log('[TAX-CAL] Fetching tax activities from:', API_BASE_URL);
    
    const res = await fetch(API_BASE_URL, { 
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
      }
    });
    
    console.log('[TAX-CAL] Response status:', res.status);
    
    if (!res.ok) {
      const errorMsg = await parseErrorResponse(res);
      console.error('[TAX-CAL] API error:', errorMsg, 'Status:', res.status);
      
      // Handle specific status codes
      if (res.status === 401) {
        throw new Error('Unauthorized: Please log in again');
      }
      if (res.status === 403) {
        throw new Error('Forbidden: You do not have permission');
      }
      if (res.status >= 500) {
        throw new Error(`Server error: ${errorMsg}`);
      }
      
      throw new Error(errorMsg);
    }
    
    const contentType = res.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      throw new Error('Invalid response format: expected JSON');
    }
    
    const data = await res.json();
    console.log('[TAX-CAL] Fetch successful, received:', data);
    return Array.isArray(data) ? data : (data.data ?? []);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch tax activities';
    console.error('[TAX-CAL FETCH ERROR]', message);
    throw error;
  }
}

/**
 * Create a new tax activity
 */
export async function createTaxActivity(form: TaxActivityForm): Promise<TaxActivity> {
  try {
    const res = await fetch(API_BASE_URL, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(form),
    });
    
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.message || `HTTP ${res.status}`);
    }
    
    const data = await res.json();
    return data.data ?? data;
  } catch (error) {
    console.error('[TAX-CAL CREATE]', error);
    throw error;
  }
}

/**
 * Update an existing tax activity
 */
export async function updateTaxActivity(id: string, form: TaxActivityForm): Promise<TaxActivity> {
  try {
    const res = await fetch(`${API_BASE_URL}/${id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(form),
    });
    
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.message || `HTTP ${res.status}`);
    }
    
    const data = await res.json();
    return data.data ?? data;
  } catch (error) {
    console.error('[TAX-CAL UPDATE]', error);
    throw error;
  }
}

/**
 * Delete a tax activity
 */
export async function deleteTaxActivity(id: string): Promise<void> {
  try {
    const res = await fetch(`${API_BASE_URL}/${id}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
      },
    });
    
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.message || `HTTP ${res.status}`);
    }
  } catch (error) {
    console.error('[TAX-CAL DELETE]', error);
    throw error;
  }
}
