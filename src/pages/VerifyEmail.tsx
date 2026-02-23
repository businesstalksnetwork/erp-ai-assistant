import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { useTheme } from '@/lib/theme-context';
// Logo imports removed - using ERP-AI branding

type VerificationStatus = 'loading' | 'success' | 'error' | 'expired' | 'used';

export default function VerifyEmail() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { theme } = useTheme();
  // Logo removed - using ERP-AI branding
  
  const [status, setStatus] = useState<VerificationStatus>('loading');
  const [message, setMessage] = useState<string>('');

  const token = searchParams.get('token');

  useEffect(() => {
    const verifyEmail = async () => {
      if (!token) {
        setStatus('error');
        setMessage('Nedostaje token za verifikaciju.');
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke('verify-email', {
          body: { token },
        });

        if (error) {
          console.error('Verification error:', error);
          setStatus('error');
          setMessage('Došlo je do greške pri verifikaciji. Pokušajte ponovo.');
          return;
        }

        if (data.success) {
          setStatus('success');
          setMessage(data.message);
        } else {
          // Handle specific error types
          switch (data.error) {
            case 'token_expired':
              setStatus('expired');
              break;
            case 'token_used':
              setStatus('used');
              break;
            default:
              setStatus('error');
          }
          setMessage(data.message);
        }
      } catch (err) {
        console.error('Verification error:', err);
        setStatus('error');
        setMessage('Došlo je do greške pri verifikaciji.');
      }
    };

    verifyEmail();
  }, [token]);

  const getStatusIcon = () => {
    switch (status) {
      case 'loading':
        return <Loader2 className="h-16 w-16 animate-spin text-primary" />;
      case 'success':
        return <CheckCircle className="h-16 w-16 text-green-500" />;
      case 'used':
        return <AlertCircle className="h-16 w-16 text-yellow-500" />;
      case 'expired':
      case 'error':
        return <XCircle className="h-16 w-16 text-destructive" />;
    }
  };

  const getStatusTitle = () => {
    switch (status) {
      case 'loading':
        return 'Verifikacija u toku...';
      case 'success':
        return 'Email potvrđen!';
      case 'used':
        return 'Već verifikovano';
      case 'expired':
        return 'Link istekao';
      case 'error':
        return 'Greška pri verifikaciji';
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6 animate-fade-in">
        <div className="text-center space-y-2">
          <Link to="/" className="inline-block">
            <div className="h-12 flex items-center justify-center">
              <span className="text-2xl font-bold text-primary">ERP-AI Assistant</span>
            </div>
          </Link>
        </div>

        <Card className="glass">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              {getStatusIcon()}
            </div>
            <CardTitle>{getStatusTitle()}</CardTitle>
            <CardDescription className="text-base">
              {message}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {status === 'success' && (
              <Button 
                className="w-full" 
                onClick={() => navigate('/auth')}
              >
                Prijavi se
              </Button>
            )}
            
            {status === 'used' && (
              <Button 
                className="w-full" 
                onClick={() => navigate('/auth')}
              >
                Idi na prijavu
              </Button>
            )}
            
            {(status === 'expired' || status === 'error') && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground text-center">
                  Možete se registrovati ponovo da dobijete novi link za verifikaciju.
                </p>
                <Button 
                  className="w-full" 
                  variant="outline"
                  onClick={() => navigate('/auth')}
                >
                  Nazad na registraciju
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
