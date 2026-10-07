import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Truck, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

const authSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(6, 'Le mot de passe doit contenir au moins 6 caractères'),
});

type AuthFormValues = z.infer<typeof authSchema>;

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const { user, loading, signIn, signUp } = useAuth();
  const isRTL = i18n.language === 'ar';

  const form = useForm<AuthFormValues>({
    resolver: zodResolver(authSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  // Redirect if already logged in
  useEffect(() => {
    if (!loading && user) {
      navigate('/');
    }
  }, [user, loading, navigate]);

  const onSubmit = async (values: AuthFormValues) => {
    setIsSubmitting(true);
    
    try {
      if (isLogin) {
        const { error } = await signIn(values.email, values.password);
        
        if (error) {
          let message = 'Une erreur est survenue lors de la connexion';
          if (error.message.includes('Invalid login credentials')) {
            message = 'Email ou mot de passe incorrect';
          } else if (error.message.includes('Email not confirmed')) {
            message = 'Veuillez confirmer votre email d\'abord';
          }
          toast({
            title: 'Erreur',
            description: message,
            variant: 'destructive',
          });
          return;
        }
        
        toast({
          title: 'Bienvenue !',
          description: 'Connexion réussie',
        });
        navigate('/');
      } else {
        const { error } = await signUp(values.email, values.password);
        
        if (error) {
          let message = 'Une erreur est survenue lors de la création du compte';
          if (error.message.includes('User already registered')) {
            message = 'Cet email est déjà enregistré';
          } else if (error.message.includes('Password')) {
            message = 'Le mot de passe est trop faible';
          }
          toast({
            title: 'Erreur',
            description: message,
            variant: 'destructive',
          });
          return;
        }
        
        toast({
          title: 'Compte créé !',
          description: 'Veuillez vérifier votre email pour confirmer le compte',
        });
        form.reset();
      }
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Une erreur inattendue est survenue',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#070B16]">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen flex items-center justify-center bg-[#070B16] p-4 relative overflow-hidden"
    >
      <div className="pointer-events-none absolute top-1/4 left-1/3 w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-[140px]" />
      <Card className="w-full max-w-md shadow-2xl border-white/10 bg-[#121A2B] text-slate-100 relative z-10">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(85,214,232,0.4)]">
            <Truck className="w-8 h-8 text-slate-950" />
          </div>
          <div>
            <CardTitle className="text-2xl font-extrabold text-white">
              {isLogin ? 'Connexion SFTM' : 'Créer un compte SFTM'}
            </CardTitle>
            <CardDescription className="mt-2 text-slate-400">
              {isLogin 
                ? 'Entrez vos identifiants pour accéder au système de gestion de flotte' 
                : 'Créez votre compte pour gérer votre flotte'}
            </CardDescription>
          </div>
        </CardHeader>
        
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="exemple@entreprise.com"
                        {...field}
                        className="h-11"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mot de passe</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          placeholder="••••••••"
                          {...field}
                          className="h-11 pr-10"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? (
                            <EyeOff className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <Eye className="w-4 h-4 text-muted-foreground" />
                          )}
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <Button 
                type="submit" 
                className="w-full h-11 text-base font-medium"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Traitement en cours...
                  </>
                ) : (
                  isLogin ? 'Se connecter' : 'Créer le compte'
                )}
              </Button>
            </form>
          </Form>
          
          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              {isLogin ? 'Pas encore de compte ?' : 'Vous avez déjà un compte ?'}
              <Button
                variant="link"
                className="px-1 text-primary font-medium"
                onClick={() => {
                  setIsLogin(!isLogin);
                  form.reset();
                }}
              >
                {isLogin ? 'Créer un compte' : 'Se connecter'}
              </Button>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
