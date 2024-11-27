export class Agent {
  constructor({ id, role, instructions, model = 'gpt-3.5-turbo', temperature = 0.7, maxTokens = 1000 }) {
    this.id = id;
    this.role = role;
    this.instructions = instructions;
    this.model = model;
    this.temperature = temperature;
    this.maxTokens = maxTokens;
    this.messages = [];
  }

  addMessage(message) {
    this.messages.push(message);
  }

  getMessages() {
    return [
      { role: 'system', content: this.instructions },
      ...this.messages
    ];
  }

  clearMessages() {
    this.messages = [];
  }

  toJSON() {
    return {
      id: this.id,
      role: this.role,
      instructions: this.instructions,
      model: this.model,
      temperature: this.temperature,
      maxTokens: this.maxTokens
    };
  }
}
