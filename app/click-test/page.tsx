'use client';

import React, { useState } from 'react';
import { Button } from '../components/Button';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

/**
 * Smoke test for the frontend -> backend -> database path.
 * Clicking the button sends the click time to the Python backend, which stores it in Supabase.
 */
export default function ClickTestPage() {
  const [status, setStatus] = useState('No clicks recorded yet.');

  const handleClick = async () => {
    // Capture the time first, before any network work.
    const clickedAt = new Date().toISOString();
    setStatus('Saving...');

    try {
      const response = await fetch(`${API_URL}/clicks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clicked_at: clickedAt }),
      });
      if (!response.ok) {
        throw new Error(`Backend responded with ${response.status}`);
      }
      const saved = await response.json();
      setStatus(`Saved row ${saved.id} with clicked_at = ${saved.clicked_at}`);
    } catch (error) {
      setStatus(`Failed to save click: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  };

  return (
    <main style={{ padding: '2rem' }}>
      <h1>Click test</h1>
      <p>Each click stores its timestamp in the button_clicks table.</p>
      <Button onClick={handleClick}>Record click</Button>
      <p role="status">{status}</p>
    </main>
  );
}
