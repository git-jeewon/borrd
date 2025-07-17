import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

// TODO: Implement rate limiting to prevent abuse
// Consider using libraries like 'express-rate-limit' or implementing a simple in-memory store

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { identifier } = req.body;

  // Validate input
  if (!identifier || typeof identifier !== 'string') {
    return res.status(400).json({ success: false, error: 'Identifier is required' });
  }

  // Initialize Supabase client with environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase environment variables');
    return res.status(500).json({ 
      success: false, 
      error: 'Server configuration error' 
    });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  try {
    const trimmedIdentifier = identifier.trim();
    
    // Determine if identifier is email or phone
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    
    // Clean phone number (remove spaces, dashes, parentheses)
    const cleanedPhone = trimmedIdentifier.replace(/[\s\-\(\)]/g, '');
    
    let authResponse;

    if (emailRegex.test(trimmedIdentifier)) {
      // Handle email login
      authResponse = await supabase.auth.signInWithOtp({
        email: trimmedIdentifier,
        options: {
          shouldCreateUser: true, // Allow new user registration
        }
      });
    } else if (phoneRegex.test(cleanedPhone)) {
      // Handle phone login
      authResponse = await supabase.auth.signInWithOtp({
        phone: cleanedPhone,
        options: {
          shouldCreateUser: true, // Allow new user registration
        }
      });
    } else {
      return res.status(400).json({ 
        success: false, 
        error: 'Please enter a valid email address or phone number' 
      });
    }

    // Check for Supabase auth errors
    if (authResponse.error) {
      console.error('Supabase auth error:', authResponse.error);
      
      // Handle specific error cases
      if (authResponse.error.message.includes('rate limit')) {
        return res.status(429).json({
          success: false,
          error: 'Too many requests. Please try again later.'
        });
      }
      
      if (authResponse.error.message.includes('invalid')) {
        return res.status(400).json({
          success: false,
          error: 'Invalid email or phone number format'
        });
      }

      return res.status(400).json({
        success: false,
        error: authResponse.error.message || 'Authentication failed'
      });
    }

    // Success - OTP has been sent
    return res.status(200).json({
      success: true,
      message: emailRegex.test(trimmedIdentifier) 
        ? 'Check your email for the login link'
        : 'Check your phone for the verification code'
    });

  } catch (error) {
    console.error('Login API error:', error);
    return res.status(500).json({
      success: false,
      error: 'An unexpected error occurred. Please try again.'
    });
  }
} 