import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

type DeliveryRow = {
  id: string;
  document_id: string;
  channel: 'email' | 'whatsapp';
  recipient: string;
  subject: string | null;
  message_body: string | null;
  status: 'queued' | 'sent' | 'failed';
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function normalizePhone(value: string) {
  return value.replace(/[^\d+]/g, '');
}

async function sendEmailResend(payload: {
  to: string;
  subject: string;
  body: string;
}) {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'facturation@localhost.localdomain';
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is missing');
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [payload.to],
      subject: payload.subject,
      text: payload.body,
    }),
  });

  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(json?.message || 'Email provider error');
  }

  return {
    provider: 'resend',
    messageId: json?.id || null,
  };
}

async function sendWhatsAppMeta(payload: {
  to: string;
  body: string;
}) {
  const token = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
  const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
  if (!token || !phoneNumberId) {
    throw new Error('WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID is missing');
  }

  const response = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: normalizePhone(payload.to),
      type: 'text',
      text: {
        body: payload.body,
      },
    }),
  });

  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(json?.error?.message || 'WhatsApp provider error');
  }

  const messageId = json?.messages?.[0]?.id || null;
  return {
    provider: 'whatsapp_cloud_api',
    messageId,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRole) {
      return new Response(JSON.stringify({ error: 'Missing Supabase service env vars' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(supabaseUrl, serviceRole);
    const payload = await req.json().catch(() => ({} as Record<string, unknown>));
    const deliveryId = String(payload?.delivery_id || '');
    if (!deliveryId) {
      return new Response(JSON.stringify({ error: 'delivery_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: delivery, error: deliveryError } = await admin
      .from('fact_delivery_logs')
      .select('*')
      .eq('id', deliveryId)
      .maybeSingle();

    if (deliveryError || !delivery) {
      return new Response(JSON.stringify({ error: deliveryError?.message || 'Delivery not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const row = delivery as DeliveryRow;
    const { data: doc, error: docError } = await admin
      .from('fact_documents')
      .select('id,doc_number,doc_type,total_amount')
      .eq('id', row.document_id)
      .maybeSingle();

    if (docError || !doc) {
      return new Response(JSON.stringify({ error: docError?.message || 'Document not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const defaultSubject = `${doc.doc_type.toUpperCase()} ${doc.doc_number}`;
    const defaultBody = `Bonjour,\nVeuillez trouver votre document ${doc.doc_number}.\nMontant: ${Number(doc.total_amount || 0).toFixed(2)} MAD\n\nCordialement`;
    const subject = row.subject || defaultSubject;
    const body = row.message_body || defaultBody;

    let providerResult: { provider: string; messageId: string | null };
    if (row.channel === 'email') {
      providerResult = await sendEmailResend({
        to: row.recipient,
        subject,
        body,
      });
    } else {
      providerResult = await sendWhatsAppMeta({
        to: row.recipient,
        body: `${subject}\n${body}`,
      });
    }

    const processedAt = new Date().toISOString();
    await admin
      .from('fact_delivery_logs')
      .update({
        status: 'sent',
        provider_name: providerResult.provider,
        provider_message_id: providerResult.messageId,
        error_message: null,
        processed_at: processedAt,
      })
      .eq('id', row.id);

    await admin.from('fact_document_events').insert({
      document_id: row.document_id,
      event_type: 'delivery_sent',
      event_label: row.channel === 'whatsapp' ? 'WhatsApp envoyé' : 'Email envoyé',
      event_payload: {
        delivery_id: row.id,
        channel: row.channel,
        recipient: row.recipient,
        status: 'sent',
        provider: providerResult.provider,
        provider_message_id: providerResult.messageId,
      },
    });

    if (row.channel === 'email') {
      await admin
        .from('fact_documents')
        .update({
          status: 'sent',
          sent_at: processedAt,
          updated_at: processedAt,
        })
        .eq('id', row.document_id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        delivery_id: row.id,
        channel: row.channel,
        status: 'sent',
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
