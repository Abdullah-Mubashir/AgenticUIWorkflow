import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { WorkflowManager } from './agents/WorkflowManager.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const workflowManager = new WorkflowManager(process.env.OPENAI_API_KEY);

// Get all agents configuration
app.get('/api/agents', (req, res) => {
  const config = workflowManager.getConfiguration();
  res.json(config);
});

// Add new agent
app.post('/api/agents', (req, res) => {
  const agentConfig = req.body;
  const agent = workflowManager.addAgent(agentConfig);
  res.json(agent.toJSON());
});

// Remove agent
app.delete('/api/agents/:agentId', (req, res) => {
  const { agentId } = req.params;
  const removed = workflowManager.removeAgent(agentId);
  res.json({ success: removed });
});

// Process message through workflow
app.post('/api/process', async (req, res) => {
  try {
    const { message, agentOrder } = req.body;
    const results = await workflowManager.processMessage(message, agentOrder);
    res.json(results);
  } catch (error) {
    console.error('Error processing message:', error);
    res.status(500).json({ error: error.message });
  }
});

// Clear all agent messages
app.post('/api/clear', (req, res) => {
  workflowManager.clearAllMessages();
  res.json({ success: true });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
        // Return default settings if file doesn't exist
        const defaultSettings = {
          agents: [{
            role: 'Assistant',
            instructions: 'You are a helpful AI assistant.',
            temperature: 0.7,
            maxTokens: 1000,
            order: 0
          }]
        };
        console.log('No settings file found, returning defaults:', defaultSettings);
        res.json({ success: true, settings: defaultSettings });
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error('Error loading settings:', error);
    res.status(500).json({ success: false, message: 'Failed to load settings: ' + error.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
