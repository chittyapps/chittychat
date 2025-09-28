// Cloudflare AI Gateway Integration for ChittyChat
export class ChittyAIGateway {
  constructor(env) {
    this.gatewayUrl = 'https://gateway.ai.cloudflare.com/v1/84f0f32886f1d6196380fe6cbe9656a8/chitty';
    this.aigToken = env.CF_AIG_TOKEN || 'KOzCuSDIs_4pRjiYhYuMRlFNWrAHdAXEhFBHnetF';
    this.openaiToken = env.OPENAI_API_KEY;
    this.anthropicToken = env.ANTHROPIC_API_KEY;
  }

  // OpenAI Chat Completions
  async chatCompletion(messages, options = {}) {
    const response = await fetch(`${this.gatewayUrl}/openai/chat/completions`, {
      method: 'POST',
      headers: {
        'cf-aig-authorization': `Bearer ${this.aigToken}`,
        'Authorization': `Bearer ${this.openaiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: options.model || 'gpt-3.5-turbo',
        messages,
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 1000,
        ...options
      })
    });

    if (!response.ok) {
      throw new Error(`AI Gateway error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  // Anthropic Claude
  async claudeCompletion(messages, options = {}) {
    const response = await fetch(`${this.gatewayUrl}/anthropic/v1/messages`, {
      method: 'POST',
      headers: {
        'cf-aig-authorization': `Bearer ${this.aigToken}`,
        'x-api-key': this.anthropicToken,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: options.model || 'claude-3-haiku-20240307',
        messages,
        max_tokens: options.maxTokens || 1024,
        ...options
      })
    });

    if (!response.ok) {
      throw new Error(`AI Gateway error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  // Workers AI (direct or via AI Gateway)
  async workersAI(model, input, env) {
    // Use direct Workers AI binding if available
    if (env && env.AI) {
      return await env.AI.run(model, input);
    }

    // Fallback to AI Gateway
    const response = await fetch(`${this.gatewayUrl}/workers-ai/${model}`, {
      method: 'POST',
      headers: {
        'cf-aig-authorization': `Bearer ${this.aigToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(input)
    });

    if (!response.ok) {
      throw new Error(`Workers AI error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  // Text Embeddings using Workers AI
  async generateEmbeddingsWorkersAI(text, env) {
    const model = '@cf/baai/bge-base-en-v1.5';

    if (env && env.AI) {
      const embeddings = await env.AI.run(model, {
        text: [text]
      });
      return embeddings.data[0];
    }

    // Fallback to OpenAI
    return this.generateEmbeddings(text);
  }

  // Text Classification for email categorization
  async classifyEmail(text, env) {
    const model = '@cf/huggingface/distilbert-sst-2-int8';

    if (env && env.AI) {
      return await env.AI.run(model, {
        text
      });
    }

    // Fallback to GPT
    const response = await this.chatCompletion([
      { role: 'system', content: 'Classify this email as: lead, support, financial, or general' },
      { role: 'user', content: text }
    ], { temperature: 0.1 });

    return response.choices[0].message.content;
  }

  // Summarization for long emails
  async summarizeEmail(text, env) {
    const model = '@cf/facebook/bart-large-cnn';

    if (env && env.AI) {
      const result = await env.AI.run(model, {
        input_text: text,
        max_length: 150
      });
      return result.summary;
    }

    // Fallback to GPT
    const response = await this.chatCompletion([
      { role: 'system', content: 'Summarize this email in 2-3 sentences' },
      { role: 'user', content: text }
    ], { temperature: 0.3 });

    return response.choices[0].message.content;
  }

  // Embeddings for Vectorize
  async generateEmbeddings(text, model = 'text-embedding-ada-002') {
    const response = await fetch(`${this.gatewayUrl}/openai/embeddings`, {
      method: 'POST',
      headers: {
        'cf-aig-authorization': `Bearer ${this.aigToken}`,
        'Authorization': `Bearer ${this.openaiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        input: text
      })
    });

    if (!response.ok) {
      throw new Error(`Embeddings error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    return result.data[0].embedding;
  }

  // Lead Enrichment AI
  async enrichLead(leadData, emailBody) {
    const prompt = `Analyze this email and extract/enrich lead information:

Email: ${emailBody}
Current Lead Data: ${JSON.stringify(leadData)}

Extract and return JSON with:
- name
- company
- role
- phone
- budget_range
- timeline
- pain_points
- interests
- lead_score (0-100)
- recommended_action`;

    const response = await this.chatCompletion([
      { role: 'system', content: 'You are a lead enrichment AI. Extract and analyze lead data from emails. Always return valid JSON.' },
      { role: 'user', content: prompt }
    ], {
      model: 'gpt-4-turbo-preview',
      temperature: 0.3,
      response_format: { type: 'json_object' }
    });

    return JSON.parse(response.choices[0].message.content);
  }

  // Property Inquiry AI
  async processPropertyInquiry(inquiry, propertyType) {
    const propertyContext = {
      city: 'Modern city apartment with skyline views',
      loft: 'Spacious industrial loft with high ceilings',
      cozy: 'Charming cottage with garden access',
      villa: 'Luxury villa with premium amenities'
    };

    const response = await this.chatCompletion([
      {
        role: 'system',
        content: `You are a property specialist AI for ${propertyContext[propertyType]}.
          Help qualify leads and provide relevant property information.`
      },
      {
        role: 'user',
        content: inquiry
      }
    ], {
      model: 'gpt-3.5-turbo',
      temperature: 0.5
    });

    return response.choices[0].message.content;
  }

  // Chico Concierge AI
  async chicoProcess(request) {
    const response = await this.claudeCompletion([
      {
        role: 'user',
        content: `As Chico, an AI concierge, help with this request: ${request}

Provide personalized recommendations and assistance.
Be helpful, friendly, and proactive in suggesting solutions.`
      }
    ], {
      model: 'claude-3-haiku-20240307',
      temperature: 0.7
    });

    return response.content[0].text;
  }

  // Email Reply Generator
  async generateReply(thread, replyType = 'professional') {
    const tones = {
      professional: 'Professional and courteous',
      friendly: 'Warm and friendly',
      formal: 'Formal and business-appropriate',
      casual: 'Casual and conversational'
    };

    const response = await this.chatCompletion([
      {
        role: 'system',
        content: `Generate an email reply with a ${tones[replyType]} tone.`
      },
      {
        role: 'user',
        content: `Thread context: ${JSON.stringify(thread)}

Generate an appropriate reply that addresses the inquiry and moves the conversation forward.`
      }
    ], {
      model: 'gpt-3.5-turbo',
      temperature: 0.6
    });

    return response.choices[0].message.content;
  }

  // Analytics and Insights
  async generateInsights(metrics) {
    const response = await this.chatCompletion([
      {
        role: 'system',
        content: 'You are an analytics AI. Provide actionable insights from email metrics.'
      },
      {
        role: 'user',
        content: `Analyze these email metrics and provide insights:
          ${JSON.stringify(metrics)}

Identify trends, opportunities, and recommendations.`
      }
    ], {
      model: 'gpt-4-turbo-preview',
      temperature: 0.4
    });

    return response.choices[0].message.content;
  }
}

// Helper function to create AI Gateway client
export function createAIGateway(env) {
  return new ChittyAIGateway(env);
}