/**
 * Local stub for ChittyRouterGateway to decouple dev from external repo.
 * Provides minimal methods used by langchain-enhanced.js.
 */

export class ChittyRouterGateway {
  constructor(env) {
    this.env = env;
  }

  async executeLangChainPipeline(type, request, context) {
    return {
      success: true,
      pattern: `langchain_${type}`,
      result: { echo: { type, request, context } },
      timestamp: new Date().toISOString(),
      stub: true,
    };
  }

  async executeChittyCasesPipeline(type, request, context) {
    return {
      success: true,
      pattern: `cases_${type}`,
      result: { echo: { type, request, context } },
      timestamp: new Date().toISOString(),
      stub: true,
    };
  }

  async checkLangChainHealth() {
    return { status: "healthy", stub: true };
  }

  async checkChittyCasesHealth() {
    return { status: "healthy", stub: true };
  }
}

export default ChittyRouterGateway;

