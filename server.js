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

const channels = supabase.channel('custom-update-channel')
  .on(
    'postgres_changes',
    { event: 'UPDATE', schema: 'public', table: 'roadside' },
    (payload) => {
      console.log('Change received!', payload);
    }
  )
  .subscribe();

const channels_1 = supabase.channel('custom-insert-channel')
  .on(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'roadside' },
    (payload) => {
      console.log('Change received!', payload);
    }
  )
  .subscribe();

// Fetch the first row from the 'roadside' table
async function getFirstRow() {
  const { data, error } = await supabase
    .from('roadside')
    .select('*') // Select all columns
    .limit(2);   // Limit the result to 2 rows

  if (error) {
    console.error('Error fetching data:', error);
  } else {
    console.log('First row:', data);
  }
}

getFirstRow();


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
  console.log("///// received event /////",receivedEvent)
  } catch (err) {
    return new Response(err.message, { status: 400 });
  }

  return new Response(JSON.stringify(retrievedEvent), { status: 200 });
}

await serveListener(server, handler);
