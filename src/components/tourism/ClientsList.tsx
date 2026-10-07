import { useTourismClients, useDeleteTourismClient, TourismClient } from '@/hooks/useTourism';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { User, Mail, Phone, Building2, Trash2, MapPin } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

import { useNavigate } from 'react-router-dom';

export function ClientsList() {
  const { data: clients, isLoading } = useTourismClients();
  const deleteClient = useDeleteTourismClient();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-40" />
        ))}
      </div>
    );
  }

  if (!clients?.length) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <User className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>Aucun client enregistré</p>
        <p className="text-sm">Ajoutez votre premier client pour commencer</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {clients.map((client) => (
        <ClientCard 
          key={client.id} 
          client={client} 
          onDelete={() => deleteClient.mutate(client.id)} 
          onClick={() => navigate(`/clients/tourism/${client.id}`)}
        />
      ))}
    </div>
  );
}

interface ClientCardProps {
  client: TourismClient;
  onDelete: () => void;
  onClick: () => void;
}

function ClientCard({ client, onDelete, onClick }: ClientCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={onClick}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="w-4 h-4 text-primary" />
            </div>
            <span className="truncate">{client.name}</span>
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {client.company && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Building2 className="w-4 h-4" />
            <span>{client.company}</span>
          </div>
        )}
        {client.email && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Mail className="w-4 h-4" />
            <span className="truncate">{client.email}</span>
          </div>
        )}
        {client.phone && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Phone className="w-4 h-4" />
            <span>{client.phone}</span>
          </div>
        )}
        {client.address && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="w-4 h-4" />
            <span className="truncate">{client.address}</span>
          </div>
        )}
        {client.notes && (
          <Badge variant="outline" className="text-xs">
            {client.notes.substring(0, 30)}...
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}
