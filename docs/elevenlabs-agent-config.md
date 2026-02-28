# ElevenLabs Phone Integration Setup

This document outlines how to set up the ElevenLabs Conversational AI agent for the LettingsOps platform.

## System Prompt

Use the following system prompt when creating your ElevenLabs agent:

```
You are a friendly, professional lettings inquiry assistant for a UK-based property rental company.

Your primary role is to collect information from potential tenants enquiring about available properties. Be warm and conversational, but efficient with your time.

**Information to collect (in this order):**
1. Name - "May I ask your name?"
2. Email - "What's the best email to reach you at?"
3. Property of interest - "Which property are you interested in? If you have a reference number, that would be helpful."
4. Move-in date - "When are you looking to move in?"
5. Number of occupants - "How many people will be occupying the property?"
6. Employment status - "Are you currently employed? Full-time or part-time?"
7. Income band - "For our records, are you comfortable sharing your approximate annual household income? (e.g., £20k-£30k, £30k-£50k, £50k+)"
8. Viewing availability - "When would you be available to view the property? What days and times work best for you?"
9. Pets - "Do you have any pets?"

**Conversation guidelines:**
- If the caller doesn't provide information, ask follow-up questions naturally
- If they decline to answer, move on without pressure
- Be clear about your role: you're an AI assistant helping to schedule viewings and collect basic information
- If they have complex questions about the property, offer to connect them with a human agent
- Always confirm the information at the end: "Just to confirm, I have..."
- End the call with: "Thank you for your interest! We'll review your information and be in touch shortly with available viewing times."

**Intent classification:**
- If they're asking about viewing a property: classify as `viewing_enquiry`
- If they're reporting a maintenance issue: classify as `maintenance`
- If they're asking about rental rates/terms: classify as `rent_query`
- Otherwise: classify as `other`
```

## Webhook URL

Configure the webhook in your ElevenLabs agent dashboard to point to:

```
https://<your-api-domain>/webhooks/elevenlabs
```

Replace `<your-api-domain>` with your actual API domain (e.g., `https://api.lettingsops.com`).

## Webhook Payload Format

After each call, ElevenLabs will send a POST request to the webhook with the following payload:

```json
{
  "callId": "call_123abc",
  "agentId": "agent_456def",
  "intent": "viewing_enquiry",
  "extractedFields": {
    "name": "John Smith",
    "email": "john@example.com",
    "phone": "07700900123",
    "propertyRef": "PROP-2024-001",
    "moveInDate": "2024-04-01"
  },
  "transcript": [
    {
      "role": "agent",
      "message": "Hello! Thanks for calling. May I ask your name?",
      "timestamp": "2024-02-28T10:00:00Z"
    },
    {
      "role": "user",
      "message": "Hi, I'm John.",
      "timestamp": "2024-02-28T10:00:05Z"
    }
  ],
  "callDurationSeconds": 245
}
```

## Setup Steps for Bradley

### 1. Create ElevenLabs Account & Agent

1. Go to [elevenlabs.io](https://elevenlabs.io)
2. Sign up / Log in to your account
3. Navigate to **Conversational AI** section
4. Click **Create Agent**
5. Fill in agent name (e.g., "Lettings Inquiry Assistant")
6. In the system prompt field, paste the system prompt provided above
7. Configure the voice (recommend a UK-accent voice for authenticity)
8. Save the agent

### 2. Provision Phone Number

1. In the ElevenLabs agent dashboard, go to **Phone** settings
2. Click **Get a phone number**
3. Select a UK phone number if available (or any region supported)
4. Confirm and provision the number
5. Note the phone number — this is what tenants will call

### 3. Configure Webhook

1. In the agent settings, find **Integrations** or **Webhooks**
2. Add a new webhook endpoint
3. Enter the URL: `https://<your-api-domain>/webhooks/elevenlabs`
4. Set it to fire **after call completion**
5. Verify the webhook is active

### 4. Set SST Secrets

Once your ElevenLabs agent is created, set the following secrets in your SST environment:

```bash
# From ElevenLabs agent dashboard
sst secret set LettingsOpsElevenLabsApiKey <your-elevenlabs-api-key>
sst secret set LettingsOpsElevenLabsAgentId <your-agent-id>
```

**Where to find these:**

- **API Key**: ElevenLabs Dashboard → Account Settings → API Keys
- **Agent ID**: ElevenLabs Dashboard → Conversational AI → Your Agent → Agent ID (visible in the URL or agent details)

### 5. Deploy

Once secrets are set, deploy the API:

```bash
bun run deploy
```

or

```bash
sst deploy --stage production
```

## Testing

To test the integration:

1. Call the ElevenLabs phone number from any phone
2. Speak with the AI agent and provide information
3. End the call
4. Check your LettingsOps database — a new **Lead** record should be created with:
   - Name, email, phone (if provided)
   - Status: `NEW`
   - Source: `phone`
   - A communication log entry with the transcript

### Troubleshooting

- **Webhook not firing**: Double-check the webhook URL in ElevenLabs dashboard matches your deployed API domain
- **Leads not being created**: Check CloudWatch logs for the API Lambda function to see any errors
- **Transcript not captured**: Ensure the call completed successfully and the webhook payload includes the `transcript` array

## Monitoring

Monitor incoming calls and leads:

- **Dashboard**: Visit the Leads page in the LettingsOps web app to see incoming calls as "📞 Phone" badges
- **Logs**: Check CloudWatch for the ElevenLabs webhook handler logs
- **Database**: Query the `leads` table filtered by `source = 'phone'` to see phone-originated leads

## Next Steps

Once confirmed working:

1. **Score & Route**: Implement lead scoring to prioritize phone-originated leads
2. **Auto-assignment**: Integrate with calendar to automatically book viewings
3. **Follow-up**: Add SMS/email follow-up sequences for interested leads
4. **Analytics**: Track call duration, conversation intent, and conversion rates
