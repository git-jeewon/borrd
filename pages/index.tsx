import React, { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';
import CustomMarkdown from '../components/CustomMarkdown';
import matter from 'gray-matter';

const landingPageMarkdown = `---
font: sans
---

# Your space to write.

## Just Markdown. Just yours.

Publishing shouldn't feel like performing. There's no pressure here, no setup needed, just your words and your ownership of them.

[Start Writing](/editor) • [Login](/login) • [Sign Up](/login) • [Tips & Tricks](#tips)

---

## Why Borrd exists

We believe in writing without the weight of expectations—a place where your thoughts can exist simply because they're yours.

**Made for you:**

- **Light customization** — Choose themes and fonts that feel right. No overwhelming options, just the essentials.
- **Frontmatter support** — Add metadata to your pages with simple frontmatter. Dates, tags, whatever you need.
- **Instant publishing** — Write, click publish, and your page is live. No build times, no deployment steps.

**It just works:**

Pages load instantly. No feeds to curate, no followers to impress, no notifications to distract you. Just your pages, clean and accessible, exactly as you wrote them.

✓ Instant load times  
✓ No distractions  
✓ Just your pages

---

## Here's what a published page looks like

This is exactly how your writing will appear to readers. Clean, readable, and focused on your words.

> "The best writing happens when you forget about the platform and focus on the message."

You can include **bold text**, *italic text*, [links](https://example.com), and even code:

\`\`\`
function hello() {
  return "Simple, clean, yours.";
}
\`\`\`

That's it. No clutter, no distractions—just your words, beautifully presented.

---

*Ready to start? [Create your first page](/editor)*`;

export default function LandingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <svg className="animate-spin -ml-1 mr-3 h-8 w-8 text-gray-600 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (user) {
    return null; // Will redirect to dashboard
  }

  // Parse frontmatter from the markdown content
  const { data: frontmatter, content } = matter(landingPageMarkdown);

  // Determine font class based on frontmatter
  const getFontClass = () => {
    switch (frontmatter.font) {
      case 'serif':
        return 'font-serif';
      case 'mono':
        return 'font-mono';
      case 'sans':
      default:
        return 'font-sans';
    }
  };

  // Determine background style
  const getBackgroundStyle = () => {
    if (frontmatter.background && /^#[0-9A-F]{6}$/i.test(frontmatter.background)) {
      return { backgroundColor: frontmatter.background };
    }
    return {};
  };

  return (
    <div 
      className={`min-h-screen ${getFontClass()}`}
      style={getBackgroundStyle()}
    >
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="prose prose-lg max-w-none">
          <CustomMarkdown>{content}</CustomMarkdown>
        </div>
      </div>
    </div>
  );
} 