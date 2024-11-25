import React, { useState, useRef, useEffect } from 'react';
import { PlusCircle, Trash2, Settings, Send, Brain, Copy, Save } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
});

const WorkflowManager = () => {
  const [agents, setAgents] = useState(() => {
    const savedAgents = localStorage.getItem('workflowAgents');
    return savedAgents ? JSON.parse(savedAgents) : [];
  });
  const [messages, setMessages] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [userInput, setUserInput] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const [showAllResponses, setShowAllResponses] = useState(() => {
    return localStorage.getItem('showAllResponses') === 'true';
  });
  const [currentThread, setCurrentThread] = useState(null);
  const chatEndRef = useRef(null);
  const thinkingMessageRef = useRef(null);

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

  // Save settings to localStorage
  useEffect(() => {
    localStorage.setItem('workflowAgents', JSON.stringify(agents));
    localStorage.setItem('showAllResponses', showAllResponses);
  }, [agents, showAllResponses]);

  const addAgent = () => {
    const newAgent = {
      id: Date.now(),
      name: '',
      role: '',
      systemPrompt: '',
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
      order: agents.length // Only change the order to place it at the end
    };
    setAgents([...agents, newAgent]);
  };

  const saveSettings = () => {
    localStorage.setItem('workflowAgents', JSON.stringify(agents));
    setSaveStatus('Settings saved!');
    setTimeout(() => setSaveStatus(''), 2000); // Clear status after 2 seconds
  };

  const updateAgent = (id, field, value) => {
    setAgents(agents.map(agent => 
      agent.id === id ? { ...agent, [field]: value } : agent
    ));
  };

  const removeAgent = (id) => {
    setAgents(agents.filter(agent => agent.id !== id));
  };

  const processAgentWithAI = async (agent, userMessage, previousResponses) => {
    try {
      let contextMessage = userMessage;
      
      if (previousResponses.length > 0) {
        contextMessage += "\n\nPrevious agents' responses:\n" + 
          previousResponses.map(resp => `${resp.agentName}: ${resp.content}`).join('\n');
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
        name: agent.name,
        instructions: `You are ${agent.role}. ${agent.systemPrompt}`,
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

  const handleSendMessage = async () => {
    if (!userInput.trim() || isProcessing) return;
    
    setIsProcessing(true);
    const userMessage = userInput;
    setUserInput('');

    // Create new thread if none exists
    if (!currentThread) {
      await createNewThread();
    }

    setMessages(prev => [...prev, { type: 'user', content: userMessage }]);

    const sortedAgents = [...agents].sort((a, b) => a.order - b.order);
    const responses = [];
    let thinkingMessageId = null;

    for (let i = 0; i < sortedAgents.length; i++) {
      const agent = sortedAgents[i];
      const isFirst = i === 0;
      const isLast = i === sortedAgents.length - 1;

      try {
        if (!showAllResponses && !isFirst && !isLast) {
          if (!thinkingMessageId) {
            const thinkingMessage = {
              type: 'agent',
              agentName: 'System',
              agentRole: 'Processing',
              content: 'Thinking deeply...',
              isThinking: true,
              id: Date.now()
            };
            setMessages(prev => [...prev, thinkingMessage]);
            thinkingMessageId = thinkingMessage.id;
          }
        }

        const response = await processAgentWithAI(agent, userMessage, responses);
        const agentMessage = {
          type: 'agent',
          agentName: agent.name,
          agentRole: agent.role,
          content: response
        };
        
        responses.push(agentMessage);

        if (showAllResponses || isFirst || isLast) {
          if (thinkingMessageId) {
            setMessages(prev => prev.filter(msg => !msg.isThinking));
            thinkingMessageId = null;
          }
          setMessages(prev => [...prev, agentMessage]);
        }
      } catch (error) {
        console.error(`Error with agent ${agent.name}:`, error);
      }
    }

    if (thinkingMessageId) {
      setMessages(prev => prev.filter(msg => !msg.isThinking));
    }

    setIsProcessing(false);
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Settings Toggle Button */}
      <button
        onClick={() => setShowSettings(!showSettings)}
        className="fixed top-4 right-4 z-50 bg-gray-800 text-white p-3 rounded-full hover:bg-gray-700 transition-colors duration-200 shadow-lg"
      >
        <Settings size={20} className="text-blue-400" />
      </button>

      {/* Settings Panel */}
      <div className={`fixed right-0 top-0 h-full w-96 bg-gray-800 shadow-xl transform transition-transform duration-300 ease-in-out overflow-y-auto ${showSettings ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-blue-400">Agent Settings</h2>
            <div className="flex gap-2">
              <button
                onClick={addAgent}
                className="flex items-center gap-2 bg-blue-500 text-white px-3 py-2 rounded-lg hover:bg-blue-600 transition-colors duration-200"
              >
                <PlusCircle size={16} />
                Add
              </button>
              <button
                onClick={saveSettings}
                className="flex items-center gap-2 bg-green-500 text-white px-3 py-2 rounded-lg hover:bg-green-600 transition-colors duration-200"
              >
                <Save size={16} />
                Save
              </button>
            </div>
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
                "Showing responses from all agents" : 
                "Only showing first and last agent responses"}
            </p>
          </div>

          {/* Save Status Message */}
          {saveStatus && (
            <div className="mb-4 p-2 bg-green-500 text-white rounded-lg text-center transition-opacity duration-200">
              {saveStatus}
            </div>
          )}

          <div className="space-y-6">
            {agents.map(agent => (
              <Card key={agent.id} className="bg-gray-700 border-none shadow-lg">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    <input
                      type="text"
                      placeholder="Agent Name"
                      value={agent.name}
                      onChange={(e) => updateAgent(agent.id, 'name', e.target.value)}
                      className="bg-gray-600 text-white border-none rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </CardTitle>
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
                </CardHeader>
                <CardContent className="space-y-4">
                  <input
                    type="text"
                    placeholder="Role (e.g., Teacher, CTO)"
                    value={agent.role}
                    onChange={(e) => updateAgent(agent.id, 'role', e.target.value)}
                    className="w-full bg-gray-600 text-white border-none rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <textarea
                    placeholder="System Prompt"
                    value={agent.systemPrompt}
                    onChange={(e) => updateAgent(agent.id, 'systemPrompt', e.target.value)}
                    className="w-full bg-gray-600 text-white border-none rounded-lg p-2 h-24 focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
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
                        className="w-full bg-gray-600 text-white border-none rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
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
                        className="w-full bg-gray-600 text-white border-none rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-gray-300 mb-1 block">Response Order</label>
                      <input
                        type="number"
                        min="0"
                        value={agent.order}
                        onChange={(e) => updateAgent(agent.id, 'order', parseInt(e.target.value))}
                        className="w-full bg-gray-600 text-white border-none rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Main Chat Interface */}
      <div className={`max-w-4xl mx-auto transition-all duration-300 ${showSettings ? 'mr-96' : ''}`}>
        <div className="flex flex-col h-screen p-4">
          {/* Chat Header */}
          <div className="text-center mb-6 pt-4">
            <h1 className="text-2xl font-bold text-blue-400">WorkIron AI Assistant</h1>
            <p className="text-gray-400 text-sm">Powered by multiple AI agents working together</p>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl p-4 ${
                    message.type === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 border border-gray-700'
                  }`}
                >
                  {message.type === 'agent' && (
                    <div className="text-sm font-semibold text-blue-400 mb-1">
                      {message.agentName} ({message.agentRole})
                    </div>
                  )}
                  <div className="text-white whitespace-pre-wrap leading-relaxed">
                    {message.content}
                  </div>
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Chat Input */}
          <div className="pt-4 pb-6">
            <div className="bg-gray-800 rounded-xl p-2 flex gap-2 items-center border border-gray-700 focus-within:border-blue-500 transition-colors duration-200">
              <input
                type="text"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Type your message..."
                className="flex-1 bg-transparent text-white px-3 py-2 focus:outline-none placeholder-gray-400"
                disabled={isProcessing}
              />
              <button
                onClick={handleSendMessage}
                disabled={isProcessing}
                className="bg-blue-500 text-white p-2 rounded-lg hover:bg-blue-600 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors duration-200"
              >
                {isProcessing ? (
                  <Brain className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkflowManager;
