import React from 'react';
import { GetServerSideProps } from 'next';
import Link from 'next/link';

interface NotFoundPageProps {
  requestedPath: string;
}

export const getServerSideProps: GetServerSideProps<NotFoundPageProps> = async ({ params }) => {
  const pathArray = params?.path as string[] || [];
  const requestedPath = pathArray.join('/');

  // Since folders no longer generate URLs, any path that reaches here should be a 404
  return {
    props: {
      requestedPath
    }
  };
};

export default function NotFoundPage({ requestedPath }: NotFoundPageProps) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">404 - Page Not Found</h1>
        <p className="text-gray-600 mb-6">
          The page &quot;{requestedPath}&quot; could not be found.
        </p>
        <p className="text-gray-500 mb-8">
          Folders are now used only for organization in the dashboard and don&apos;t create public URLs.
        </p>
        <Link 
          href="/" 
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
} 