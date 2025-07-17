import { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { identifier } = req.body;

  if (!identifier || typeof identifier !== 'string') {
    return res.status(400).json({ error: 'Identifier is required' });
  }

  // Basic validation for email or phone number
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
  
  const cleanIdentifier = identifier.replace(/[\s\-\(\)]/g, '');
  const isValid = emailRegex.test(identifier) || phoneRegex.test(cleanIdentifier);

  if (!isValid) {
    return res.status(400).json({ error: 'Invalid email or phone number' });
  }

  // Simulate successful login for any valid identifier
  // In a real app, you'd check against a database and handle authentication
  return res.status(200).json({ 
    success: true,
    message: 'Login successful'
  });
} 