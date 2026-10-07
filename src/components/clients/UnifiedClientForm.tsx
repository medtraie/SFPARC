import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { UnifiedClientModule } from '@/lib/unifiedClients';

export type UnifiedClientFormValues = {
  sourceModule: UnifiedClientModule;
  type: 'societe' | 'particulier';
  name: string;
  company: string;
  email: string;
  phone: string;
  gsm: string;
  fax: string;
  website: string;
  address: string;
  postalCode: string;
  city: string;
  country: string;
  ice: string;
  ifCode: string;
  rcCode: string;
  createdDate: string;
  notes: string;
};

type UnifiedClientFormProps = {
  values: UnifiedClientFormValues;
  onChange: <K extends keyof UnifiedClientFormValues>(field: K, value: UnifiedClientFormValues[K]) => void;
  onSubmit: () => void | Promise<void>;
  onCancel?: () => void;
  isSubmitting?: boolean;
  submitLabel?: string;
  cancelLabel?: string;
  showType?: boolean;
  showBusinessFields?: boolean;
  showCreatedDate?: boolean;
  showSourceModule?: boolean;
  showGsm?: boolean;
};

export function UnifiedClientForm({
  values,
  onChange,
  onSubmit,
  onCancel,
  isSubmitting = false,
  submitLabel = 'Enregistrer',
  cancelLabel = 'Annuler',
  showType = true,
  showBusinessFields = true,
  showCreatedDate = true,
  showSourceModule = false,
  showGsm = true,
}: UnifiedClientFormProps) {
  return (
    <div className="space-y-4">
      {showType ? (
        <div className="flex items-center gap-6">
          <Label className="font-medium">Type</Label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              checked={values.type === 'societe'}
              onChange={() => onChange('type', 'societe')}
            />
            Société
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              checked={values.type === 'particulier'}
              onChange={() => onChange('type', 'particulier')}
            />
            Particulier
          </label>
        </div>
      ) : null}

      {showSourceModule ? (
        <div className="space-y-1">
          <Label>Section</Label>
          <Select
            value={values.sourceModule}
            onValueChange={(value) => onChange('sourceModule', value as UnifiedClientModule)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="facturation">Facturation</SelectItem>
              <SelectItem value="touristique">Transport Touristique</SelectItem>
              <SelectItem value="tms">Transport TMS</SelectItem>
            </SelectContent>
          </Select>
        </div>
      ) : null}

      <div className="space-y-1">
        <Label>Nom *</Label>
        <Input value={values.name} onChange={(e) => onChange('name', e.target.value)} placeholder="Nom" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-3">
          <Label className="font-semibold">Adresse de facturation</Label>
          <div className="space-y-1">
            <Label>Adresse</Label>
            <Input value={values.address} onChange={(e) => onChange('address', e.target.value)} placeholder="Adresse" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>CP</Label>
              <Input value={values.postalCode} onChange={(e) => onChange('postalCode', e.target.value)} placeholder="CP" />
            </div>
            <div className="space-y-1">
              <Label>Ville</Label>
              <Input value={values.city} onChange={(e) => onChange('city', e.target.value)} placeholder="Ville" />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Pays</Label>
            <Input value={values.country} onChange={(e) => onChange('country', e.target.value)} placeholder="Pays" />
          </div>
          {showBusinessFields ? (
            <>
              <div className="space-y-1">
                <Label>Société</Label>
                <Input value={values.company} onChange={(e) => onChange('company', e.target.value)} placeholder="Société" />
              </div>
              <div className="space-y-1">
                <Label>Code ICE</Label>
                <Input value={values.ice} onChange={(e) => onChange('ice', e.target.value)} placeholder="Code ICE" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label>Code IF</Label>
                  <Input value={values.ifCode} onChange={(e) => onChange('ifCode', e.target.value)} placeholder="Code IF" />
                </div>
                <div className="space-y-1">
                  <Label>RC</Label>
                  <Input value={values.rcCode} onChange={(e) => onChange('rcCode', e.target.value)} placeholder="RC" />
                </div>
              </div>
            </>
          ) : null}
        </div>

        <div className="space-y-3">
          <Label className="font-semibold">Informations de contact</Label>
          {showCreatedDate ? (
            <div className="space-y-1">
              <Label>Date Création</Label>
              <Input type="date" value={values.createdDate} onChange={(e) => onChange('createdDate', e.target.value)} />
            </div>
          ) : null}
          <div className="space-y-1">
            <Label>Téléphone</Label>
            <Input value={values.phone} onChange={(e) => onChange('phone', e.target.value)} placeholder="+212 ..." />
          </div>
          {showGsm ? (
            <div className="space-y-1">
              <Label>GSM</Label>
              <Input value={values.gsm} onChange={(e) => onChange('gsm', e.target.value)} placeholder="+212 ..." />
            </div>
          ) : null}
          <div className="space-y-1">
            <Label>Fax</Label>
            <Input value={values.fax} onChange={(e) => onChange('fax', e.target.value)} placeholder="Fax" />
          </div>
          <div className="space-y-1">
            <Label>Email</Label>
            <Input value={values.email} onChange={(e) => onChange('email', e.target.value)} placeholder="email@client.com" />
          </div>
          <div className="space-y-1">
            <Label>Site Web</Label>
            <Input value={values.website} onChange={(e) => onChange('website', e.target.value)} placeholder="https://..." />
          </div>
        </div>
      </div>

      <div className="space-y-1">
        <Label>Notes</Label>
        <Textarea value={values.notes} onChange={(e) => onChange('notes', e.target.value)} placeholder="Notes..." rows={3} />
      </div>

      <div className="flex items-center gap-2 justify-end">
        {onCancel ? <Button variant="outline" onClick={onCancel}>{cancelLabel}</Button> : null}
        <Button onClick={() => void onSubmit()} disabled={isSubmitting}>
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
