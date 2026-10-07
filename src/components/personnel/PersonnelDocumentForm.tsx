import { useForm } from 'react-hook-form';
import { usePersonnelDocumentMutation, PersonnelDocument, usePersonnelSelectOptions } from '@/hooks/usePersonnel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const formSchema = z.object({
  personnel_id: z.string().min(1, 'Employé requis'),
  document_type: z.string().min(1, 'Type de document requis'),
  document_number: z.string().optional(),
  issue_date: z.string().optional(),
  expiry_date: z.string().optional(),
  file_url: z.string().optional(),
  notes: z.string().optional(),
});

interface PersonnelDocumentFormProps {
  initialData?: PersonnelDocument;
  onSuccess: () => void;
  preselectedPersonnelId?: string;
}

export function PersonnelDocumentForm({ initialData, onSuccess, preselectedPersonnelId }: PersonnelDocumentFormProps) {
  const { createDocument, updateDocument } = usePersonnelDocumentMutation();
  const { options: personnelOptions, resolvePersonnelId } = usePersonnelSelectOptions();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      personnel_id: preselectedPersonnelId || '',
      document_type: '',
      document_number: '',
      issue_date: '',
      expiry_date: '',
      file_url: '',
      notes: '',
    },
  });

  useEffect(() => {
    if (initialData) {
      form.reset({
        personnel_id: initialData.personnel_id,
        document_type: initialData.document_type,
        document_number: initialData.document_number || '',
        issue_date: initialData.issue_date || '',
        expiry_date: initialData.expiry_date || '',
        file_url: initialData.file_url || '',
        notes: initialData.notes || '',
      });
    } else if (preselectedPersonnelId) {
        form.setValue('personnel_id', preselectedPersonnelId);
    }
  }, [initialData, preselectedPersonnelId, form]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      const personnelId = await resolvePersonnelId(values.personnel_id);
      let fileUrl = values.file_url || null;

      if (selectedFile) {
        setIsUploading(true);
        const fileExt = selectedFile.name.split('.').pop();
        const safeName = selectedFile.name.replace(/[\\/:*?"<>|]/g, '-');
        const filePath = `personnel-documents/${personnelId}/${Date.now()}-${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from('personnel-documents')
          .upload(filePath, selectedFile, {
            cacheControl: '3600',
            upsert: true,
            contentType: selectedFile.type || (fileExt ? `image/${fileExt}` : undefined),
          });

        if (uploadError) {
          toast({ title: "Échec du téléversement de l'image" });
          fileUrl = null;
        } else {
          const { data } = supabase.storage.from('personnel-documents').getPublicUrl(filePath);
          fileUrl = data.publicUrl;
        }
      }

      // Clean up empty strings for optional dates
      const cleanValues = {
        ...values,
        personnel_id: personnelId,
        title: values.document_type,
        document_number: values.document_number || null,
        issue_date: values.issue_date || null,
        expiry_date: values.expiry_date || null,
        file_url: fileUrl,
      };

      if (initialData) {
        await updateDocument.mutateAsync({
          id: initialData.id,
          ...cleanValues,
        });
      } else {
        await createDocument.mutateAsync(cleanValues);
      }
      onSuccess();
    } catch (error) {
      console.error('Error saving document:', error);
      toast({ title: "Impossible d'enregistrer le document" });
    } finally {
      setIsUploading(false);
    }
  };

  const isSubmitting = createDocument.isPending || updateDocument.isPending || isUploading;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="personnel_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Employé</FormLabel>
              <Select onValueChange={field.onChange} value={field.value} disabled={!!initialData || !!preselectedPersonnelId}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un employé" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {personnelOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="document_type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Type de document</FormLabel>
                <FormControl>
                  <Input placeholder="Ex: CIN, Passeport, Contrat..." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="document_number"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Numéro</FormLabel>
                <FormControl>
                  <Input placeholder="Ex: AB123456" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="issue_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Date de délivrance</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="expiry_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Date d'expiration</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormItem>
          <FormLabel>Importer image</FormLabel>
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

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Enregistrement...' : initialData ? 'Mettre à jour' : 'Ajouter'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
