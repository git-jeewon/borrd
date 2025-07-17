import React, { useState } from 'react';

export default function Login() {
  const [identifier, setIdentifier] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Validation function for email or phone number
  const isValidIdentifier = (value: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/; // Basic international phone format
    
    return emailRegex.test(value) || phoneRegex.test(value.replace(/[\s\-\(\)]/g, ''));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!identifier.trim()) {
      setError('Please enter your email or phone number');
      return;
    }

    if (!isValidIdentifier(identifier.trim())) {
      setError('Please enter a valid email or phone number');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ identifier: identifier.trim() }),
      });

      const data = await response.json();

      if (data.success) {
        // Redirect to dashboard on success
        window.location.href = '/dashboard';
      } else {
        setError('Login failed. Please try again.');
      }
    } catch (error) {
      console.error('Login error:', error);
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Input Field */}
          <div>
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="Email or phone number"
              className="w-full px-6 py-4 bg-white border border-gray-200 rounded-lg text-lg placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all duration-200"
              disabled={isLoading}
            />
            {error && (
              <p className="mt-3 text-sm text-red-600 text-center">{error}</p>
            )}
          </div>

          {/* Continue Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-gray-900 text-white text-lg font-medium py-4 px-6 rounded-lg hover:bg-gray-800 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            {isLoading ? 'Continuing...' : 'Continue'}
          </button>
        </form>
      </div>
    </div>
  );
} 