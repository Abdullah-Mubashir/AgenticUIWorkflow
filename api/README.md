# WorkIron API

A powerful multi-agent AI workflow API that allows you to create, manage, and interact with multiple AI agents in a sequential workflow.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file with your OpenAI API key:
```
OPENAI_API_KEY=your-api-key-here
PORT=3001
```

3. Start the server:
```bash
npm run dev
```

## API Endpoints

### Get All Agents
```
GET /api/agents
```
Returns the configuration of all agents in the workflow.

### Add New Agent
```
POST /api/agents
```
Add a new agent to the workflow.

Request body:
```json
{
  "id": "agent1",
  "role": "Expert in X",
  "instructions": "You are an expert in X...",
  "model": "gpt-3.5-turbo",
  "temperature": 0.7,
  "maxTokens": 1000
}
```

### Remove Agent
```
DELETE /api/agents/:agentId
```
Remove an agent from the workflow.

### Process Message
```
POST /api/process
```
Process a message through the workflow agents.

Request body:
```json
{
  "message": "Your input message",
  "agentOrder": ["agent1", "agent2", "agent3"]
}
```

### Clear Messages
```
POST /api/clear
```
Clear all message history from agents.

## Example Usage

```javascript
// Add agents
await fetch('http://localhost:3001/api/agents', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    id: 'researcher',
    role: 'Research Assistant',
    instructions: 'You are a research assistant...'
  })
});

// Process message through workflow
const response = await fetch('http://localhost:3001/api/process', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: "What's the latest research on AI?",
    agentOrder: ['researcher', 'writer', 'editor']
  })
});

const results = await response.json();
```

## Security

- API key is stored in environment variables
- CORS is enabled for cross-origin requests
- Input validation is performed on all requests
- Error handling is implemented for all endpoints

## Error Handling

The API returns appropriate HTTP status codes and error messages:

- 200: Success
- 400: Bad Request (invalid input)
- 404: Not Found (agent not found)
- 500: Internal Server Error (processing error)

## Development

- Run in development mode: `npm run dev`
- Run in production mode: `npm start`
