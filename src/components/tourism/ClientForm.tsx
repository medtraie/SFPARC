import { useState } from 'react';
import { useCreateTourismClient } from '@/hooks/useTourism';
import { UnifiedClientForm, type UnifiedClientFormValues } from '@/components/clients/UnifiedClientForm';
import { upsertUnifiedClientRecord } from '@/lib/unifiedClients';

interface ClientFormProps {
  onSuccess?: () => void;
}

export function ClientForm({ onSuccess }: ClientFormProps) {
  const createClient = useCreateTourismClient();
  const [values, setValues] = useState<UnifiedClientFormValues>({
    sourceModule: 'touristique',
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
      values.ice.trim() ? `ICE: ${values.ice.trim()}` : '',
      values.ifCode.trim() ? `IF: ${values.ifCode.trim()}` : '',
      values.rcCode.trim() ? `RC: ${values.rcCode.trim()}` : '',
      values.city.trim() ? `Ville: ${values.city.trim()}` : '',
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
      email: values.email || null,
      phone: values.phone || null,
      company: values.company || null,
      address: values.address || null,
      notes: normalizedNotes || null,
    });
    upsertUnifiedClientRecord({
      source_module: 'touristique',
      source_id: created.id,
      name: created.name,
      company: created.company,
      phone: created.phone,
      email: created.email,
      address: created.address,
      city: null,
      ice: values.ice || null,
      notes: created.notes,
    });

    setValues((prev) => ({
      ...prev,
      sourceModule: 'touristique',
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
    onSuccess?.();
  };

  return (
    <UnifiedClientForm
      values={values}
      onChange={(field, value) => setValues((prev) => ({ ...prev, [field]: value }))}
      onSubmit={onSubmit}
      isSubmitting={createClient.isPending}
      submitLabel={createClient.isPending ? 'Création...' : 'Créer le client'}
    />
  );
}
