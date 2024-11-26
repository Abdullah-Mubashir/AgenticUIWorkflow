# WorkIron AI Workflow Manager

A powerful React-based multi-agent AI conversation interface that allows you to create and manage dynamic AI workflows. This application enables sequential processing of user prompts through configurable AI agents, providing a flexible and powerful way to chain AI interactions.

## Features

- **Dynamic AI Agent Configuration**
  - Add, edit, duplicate, and remove agents
  - Configure agent properties:
    - Name and role
    - System prompt
    - Temperature (0-2)
    - Max tokens (1-4000)
    - Processing order

- **Advanced Conversation Interface**
  - Sequential AI agent processing
  - Real-time message rendering
  - Context preservation across agent interactions
  - Scrollable chat history

- **Response Display Modes**
  - Toggle between showing all agent responses
  - Option to show only first and last agent responses
  - "Thinking deeply..." placeholder for intermediate agents

- **Persistent Settings**
  - Local storage for agent configurations
  - Save/load functionality for settings
  - Response display preferences

## Tech Stack

- React 18.2.0
- Vite
- TailwindCSS
- OpenAI Assistants API (gpt-4o-mini model)
- Lucide React for icons
- Class Variance Authority

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- OpenAI API key

## Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Abdullah-Mubashir/AgenticUIWorkflow.git
   cd workflow-manager
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   Then edit `.env` and add your OpenAI API key:
   ```
   VITE_OPENAI_API_KEY=your-api-key-here
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

## Usage

1. **Configure AI Agents**
   - Click the gear icon to open settings
   - Add new agents using the "+" button
   - Configure each agent's properties
   - Arrange agents in desired processing order

2. **Start Conversations**
   - Type your message in the chat input
   - Watch as each agent processes the message sequentially
   - Toggle response visibility using display mode options

3. **Manage Settings**
   - Save current configuration for future use
   - Load previous configurations
   - Adjust display preferences

## Security Considerations

- Store your OpenAI API key securely in `.env`
- Never commit `.env` file to version control
- Use environment variables for all sensitive data

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- OpenAI for their powerful AI models
- React team for the excellent framework
- TailwindCSS team for the utility-first CSS framework

## Support

For support, please open an issue in the GitHub repository or contact the maintainers.

---

Built with using React and OpenAI
