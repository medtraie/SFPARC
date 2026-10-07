import { useForm } from 'react-hook-form';
import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTourismCompanyProfile, useUpsertTourismCompanyProfile, TOURISM_COMPANY_ID } from '@/hooks/useTourismCompany';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

const schema = z.object({
  company_name: z.string().optional(),
  contact_email: z.string().email().optional().or(z.literal('')),
  contact_phone: z.string().optional(),
  address: z.string().optional(),
  tax_info: z.string().optional(),
  logo_url: z.string().optional().or(z.literal('')),
});

type FormValues = z.infer<typeof schema>;

export function TourismCompanyForm() {
  const { data, isLoading } = useTourismCompanyProfile();
  const upsert = useUpsertTourismCompanyProfile();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      company_name: '',
      contact_email: '',
      contact_phone: '',
      address: '',
      tax_info: '',
      logo_url: '',
    },
  });

  useEffect(() => {
    if (data) {
      form.reset({
        company_name: data.company_name || '',
        contact_email: data.contact_email || '',
        contact_phone: data.contact_phone || '',
        address: data.address || '',
        tax_info: data.tax_info || '',
        logo_url: data.logo_url || '',
      });
    }
  }, [data, form]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!data?.logo_url) {
        setLogoPreviewUrl(null);
        return;
      }

      if (data.logo_url.startsWith('http')) {
        setLogoPreviewUrl(data.logo_url);
        return;
      }

      const { data: signed, error } = await supabase.storage
        .from('tourism-assets')
        .createSignedUrl(data.logo_url, 60 * 60);

      if (cancelled) return;

      if (error || !signed?.signedUrl) {
        const { data: publicData } = supabase.storage.from('tourism-assets').getPublicUrl(data.logo_url);
        setLogoPreviewUrl(publicData.publicUrl || null);
        return;
      }

      setLogoPreviewUrl(signed.signedUrl);
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [data?.logo_url]);

  const onSubmit = async (values: FormValues) => {
    try {
      let logoUrl = values.logo_url || data?.logo_url || null;

      if (selectedFile) {
        setIsUploading(true);
        const fileExt = selectedFile.name.split('.').pop();
        const safeName = selectedFile.name.replace(/[\\/:*?"<>|]/g, '-');
        const filePath = `private/tourism-company-logo/${Date.now()}-${safeName}`;

        const { error: uploadError } = await supabase.storage.from('tourism-assets').upload(filePath, selectedFile, {
          cacheControl: '3600',
          upsert: true,
          contentType: selectedFile.type || (fileExt ? `image/${fileExt}` : undefined),
        });

        if (uploadError) {
          console.error('Logo upload error:', uploadError);
          toast({ 
            title: 'Échec du téléversement du logo', 
            description: uploadError.message,
            variant: 'destructive' 
          });
          return;
        }

        logoUrl = filePath;
        setSelectedFile(null);
      }

      upsert.mutate({
        id: TOURISM_COMPANY_ID,
        company_name: values.company_name || null,
        contact_email: values.contact_email || null,
        contact_phone: values.contact_phone || null,
        address: values.address || null,
        tax_info: values.tax_info || null,
        logo_url: logoUrl,
      });
    } catch (err: any) {
      console.error('Submit error:', err);
      toast({
        title: 'Erreur lors de l\'enregistrement',
        description: err.message || 'Une erreur est survenue',
        variant: 'destructive'
      });
    } finally {
      setIsUploading(false);
    }
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Chargement du profil...</div>;
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="company_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nom de l&apos;entreprise</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="contact_email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="contact_phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Téléphone</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Adresse</FormLabel>
              <FormControl>
                <Textarea rows={3} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="tax_info"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Informations fiscales (IF, RC, ICE, CNSS, RIB...)</FormLabel>
              <FormControl>
                <Textarea rows={3} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {data?.logo_url && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Logo actuel</p>
            <img
              src={logoPreviewUrl || ''}
              alt="Logo de la société"
              className="h-16 rounded bg-background border border-border object-contain px-2 py-1"
            />
          </div>
        )}

        <FormItem>
          <FormLabel>Logo de la société</FormLabel>
          <FormControl>
            <Input
              type="file"
              accept="image/*"
              onChange={(event) => {
                const file = event.target.files?.[0] || null;
                setSelectedFile(file);
              }}
            />
          </FormControl>
          <FormMessage />
        </FormItem>

        <Button 
          type="submit" 
          className="mt-2" 
          disabled={upsert.isPending || isUploading}
          onClick={() => {
            const errors = form.formState.errors;
            if (Object.keys(errors).length > 0) {
              console.error('Validation errors:', errors);
              toast({
                title: 'Erreur de validation',
                description: 'Veuillez vérifier les champs du formulaire.',
                variant: 'destructive'
              });
            }
          }}
        >
          Enregistrer
        </Button>
      </form>
    </Form>
  );
}
