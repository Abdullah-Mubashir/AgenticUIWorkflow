import OpenAI from 'openai';
import { Agent } from './Agent.js';

export class WorkflowManager {
  constructor(apiKey) {
    this.openai = new OpenAI({ apiKey });
    this.agents = new Map();
  }

  addAgent(agentConfig) {
    const agent = new Agent(agentConfig);
    this.agents.set(agent.id, agent);
    return agent;
  }

  removeAgent(agentId) {
    return this.agents.delete(agentId);
  }

  getAgent(agentId) {
    return this.agents.get(agentId);
  }

  async processMessage(message, agentOrder = []) {
    const results = [];
    let currentMessage = message;

    for (const agentId of agentOrder) {
      const agent = this.agents.get(agentId);
      if (!agent) continue;

      agent.addMessage({ role: 'user', content: currentMessage });
      
      const response = await this.openai.chat.completions.create({
        model: agent.model,
        messages: agent.getMessages(),
        temperature: agent.temperature,
        max_tokens: agent.maxTokens
      });

      const aiMessage = response.choices[0].message.content;
      agent.addMessage({ role: 'assistant', content: aiMessage });
      
      results.push({
        agentId,
        role: agent.role,
        message: aiMessage
      });

      currentMessage = aiMessage;
    }

    return results;
  }

  getConfiguration() {
    return Array.from(this.agents.values()).map(agent => agent.toJSON());
  }

  clearAllMessages() {
    for (const agent of this.agents.values()) {
      agent.clearMessages();
    }
  }
}
