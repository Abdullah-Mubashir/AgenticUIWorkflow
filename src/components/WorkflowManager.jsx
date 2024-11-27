import React, { useState, useRef, useEffect } from 'react';
import { PlusCircle, Trash2, Settings, Send, Brain, Copy, Save, AlertTriangle, Clock } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import FormattedMessage from './FormattedMessage';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
});

// Create a separate OpenAI instance for the analyzer
const analyzerAI = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
});

const WorkflowManager = () => {
  const [agents, setAgents] = useState(() => {
    try {
      const savedAgents = localStorage.getItem('workflowAgents');
      const backupAgents = localStorage.getItem('workflowAgentsBackup');
      
      if (savedAgents) {
        const parsedAgents = JSON.parse(savedAgents);
        localStorage.setItem('workflowAgentsBackup', savedAgents);
        return parsedAgents;
      }
      
      if (backupAgents) {
        console.log('Main save corrupted, restoring from backup');
        const parsedBackup = JSON.parse(backupAgents);
        localStorage.setItem('workflowAgents', backupAgents);
        return parsedBackup;
      }
      
      return [];
    } catch (error) {
      console.error('Error loading saved agents:', error);
      try {
        const backupAgents = localStorage.getItem('workflowAgentsBackup');
        if (backupAgents) {
          const parsedBackup = JSON.parse(backupAgents);
          localStorage.setItem('workflowAgents', backupAgents);
          return parsedBackup;
        }
      } catch (backupError) {
        console.error('Error loading backup:', backupError);
      }
      return [];
    }
  });
  const [messages, setMessages] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [userInput, setUserInput] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const [showAllResponses, setShowAllResponses] = useState(() => {
    return localStorage.getItem('showAllResponses') === 'true';
  });
  const [thinkingTime, setThinkingTime] = useState(0);
  const [thinkingTimer, setThinkingTimer] = useState(null);
  const [finalThinkingTime, setFinalThinkingTime] = useState(null);
  const [currentThread, setCurrentThread] = useState(null);
  const chatEndRef = useRef(null);

  // Update thinking time every second while processing
  useEffect(() => {
    if (isProcessing && !showAllResponses) {
      const timer = setInterval(() => {
        setThinkingTime(prev => prev + 1);
      }, 1000);
      setThinkingTimer(timer);
      return () => clearInterval(timer);
    } else if (!isProcessing && thinkingTimer) {
      clearInterval(thinkingTimer);
      setThinkingTimer(null);
      setFinalThinkingTime(thinkingTime);
    }
  }, [isProcessing, showAllResponses]);

  const formatThinkingTime = (seconds) => {
    if (!seconds && seconds !== 0) return '';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Initialize thread when component mounts
  useEffect(() => {
    createNewThread();
  }, []);

  const createNewThread = async () => {
    try {
      const thread = await openai.beta.threads.create();
      setCurrentThread(thread.id);
      console.log('New thread created:', thread.id);
    } catch (error) {
      console.error('Error creating thread:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!userInput.trim() || isProcessing) return;

    const newMessage = { type: 'user', content: userInput };
    setMessages(prev => [...prev, newMessage]);
    setUserInput('');
    setIsProcessing(true);
    setThinkingTime(0);
    setFinalThinkingTime(null);

    try {
      if (!currentThread) {
        await createNewThread();
      }

      const analysis = await analyzeQueryComplexity(userInput);
      const sortedAgents = [...agents].sort((a, b) => a.order - b.order);
      const agentsToUse = analysis.isComplex ? sortedAgents : [sortedAgents[0]];
      let previousResponses = [];
      const startTime = Date.now();

      // Add thinking message for last agent only if not showing all responses
      if (!showAllResponses) {
        const lastAgent = agentsToUse[agentsToUse.length - 1];
        setMessages(prev => [...prev, {
          type: 'thinking',
          content: 'Thinking deeply...',
          agentId: lastAgent.id,
          startTime
        }]);
      }

      for (const agent of agentsToUse) {
        if (!agent.role || !agent.instructions) continue;

        const isLastAgent = agent === agentsToUse[agentsToUse.length - 1];
        const isFirstAgent = agent === agentsToUse[0];

        // Show thinking message only for visible agents
        if (showAllResponses) {
          setMessages(prev => [...prev, {
            type: 'thinking',
            content: 'Thinking deeply...',
            agentId: agent.id,
            startTime: Date.now()
          }]);
        }

        try {
          const response = await processAgentWithAI(agent, userInput, previousResponses);
          previousResponses.push({ agentId: agent.id, role: agent.role, content: response });

          // Calculate total thinking time
          const totalThinkingTime = Math.round((Date.now() - startTime) / 1000);

          // Update messages based on visibility settings
          if (showAllResponses || (isFirstAgent && agentsToUse.length > 1) || isLastAgent) {
            setMessages(prev => 
              prev.map(msg => 
                msg.type === 'thinking' && msg.agentId === agent.id
                  ? {
                      type: 'agent',
                      content: response,
                      agentId: agent.id,
                      thinkingTime: isLastAgent ? totalThinkingTime : null
                    }
                  : msg
              )
            );
          }

          // Update final thinking time for the last agent
          if (isLastAgent) {
            setFinalThinkingTime(totalThinkingTime);
          }
        } catch (error) {
          console.error(`Error with agent ${agent.role}:`, error);
          if (showAllResponses || isLastAgent) {
            setMessages(prev => 
              prev.map(msg => 
                msg.type === 'thinking' && msg.agentId === agent.id
                  ? { type: 'error', content: 'Error processing response', agentId: agent.id }
                  : msg
              )
            );
          }
        }
      }
    } catch (error) {
      console.error('Error in workflow:', error);
      setMessages(prev => [...prev, {
        type: 'error',
        content: 'Error processing your request',
        agentId: 'system'
      }]);
    }

    setIsProcessing(false);
  };

  const processAgentWithAI = async (agent, userMessage, previousResponses) => {
    try {
      let contextMessage = userMessage;
      
      if (previousResponses.length > 0) {
        contextMessage += "\n\nPrevious agents' responses:\n" + 
          previousResponses.map(resp => `${resp.role}: ${resp.content}`).join('\n');
      }

      // Add message to thread
      await openai.beta.threads.messages.create(
        currentThread,
        {
          role: "user",
          content: contextMessage
        }
      );

      // Create and run the assistant
      const assistant = await openai.beta.assistants.create({
        name: agent.role,
        instructions: `You are ${agent.role}. ${agent.instructions}`,
        model: "gpt-4o-mini",
      });

      const run = await openai.beta.threads.runs.create(
        currentThread,
        {
          assistant_id: assistant.id
        }
      );

      // Poll for completion
      let response;
      while (true) {
        const runStatus = await openai.beta.threads.runs.retrieve(
          currentThread,
          run.id
        );

        if (runStatus.status === 'completed') {
          const messages = await openai.beta.threads.messages.list(
            currentThread
          );
          response = messages.data[0].content[0].text.value;
          break;
        } else if (runStatus.status === 'failed') {
          throw new Error('Assistant run failed');
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Clean up the assistant
      await openai.beta.assistants.del(assistant.id);

      return response;
    } catch (error) {
      console.error('Error processing agent with AI:', error);
      return `Error: ${error.message}`;
    }
  };

  // Separate analyzer function with its own thread
  const analyzeQueryComplexity = async (query) => {
    try {
      const analyzerThread = await analyzerAI.beta.threads.create();

      await analyzerAI.beta.threads.messages.create(
        analyzerThread.id,
        {
          role: 'user',
          content: `Query: "${query}"

You are a Query Complexity Analyzer specialized in identifying coding and technical problems.

ALWAYS SIMPLE (return isComplex: false):
1. Personal Information:
   - Names (My name is X)
   - Introductions
   - Personal details
   - Basic preferences

2. Basic Interactions:
   - Greetings (hi, hello)
   - How are you
   - Thank you
   - Goodbyes
   - Simple questions
   - Basic clarifications

3. General Knowledge:
   - Simple facts
   - Basic definitions
   - Yes/no questions
   - Time/date queries
   - Location questions
   - Simple what/where/when questions

COMPLEX ONLY IF (return isComplex: true):
1. Programming Related:
   - Code writing requests
   - Debugging help
   - Error explanations
   - Implementation questions
   - Algorithm discussions
   - Code optimization

2. Technical Problems:
   - System architecture
   - Database design
   - API integration
   - Performance issues
   - Security concerns

3. Multi-step Problems:
   - Requires research
   - Needs code examples
   - Multiple concepts involved
   - Step-by-step explanations needed

STRICT RULES:
1. Default to SIMPLE unless explicitly technical/coding related
2. Personal information is ALWAYS simple
3. General knowledge is ALWAYS simple
4. Must contain technical keywords to be complex:
   - code, programming, function, error, debug
   - database, API, server, implementation
   - algorithm, optimize, architecture
   - security, performance, integration

Respond with ONLY: {"isComplex": boolean}

Current query length: ${query.split(' ').length} words
Contains technical terms: ${/\b(code|program|function|error|debug|database|api|server|implement|algorithm|optimize|architecture|security|performance|integration)\b/i.test(query)}`
        }
      );

      const run = await analyzerAI.beta.threads.runs.create(
        analyzerThread.id,
        {
          assistant_id: "asst_temp_analyzer",
          instructions: "You are a Query Complexity Analyzer specialized in identifying coding and technical problems. Mark as complex ONLY if the query is explicitly about programming, coding, or technical system design. Everything else should be simple. Return only JSON with isComplex boolean."
        }
      );

      let runStatus = await analyzerAI.beta.threads.runs.retrieve(
        analyzerThread.id,
        run.id
      );

      while (runStatus.status !== 'completed') {
        await new Promise(resolve => setTimeout(resolve, 1000));
        runStatus = await analyzerAI.beta.threads.runs.retrieve(
          analyzerThread.id,
          run.id
        );
      }

      const messages = await analyzerAI.beta.threads.messages.list(
        analyzerThread.id
      );

      const result = JSON.parse(messages.data[0].content[0].text.value);

      // Clean up analyzer thread
      await analyzerAI.beta.threads.del(analyzerThread.id);

      // Force simple for personal information and basic interactions
      if (
        /\b(my name|i am|call me|nice to meet|pleased to meet)\b/i.test(query) ||
        query.split(' ').length <= 3 ||
        /^(hi|hello|hey|thanks|thank you|bye|goodbye)$/i.test(query.trim())
      ) {
        return { isComplex: false };
      }

      // Force complex only for explicit technical terms
      const technicalTerms = /\b(code|program|function|error|debug|database|api|server|implement|algorithm|optimize|architecture|security|performance|integration)\b/i;
      if (technicalTerms.test(query)) {
        return { isComplex: true };
      }

      return result;
    } catch (error) {
      console.error('Error in complexity analysis:', error);
      // Default to simple unless contains technical terms
      const technicalTerms = /\b(code|program|function|error|debug|database|api|server|implement|algorithm|optimize|architecture|security|performance|integration)\b/i;
      return { isComplex: technicalTerms.test(query) };
    }
  };

  const addAgent = () => {
    const newAgent = {
      id: Date.now(),
      role: '',
      instructions: '',
      temperature: 0.7,
      maxTokens: 1000,
      order: agents.length
    };
    setAgents([...agents, newAgent]);
  };

  const duplicateAgent = (agent) => {
    const newAgent = {
      ...agent,
      id: Date.now(),
      order: agents.length
    };
    setAgents([...agents, newAgent]);
  };

  const updateAgent = (id, field, value) => {
    setAgents(agents.map(agent => 
      agent.id === id ? { ...agent, [field]: value } : agent
    ));
  };

  const removeAgent = (id) => {
    setAgents(agents.filter(agent => agent.id !== id));
  };

  // Load settings on component mount
  useEffect(() => {
    try {
      const savedAgents = localStorage.getItem('workflowAgents');
      const savedShowAllResponses = localStorage.getItem('showAllResponses');
      
      if (savedAgents) {
        const parsedAgents = JSON.parse(savedAgents);
        // Validate saved agents have required fields
        const validAgents = parsedAgents.map(agent => ({
          id: agent.id || Date.now(),
          role: agent.role || '',
          instructions: agent.instructions || '',
          temperature: agent.temperature || 0.7,
          maxTokens: agent.maxTokens || 1000,
          order: agent.order || 0
        }));
        setAgents(validAgents);
      }

      if (savedShowAllResponses !== null) {
        setShowAllResponses(savedShowAllResponses === 'true');
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      // Try to load from backup
      try {
        const backupAgents = localStorage.getItem('workflowAgentsBackup');
        if (backupAgents) {
          setAgents(JSON.parse(backupAgents));
        }
      } catch (backupError) {
        console.error('Error loading backup:', backupError);
      }
    }
  }, []);

  const renderMessage = (message, index) => {
    const messageClass = message.type === 'user' ? 'bg-gray-700' : 'bg-gray-800';
    
    return (
      <div key={index} className={`${messageClass} rounded-lg p-4`}>
        <div className="flex items-start space-x-2">
          <div className={`w-8 h-8 rounded-full ${message.type === 'user' ? 'bg-blue-500' : 'bg-green-500'} flex items-center justify-center`}>
            <span className="text-white font-medium">
              {message.type === 'user' ? 'U' : 'A'}
            </span>
          </div>
          <div className="flex-1">
            {message.type === 'thinking' ? (
              <div className="flex items-center space-x-2">
                <span className="text-gray-400">Thinking deeply...</span>
                <Clock className="w-4 h-4 text-blue-400 animate-pulse" />
                <span className="text-blue-400">{formatThinkingTime(thinkingTime)}</span>
              </div>
            ) : message.type === 'agent' ? (
              <>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-blue-400">
                    {agents.find(a => a.id === message.agentId)?.role || 'AI Agent'}
                  </span>
                  {message.thinkingTime && (
                    <span className="text-xs text-gray-400 flex items-center">
                      <Clock className="w-3 h-3 mr-1" />
                      Thought for {formatThinkingTime(message.thinkingTime)}
                    </span>
                  )}
                </div>
                <FormattedMessage 
                  content={message.content} 
                  agentRole={agents.find(a => a.id === message.agentId)?.role || 'AI Agent'} 
                />
              </>
            ) : (
              <p className="text-white whitespace-pre-wrap">{message.content}</p>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Settings Toggle Button */}
      <button
        onClick={() => setShowSettings(!showSettings)}
        className="fixed top-4 right-4 p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors duration-200"
      >
        <Settings size={20} className="text-blue-400" />
      </button>

      {/* Settings Panel */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 rounded-lg p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto border border-gray-700 shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-white">AI Workflow Settings</h2>
              <button
                onClick={() => setShowSettings(false)}
                className="text-gray-400 hover:text-white transition-colors duration-200"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Agents Configuration */}
            <div className="space-y-4 mb-6">
              {agents.map((agent, index) => (
                <div key={agent.id} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-medium text-white">Agent {index + 1}</h2>
                    <div className="flex gap-2">
                      <button
                        onClick={() => duplicateAgent(agent)}
                        className="text-blue-400 hover:text-blue-300 transition-colors duration-200"
                        title="Duplicate Agent"
                      >
                        <Copy size={16} />
                      </button>
                      <button
                        onClick={() => removeAgent(agent.id)}
                        className="text-red-400 hover:text-red-300 transition-colors duration-200"
                        title="Remove Agent"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <input
                      type="text"
                      placeholder="Role (e.g., Senior Developer, Code Reviewer)"
                      value={agent.role}
                      onChange={(e) => updateAgent(agent.id, 'role', e.target.value)}
                      className="w-full bg-gray-700 text-white border-none rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                    <textarea
                      placeholder="Instructions for the agent's behavior and expertise"
                      value={agent.instructions}
                      onChange={(e) => updateAgent(agent.id, 'instructions', e.target.value)}
                      className="w-full bg-gray-700 text-white border-none rounded-lg p-2 h-24 focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
                    />
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm text-gray-300 mb-1 block">Temperature</label>
                        <input
                          type="number"
                          min="0"
                          max="2"
                          step="0.1"
                          value={agent.temperature}
                          onChange={(e) => updateAgent(agent.id, 'temperature', parseFloat(e.target.value))}
                          className="w-full bg-gray-700 text-white border-none rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-sm text-gray-300 mb-1 block">Max Tokens</label>
                        <input
                          type="number"
                          min="1"
                          max="4000"
                          value={agent.maxTokens}
                          onChange={(e) => updateAgent(agent.id, 'maxTokens', parseInt(e.target.value))}
                          className="w-full bg-gray-700 text-white border-none rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-sm text-gray-300 mb-1 block">Response Order</label>
                        <input
                          type="number"
                          min="0"
                          value={agent.order}
                          onChange={(e) => updateAgent(agent.id, 'order', parseInt(e.target.value))}
                          className="w-full bg-gray-700 text-white border-none rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Response Display Toggle */}
            <div className="mb-6 p-4 bg-gray-700 rounded-lg">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm text-gray-300">Show All Agent Responses</span>
                <div className="relative">
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={showAllResponses}
                    onChange={(e) => setShowAllResponses(e.target.checked)}
                  />
                  <div className={`block w-14 h-8 rounded-full transition-colors duration-200 ${showAllResponses ? 'bg-blue-500' : 'bg-gray-600'}`}>
                    <div className={`absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform duration-200 ${showAllResponses ? 'transform translate-x-6' : ''}`} />
                  </div>
                </div>
              </label>
              <p className="text-xs text-gray-400 mt-2">
                {showAllResponses ? 
                  "Showing responses from all agents in sequence" : 
                  "Only showing final response with thinking time. Other agents still work in background."}
              </p>
            </div>

            <div className="flex justify-between items-center mt-6">
              <button
                onClick={addAgent}
                className="flex items-center gap-2 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors duration-200"
              >
                <PlusCircle size={16} />
                Add Agent
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Chat Interface */}
      <div className={`w-full max-w-6xl mx-auto transition-all duration-300 ${showSettings ? 'mr-96' : ''}`}>
        <div className="flex flex-col h-screen">
          {/* Chat Header */}
          <div className="text-center py-8">
            <h1 className="text-3xl font-bold text-blue-400 mb-2">WorkIron AI Assistant</h1>
            <p className="text-gray-400 text-sm">Powered by multiple AI agents working together</p>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
            {messages.map((message, index) => renderMessage(message, index))}
            <div ref={chatEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-6 border-t border-gray-800">
            <form onSubmit={handleSubmit} className="flex gap-4 max-w-4xl mx-auto">
              <div className="flex-1">
                <input
                  type="text"
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  placeholder="Type your message..."
                  className="w-full px-6 py-4 rounded-xl bg-gray-800 text-white border border-gray-700 focus:outline-none focus:border-blue-500 text-lg"
                  disabled={isProcessing}
                />
              </div>
              <button
                type="submit"
                disabled={isProcessing}
                className="px-8 py-4 bg-blue-500 text-white rounded-xl hover:bg-blue-600 disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center min-w-[4rem]"
              >
                {isProcessing ? <Brain className="animate-spin h-6 w-6" /> : <Send className="h-6 w-6" />}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkflowManager;
