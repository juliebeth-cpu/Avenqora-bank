import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle, ArrowLeft } from 'lucide-react';

const REPLIT_DOMAIN_RE = /^[a-zA-Z0-9][a-zA-Z0-9\-\.]*\.(replit\.dev|replit\.app|repl\.co)$/i;

function isReplitOrLocal(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || REPLIT_DOMAIN_RE.test(hostname);
}

export default function NotFound() {
  const isCustomDomain = !isReplitOrLocal(window.location.hostname);

  if (isCustomDomain) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-white px-6">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-8 h-8 text-slate-400" />
          </div>
          <h1 className="text-2xl font-bold mb-2 text-white">Page Not Found</h1>
          <p className="text-slate-400 text-sm mb-8">
            The page you were looking for doesn't exist on this site.
          </p>
          <a
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors text-white"
          >
            <ArrowLeft className="w-4 h-4" />
            Go to Homepage
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2">
            <AlertCircle className="h-8 w-8 text-red-500" />
            <h1 className="text-2xl font-bold text-gray-900">
              404 Page Not Found
            </h1>
          </div>
          <p className="mt-4 text-sm text-gray-600">
            Did you forget to add the page to the router?
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
