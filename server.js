import { serveListener } from "https://deno.land/std@0.116.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js';
import { config } from "https://deno.land/x/dotenv/mod.ts";
import Stripe from "npm:stripe@^11.16";


// Load environment variables
const env = config();



// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// Access your environment variables
const supabaseUrl = env.SUPABASE_URL;
const supabaseKey = env.SUPABASE_KEY;

console.log('Supabase URL:', supabaseUrl);
console.log('Supabase Key:', supabaseKey);

const supabase = createClient(supabaseUrl, supabaseKey, {
  realtime: {
    params: {
      eventsPerSecond: 10,  // Set a rate limit for real-time events
    },
  },
});


async function updateInvoiceStatus(stripeInvoiceId, newStatus) {
  // First, select the row based on stripeInvoiceId
  const { data, error } = await supabase
    .from('invoices')  // Replace with your actual table name
    .select('*')
    .eq('stripeInvoiceId', stripeInvoiceId)
    .single();  // .single() assumes there will be only one matching row

  if (error) {
    console.error('Error fetching invoice:', error);
    return;
  }

  if (data) {
    // Now, update the stripeInvoiceStatus field for the selected row
    const { error: updateError } = await supabase
      .from('invoices')  // Replace with your actual table name
      .update({ stripeInvoiceStatus: newStatus })
      .eq('stripeInvoiceId', stripeInvoiceId);

    if (updateError) {
      console.error('Error updating invoice status:', updateError);
    } else {
      console.log('Invoice status updated successfully!');
    }
  }
}




// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// Access the environment variables
const STRIPE_WEBHOOK_SIGNING_SECRET = env.STRIPE_WEBHOOK_SIGNING_SECRET;
const STRIPE_API_KEY = env.STRIPE_API_KEY;

console.log("STRIPE_WEBHOOK_SIGNING_SECRET",STRIPE_WEBHOOK_SIGNING_SECRET)
console.log("STRIPE_API_KEY",STRIPE_API_KEY)

const stripe = Stripe(STRIPE_API_KEY);
const PORT=5050
const server = Deno.listen({ port: PORT, host: "0.0.0.0" });
console.log(`HTTP webserver running.  Access it at:  http://localhost:${PORT}/`);

// This handler will be called for every incoming request.
async function handler(request) {
  const signature = request.headers.get("Stripe-Signature");

  // First step is to verify the event. The .text() method must be used as the
  // verification relies on the raw request body rather than the parsed JSON.
  const body = await request.text();
  let receivedEvent;
  try {
    receivedEvent = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      STRIPE_WEBHOOK_SIGNING_SECRET,
      undefined
    );
  } catch (err) {
    return new Response(err.message, { status: 400 });
  }

  // Secondly, we use this event to query the Stripe API in order to avoid
  // handling any forged event. If available, we use the idempotency key.
  const requestOptions =
    receivedEvent.request && receivedEvent.request.idempotency_key
      ? {
          idempotencyKey: receivedEvent.request.idempotency_key,
        }
      : {};

  let retrievedEvent;
  try {
    retrievedEvent = await stripe.events.retrieve(
      receivedEvent.id,
      requestOptions
    );
    // console.log("///// received event /////",receivedEvent)

    if (receivedEvent?.data?.object?.object === "invoiceitem" || receivedEvent?.data?.object?.object === "invoice") {

      console.log("///// received event id /////",receivedEvent.data.object.id)
      console.log("///// received event type /////",receivedEvent?.type)


      if(receivedEvent?.type==="invoice.payment_succeeded" || receivedEvent?.type==="invoice.paid"){

        try {
          await updateInvoiceStatus(receivedEvent?.data.object.id, "invoice.paid");  
        } catch (error) {
          console.error("///// error updating invoice status /////",error)
        }
        
      }

      if(receivedEvent?.type==="invoice.finalized"){

        try {
          // Wait for 3 seconds before updating the invoice status
          await new Promise(resolve => setTimeout(resolve, 3000));
          await updateInvoiceStatus(receivedEvent?.data.object.id, "invoice.finalized");  
        } catch (error) {
          console.error("///// error updating invoice status /////",error)
        }
        
      }
    
    }

  } catch (err) {
    return new Response(err.message, { status: 400 });
  }

  return new Response(JSON.stringify(retrievedEvent), { status: 200 });
}

await serveListener(server, handler);
