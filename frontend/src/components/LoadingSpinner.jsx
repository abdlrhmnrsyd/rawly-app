import React from 'react';

export default function LoadingSpinner({ fullPage = false }) {
  if (fullPage) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '80vh',
        width: '100%'
      }}>
        <div className="spinner" style={{ width: '40px', height: '40px', borderWidth: '3px' }}></div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0', width: '100%' }}>
      <div className="spinner"></div>
    </div>
  );
}
