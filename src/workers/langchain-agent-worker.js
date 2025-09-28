/**
 * ChittyChat LangChain Agent Worker
 * Advanced agent orchestration using LangChain.js with Cloudflare Workers
 */

import { ChatCloudflareWorkersAI } from "@langchain/cloudflare";
import { CloudflareVectorizeStore } from "@langchain/cloudflare";
import { CloudflareWorkersAIEmbeddings } from "@langchain/cloudflare";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence } from "@langchain/core/runnables";
import { AgentExecutor, createReActAgent } from "langchain/agents";
import { DynamicTool } from "@langchain/core/tools";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    try {
      switch (url.pathname) {
        case '/agent/query':
          return handleAgentQuery(request, env);

        case '/agent/orchestrate':
          return handleMultiAgentOrchestration(request, env);

        case '/rag/query':
          return handleRAGQuery(request, env);

        case '/chain/execute':
          return handleChainExecution(request, env);

        default:
          return new Response('ChittyChat LangChain Agent System', { status: 200 });
      }
    } catch (error) {
      console.error('LangChain error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};

/**
 * Handle agent queries with tool execution
 */
async function handleAgentQuery(request, env) {
  const { query, context = {} } = await request.json();

  // Initialize Cloudflare Workers AI LLM
  const model = new ChatCloudflareWorkersAI({
    model: "@cf/meta/llama-2-7b-chat-fp16",
    cloudflareAccountId: env.CLOUDFLARE_ACCOUNT_ID,
    cloudflareApiToken: env.CF_API_TOKEN,
    baseURL: `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/ai/run`
  });

  // Define tools for the agent
  const tools = [
    new DynamicTool({
      name: "database_query",
      description: "Query the ChittyChat database for information",
      func: async (input) => {
        return await queryDatabase(env, input);
      }
    }),
    new DynamicTool({
      name: "notion_sync",
      description: "Sync data with Notion",
      func: async (input) => {
        return await syncWithNotion(env, input);
      }
    }),
    new DynamicTool({
      name: "vector_search",
      description: "Search vector database for similar content",
      func: async (input) => {
        return await searchVectors(env, input);
      }
    })
  ];

  // Create ReAct agent
  const agentPrompt = PromptTemplate.fromTemplate(`
    You are a ChittyChat AI agent with access to various tools.

    Available tools:
    {tool_descriptions}

    User Query: {input}
    Context: {context}

    Think step-by-step about how to answer this query.

    {agent_scratchpad}
  `);

  const agent = await createReActAgent({
    llm: model,
    tools,
    prompt: agentPrompt
  });

  const agentExecutor = new AgentExecutor({
    agent,
    tools,
    verbose: true,
    maxIterations: 5
  });

  // Execute agent
  const result = await agentExecutor.invoke({
    input: query,
    context: JSON.stringify(context)
  });

  return new Response(JSON.stringify({
    answer: result.output,
    steps: result.intermediateSteps,
    tools_used: result.intermediateSteps.map(s => s.action.tool)
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * Handle multi-agent orchestration
 */
async function handleMultiAgentOrchestration(request, env) {
  const { task, agents = ['researcher', 'analyzer', 'reporter'] } = await request.json();

  const model = new ChatCloudflareWorkersAI({
    model: "@cf/meta/llama-2-7b-chat-fp16",
    cloudflareAccountId: env.CLOUDFLARE_ACCOUNT_ID,
    cloudflareApiToken: env.CF_API_TOKEN
  });

  // Create specialized agents
  const agentInstances = {
    researcher: createResearchAgent(model, env),
    analyzer: createAnalyzerAgent(model, env),
    reporter: createReporterAgent(model, env)
  };

  // Orchestrate agents
  const results = {};
  let previousOutput = task;

  for (const agentName of agents) {
    const agent = agentInstances[agentName];
    const agentResult = await agent.invoke({
      input: previousOutput,
      previous_results: results
    });

    results[agentName] = agentResult.output;
    previousOutput = agentResult.output;
  }

  return new Response(JSON.stringify({
    task,
    agents_executed: agents,
    results,
    final_output: previousOutput
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * Handle RAG (Retrieval Augmented Generation) queries
 */
async function handleRAGQuery(request, env) {
  const { query, namespace = 'default' } = await request.json();

  // Initialize embeddings
  const embeddings = new CloudflareWorkersAIEmbeddings({
    binding: env.AI,
    model: "@cf/baai/bge-base-en-v1.5"
  });

  // Initialize vector store
  const vectorStore = new CloudflareVectorizeStore(embeddings, {
    binding: env.VECTORIZE,
    index: namespace
  });

  // Search for relevant documents
  const relevantDocs = await vectorStore.similaritySearch(query, 5);

  // Create context from retrieved documents
  const context = relevantDocs
    .map(doc => doc.pageContent)
    .join('\n\n');

  // Generate response with context
  const model = new ChatCloudflareWorkersAI({
    model: "@cf/meta/llama-2-7b-chat-fp16",
    cloudflareAccountId: env.CLOUDFLARE_ACCOUNT_ID,
    cloudflareApiToken: env.CF_API_TOKEN
  });

  const prompt = PromptTemplate.fromTemplate(`
    Based on the following context, answer the user's question.

    Context:
    {context}

    Question: {query}

    Answer:
  `);

  const chain = prompt.pipe(model).pipe(new StringOutputParser());

  const answer = await chain.invoke({
    context,
    query
  });

  return new Response(JSON.stringify({
    answer,
    sources: relevantDocs.map(doc => ({
      content: doc.pageContent.substring(0, 200),
      metadata: doc.metadata
    })),
    similarity_scores: relevantDocs.map(doc => doc.similarity)
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * Handle complex chain execution
 */
async function handleChainExecution(request, env) {
  const { input, chain_type = 'summarize' } = await request.json();

  const model = new ChatCloudflareWorkersAI({
    model: "@cf/meta/llama-2-7b-chat-fp16",
    cloudflareAccountId: env.CLOUDFLARE_ACCOUNT_ID,
    cloudflareApiToken: env.CF_API_TOKEN
  });

  let chain;

  switch (chain_type) {
    case 'summarize':
      chain = RunnableSequence.from([
        PromptTemplate.fromTemplate("Summarize the following text:\n{input}"),
        model,
        new StringOutputParser()
      ]);
      break;

    case 'extract':
      chain = RunnableSequence.from([
        PromptTemplate.fromTemplate("Extract key information from:\n{input}"),
        model,
        new StringOutputParser(),
        PromptTemplate.fromTemplate("Format as JSON:\n{input}"),
        model,
        new StringOutputParser()
      ]);
      break;

    case 'translate':
      chain = RunnableSequence.from([
        PromptTemplate.fromTemplate("Translate to Spanish:\n{input}"),
        model,
        new StringOutputParser()
      ]);
      break;

    default:
      throw new Error(`Unknown chain type: ${chain_type}`);
  }

  const result = await chain.invoke({ input });

  return new Response(JSON.stringify({
    chain_type,
    input: input.substring(0, 100) + '...',
    output: result
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * Helper: Create research agent
 */
function createResearchAgent(model, env) {
  const tools = [
    new DynamicTool({
      name: "web_search",
      description: "Search the web for information",
      func: async (query) => {
        // Implement web search logic
        return `Research results for: ${query}`;
      }
    })
  ];

  const prompt = PromptTemplate.fromTemplate(`
    You are a research agent. Gather information about: {input}
    Previous results: {previous_results}
    {agent_scratchpad}
  `);

  return createReActAgent({ llm: model, tools, prompt });
}

/**
 * Helper: Create analyzer agent
 */
function createAnalyzerAgent(model, env) {
  const tools = [
    new DynamicTool({
      name: "data_analysis",
      description: "Analyze data patterns",
      func: async (data) => {
        return `Analysis of: ${data}`;
      }
    })
  ];

  const prompt = PromptTemplate.fromTemplate(`
    You are an analysis agent. Analyze: {input}
    Previous results: {previous_results}
    {agent_scratchpad}
  `);

  return createReActAgent({ llm: model, tools, prompt });
}

/**
 * Helper: Create reporter agent
 */
function createReporterAgent(model, env) {
  const prompt = PromptTemplate.fromTemplate(`
    You are a reporting agent. Create a report from: {input}
    Previous results: {previous_results}
    {agent_scratchpad}
  `);

  return createReActAgent({ llm: model, tools: [], prompt });
}

/**
 * Helper functions for tools
 */
async function queryDatabase(env, query) {
  // Implement database query logic
  return `Database results for: ${query}`;
}

async function syncWithNotion(env, data) {
  // Implement Notion sync logic
  return `Synced to Notion: ${data}`;
}

async function searchVectors(env, query) {
  // Implement vector search logic
  return `Vector search results for: ${query}`;
}