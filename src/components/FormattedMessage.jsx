import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

const FormattedMessage = ({ content, agentName }) => {
  const [copiedParts, setCopiedParts] = useState({});

  const copyToClipboard = async (text, partIndex) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedParts(prev => ({ ...prev, [partIndex]: true }));
      setTimeout(() => {
        setCopiedParts(prev => ({ ...prev, [partIndex]: false }));
      }, 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  // Function to detect if content contains code blocks
  const hasCodeBlock = (text) => {
    return text.includes('```');
  };

  // Function to format text with code blocks
  const formatText = (text) => {
    if (!hasCodeBlock(text)) {
      return <p className="whitespace-pre-wrap">{text}</p>;
    }

    const parts = text.split(/(```[\s\S]*?```)/g);
    return parts.map((part, index) => {
      if (part.startsWith('```') && part.endsWith('```')) {
        const code = part.slice(3, -3);
        const language = code.split('\n')[0].trim();
        const codeContent = language ? code.slice(language.length + 1).trim() : code.trim();
        
        return (
          <div key={index} className="relative mt-4 mb-4">
            <div className="flex items-center justify-between bg-gray-800 rounded-t-lg px-4 py-2">
              <span className="text-sm text-gray-400">{language || 'code'}</span>
              <button
                onClick={() => copyToClipboard(codeContent, index)}
                className="text-gray-400 hover:text-white transition-colors"
                title="Copy code"
              >
                {copiedParts[index] ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </div>
            <pre className="bg-gray-900 rounded-b-lg p-4 overflow-x-auto">
              <code className="text-sm text-gray-300">{codeContent}</code>
            </pre>
          </div>
        );
      }
      return <p key={index} className="whitespace-pre-wrap">{part}</p>;
    });
  };

  return (
    <div className="flex flex-col space-y-2">
      <div className="flex items-start justify-between">
        <span className="text-sm font-medium text-blue-500">{agentName}</span>
        {!hasCodeBlock(content) && (
          <button
            onClick={() => copyToClipboard(content, 'full')}
            className="text-gray-400 hover:text-white transition-colors"
            title="Copy message"
          >
            {copiedParts['full'] ? <Check size={16} /> : <Copy size={16} />}
          </button>
        )}
      </div>
      <div className="prose prose-invert max-w-none">
        {formatText(content)}
      </div>
    </div>
  );
};

export default FormattedMessage;
