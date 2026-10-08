import { useState, useCallback } from 'react';

/**
 * Optimistic Update Hook
 * Real-Time Processing Principle: State Synchronization - Optimistic UI Updates
 * 
 * Allows UI to update immediately while server request is in progress,
 * with automatic rollback on error.
 */
export function useOptimisticUpdate(initialValue) {
  const [data, setData] = useState(initialValue);
  const [optimisticData, setOptimisticData] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState(null);

  const update = useCallback(async (newValue, apiCall) => {
    setIsUpdating(true);
    setError(null);
    
    // Store original data for rollback
    const originalData = optimisticData || data;
    
    // Optimistic update
    setOptimisticData(newValue);
    
    try {
      // Perform actual API call
      const result = await apiCall(newValue);
      
      // Success: update with server response
      setData(result);
      setOptimisticData(null);
      setIsUpdating(false);
      
      return result;
    } catch (err) {
      // Error: rollback to original data
      console.error('[Optimistic Update] Error, rolling back:', err.message);
      setError(err.message);
      setOptimisticData(originalData);
      setIsUpdating(false);
      
      throw err;
    }
  }, [data, optimisticData]);

  const reset = useCallback(() => {
    setOptimisticData(null);
    setError(null);
    setIsUpdating(false);
  }, []);

  const currentValue = optimisticData !== null ? optimisticData : data;

  return {
    data: currentValue,
    isUpdating,
    error,
    update,
    reset,
  };
}

/**
 * Optimistic update hook for array operations
 * Useful for lists (incidents, cells, etc.)
 */
export function useOptimisticArrayUpdate(initialArray) {
  const [data, setData] = useState(initialArray);
  const [optimisticData, setOptimisticData] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState(null);

  const addItem = useCallback(async (item, apiCall) => {
    setIsUpdating(true);
    setError(null);
    
    const originalData = optimisticData || data;
    
    // Optimistic add
    const newData = [...originalData, item];
    setOptimisticData(newData);
    
    try {
      const result = await apiCall(item);
      setData(result);
      setOptimisticData(null);
      setIsUpdating(false);
      return result;
    } catch (err) {
      console.error('[Optimistic Update] Error adding item, rolling back:', err.message);
      setError(err.message);
      setOptimisticData(originalData);
      setIsUpdating(false);
      throw err;
    }
  }, [data, optimisticData]);

  const updateItem = useCallback(async (itemId, updates, apiCall) => {
    setIsUpdating(true);
    setError(null);
    
    const originalData = optimisticData || data;
    
    // Optimistic update
    const newData = originalData.map(item =>
      item._id === itemId ? { ...item, ...updates } : item
    );
    setOptimisticData(newData);
    
    try {
      const result = await apiCall(itemId, updates);
      setData(result);
      setOptimisticData(null);
      setIsUpdating(false);
      return result;
    } catch (err) {
      console.error('[Optimistic Update] Error updating item, rolling back:', err.message);
      setError(err.message);
      setOptimisticData(originalData);
      setIsUpdating(false);
      throw err;
    }
  }, [data, optimisticData]);

  const removeItem = useCallback(async (itemId, apiCall) => {
    setIsUpdating(true);
    setError(null);
    
    const originalData = optimisticData || data;
    
    // Optimistic remove
    const newData = originalData.filter(item => item._id !== itemId);
    setOptimisticData(newData);
    
    try {
      await apiCall(itemId);
      setData(newData);
      setOptimisticData(null);
      setIsUpdating(false);
    } catch (err) {
      console.error('[Optimistic Update] Error removing item, rolling back:', err.message);
      setError(err.message);
      setOptimisticData(originalData);
      setIsUpdating(false);
      throw err;
    }
  }, [data, optimisticData]);

  const reset = useCallback(() => {
    setOptimisticData(null);
    setError(null);
    setIsUpdating(false);
  }, []);

  const currentValue = optimisticData !== null ? optimisticData : data;

  return {
    data: currentValue,
    isUpdating,
    error,
    addItem,
    updateItem,
    removeItem,
    reset,
  };
}
