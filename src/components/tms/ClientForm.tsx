import { useState } from 'react';
import { useCreateTMSClient } from '@/hooks/useTMS';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { UnifiedClientForm, type UnifiedClientFormValues } from '@/components/clients/UnifiedClientForm';
import { Plus } from 'lucide-react';
import { upsertUnifiedClientRecord } from '@/lib/unifiedClients';

export function ClientForm() {
  const [open, setOpen] = useState(false);
  const createClient = useCreateTMSClient();
  const [values, setValues] = useState<UnifiedClientFormValues>({
    sourceModule: 'tms',
    type: 'societe',
    name: '',
    company: '',
    email: '',
    phone: '',
    gsm: '',
    fax: '',
    website: '',
    address: '',
    postalCode: '',
    city: '',
    country: 'Maroc',
    ice: '',
    ifCode: '',
    rcCode: '',
    createdDate: new Date().toISOString().slice(0, 10),
    notes: '',
  });

  const onSubmit = async () => {
    if (!values.name.trim()) return;
    const normalizedNotes = [
      values.notes.trim(),
      values.ifCode.trim() ? `IF: ${values.ifCode.trim()}` : '',
      values.rcCode.trim() ? `RC: ${values.rcCode.trim()}` : '',
      values.postalCode.trim() ? `CP: ${values.postalCode.trim()}` : '',
      values.country.trim() ? `Pays: ${values.country.trim()}` : '',
      values.gsm.trim() ? `GSM: ${values.gsm.trim()}` : '',
      values.fax.trim() ? `Fax: ${values.fax.trim()}` : '',
      values.website.trim() ? `Web: ${values.website.trim()}` : '',
      values.createdDate.trim() ? `Création: ${values.createdDate.trim()}` : '',
      values.type ? `Type: ${values.type}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const created = await createClient.mutateAsync({
      name: values.name,
      company: values.company || null,
      phone: values.phone || null,
      email: values.email || null,
      address: values.address || null,
      city: values.city || null,
      ice: values.ice || null,
      notes: normalizedNotes || null,
    });
    upsertUnifiedClientRecord({
      source_module: 'tms',
      source_id: created.id,
      name: created.name,
      company: created.company,
      phone: created.phone,
      email: created.email,
      address: created.address,
      city: created.city,
      ice: created.ice,
      notes: created.notes,
    });
    setValues((prev) => ({
      ...prev,
      sourceModule: 'tms',
      name: '',
      company: '',
      email: '',
      phone: '',
      gsm: '',
      fax: '',
      website: '',
      address: '',
      postalCode: '',
      city: '',
      country: 'Maroc',
      ice: '',
      ifCode: '',
      rcCode: '',
      createdDate: new Date().toISOString().slice(0, 10),
      notes: '',
    }));
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="w-4 h-4 mr-2" /> Nouveau client</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nouveau client</DialogTitle>
        </DialogHeader>
        <UnifiedClientForm
          values={values}
          onChange={(field, value) => setValues((prev) => ({ ...prev, [field]: value }))}
          onSubmit={onSubmit}
          onCancel={() => setOpen(false)}
          isSubmitting={createClient.isPending}
          submitLabel="Créer"
        />
      </DialogContent>
    </Dialog>
  );
}
