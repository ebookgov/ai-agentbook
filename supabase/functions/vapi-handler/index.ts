import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Cal.com Configuration - Using environment variables with fallbacks
const CAL_API_KEY = Deno.env.get("CAL_API_KEY") || "cal_live_1165df6c7bd47cfd3d0247252c7a5eec";
const CAL_USERNAME = Deno.env.get("CAL_USERNAME") || "ebookgov";
const CAL_EVENT_TYPE = Deno.env.get("CAL_EVENT_TYPE") || "30min"; // Default event type slug

serve(async (req) => {
  try {
    const payload = await req.json();

    console.log("Vapi Payload:", JSON.stringify(payload?.message?.toolCalls || "No Tools"));

    if (payload.message?.type === "tool-calls") {
      const toolCalls = payload.message.toolCalls;
      const results = [];

      for (const call of toolCalls) {
        const { function: func, id } = call;
        
        // --- TOOL: check_availability ---
        if (func.name === "check_availability") {
          const result = await getCalcomAvailability();
          results.push({
            toolCallId: id,
            result: result
          });
        }
        
        // --- TOOL: book_appointment ---
        else if (func.name === "book_appointment") {
          const args = JSON.parse(func.arguments);
          const result = await bookCalcomAppointment(args);
          results.push({
            toolCallId: id,
            result: result
          });
        }
        
        // --- TOOL: query_knowledge_base ---
        else if (func.name === "query_knowledge_base") {
           const args = JSON.parse(func.arguments);
           const factSheet = getPropertyFacts(args.topic);
           results.push({
             toolCallId: id,
             result: factSheet
           });
        }
      }

      return new Response(JSON.stringify({ results: results }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Default response for non-tool messages
    return new Response(JSON.stringify({ status: "ok" }), {
        headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});

// --- CAL.COM API FUNCTIONS ---

async function getCalcomAvailability(): Promise<string> {
  try {
    // Get next 7 days of availability
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 7);
    
    const url = `https://api.cal.com/v1/slots?apiKey=${CAL_API_KEY}&eventTypeSlug=${CAL_EVENT_TYPE}&username=${CAL_USERNAME}&startTime=${startDate.toISOString()}&endTime=${endDate.toISOString()}`;
    
    const response = await fetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" }
    });
    
    if (!response.ok) {
      console.error("Cal.com API error:", await response.text());
      return "I'm having trouble checking the calendar right now. Can I take your number and call you back?";
    }
    
    const data = await response.json();
    
    // Format the available slots nicely
    if (data.slots && Object.keys(data.slots).length > 0) {
      const formattedSlots = formatAvailableSlots(data.slots);
      return formattedSlots;
    }
    
    return "Unfortunately, there are no available slots in the next 7 days. Would you like me to check further out?";
  } catch (error) {
    console.error("Availability check error:", error);
    return "I'm having trouble accessing the calendar. Let me take your contact info and have someone call you back.";
  }
}

function formatAvailableSlots(slots: Record<string, { time: string }[]>): string {
  const options: Intl.DateTimeFormatOptions = { 
    weekday: 'long', 
    month: 'short', 
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short'
  };
  
  const formatted: string[] = [];
  let count = 0;
  
  for (const [date, times] of Object.entries(slots)) {
    if (count >= 3) break; // Limit to 3 options
    
    for (const slot of times) {
      if (count >= 3) break;
      const slotDate = new Date(slot.time);
      formatted.push(slotDate.toLocaleDateString('en-US', options));
      count++;
    }
  }
  
  if (formatted.length === 0) {
    return "No slots available in the next week.";
  }
  
  return `I have availability for: ${formatted.join(', or ')}.`;
}

async function bookCalcomAppointment(args: {
  name: string;
  email: string;
  phone?: string;
  slot_time: string;
  notes?: string;
}): Promise<string> {
  try {
    const bookingData = {
      eventTypeId: 0, // Will be looked up
      start: args.slot_time,
      responses: {
        name: args.name,
        email: args.email,
        phone: args.phone || "",
        notes: args.notes || "Booked via AI Voice Agent"
      },
      timeZone: "America/Phoenix", // Arizona timezone
      language: "en",
      metadata: {
        source: "vapi-voice-agent"
      }
    };
    
    // First, get the event type ID from the slug
    const eventTypeUrl = `https://api.cal.com/v1/event-types?apiKey=${CAL_API_KEY}`;
    const eventTypesResponse = await fetch(eventTypeUrl);
    const eventTypes = await eventTypesResponse.json();
    
    const targetEventType = eventTypes.event_types?.find(
      (et: { slug: string }) => et.slug === CAL_EVENT_TYPE
    );
    
    if (!targetEventType) {
      console.error("Event type not found:", CAL_EVENT_TYPE);
      return "I couldn't find that appointment type. Let me transfer you to someone who can help.";
    }
    
    bookingData.eventTypeId = targetEventType.id;
    
    // Create the booking
    const bookingUrl = `https://api.cal.com/v1/bookings?apiKey=${CAL_API_KEY}`;
    const response = await fetch(bookingUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bookingData)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Booking error:", errorText);
      return "There was an issue booking that slot. It may have just been taken. Want me to check availability again?";
    }
    
    const booking = await response.json();
    
    return `Perfect! You're all set for ${args.name}. A calendar invite has been sent to ${args.email}. See you then!`;
  } catch (error) {
    console.error("Booking error:", error);
    return "I encountered an error while booking. Let me take your info and have someone call you back to confirm.";
  }
}

// --- KNOWLEDGE BASE ---

function getPropertyFacts(topic: string): string {
  const FACTS: Record<string, string> = {
    "solar_lease": "The solar panel lease is $135/month with SunRun. It has 12 years remaining and is transferable.",
    "hauled_water": "This property is served by a hauled water provider. The 5000-gallon tank was inspected in 2023.",
    "hoa_fees": "HOA fees are $55 per month and cover common area maintenance and trash.",
    "schools": "The schools for this address are Desert Mountain High School and Mountainside Middle School.",
    "price": "I can share the listing details, but for specific pricing questions, I'll connect you with the licensed agent.",
    "square_footage": "Let me look that up in the property file.",
  };
  return FACTS[topic] || "I'll verify that information with the listing agent and include it in your appointment notes.";
}
