# SalesBot — AI Sales Recruiting & Training Chatbot

An AI-powered chatbot with two modes:
- **Recruiting Mode** — Engages and recruits potential salespeople
- **Training Mode** — Coaches and trains your sales team

## Quick Start

### 1. Install Python dependencies

```bash
pip install -r requirements.txt
```

### 2. Set up your API key

Copy the example env file and add your OpenAI API key:

```bash
cp .env.example .env
```

Then edit `.env` and replace `sk-your-api-key-here` with your actual OpenAI API key.

You can get an API key at: https://platform.openai.com/api-keys

### 3. Run the chatbot

```bash
python app.py
```

Open your browser to **http://localhost:5000** and start chatting!

## Features

- 🎯 **Recruiting Mode** — Trained to attract and engage potential sales recruits
- 📈 **Training Mode** — Teaches sales techniques, scripts, objection handling, and more
- 💬 **Quick Topics** — Pre-built conversation starters for each mode
- 🧠 **Conversation Memory** — Remembers context within a chat session
- ⚡ **Modern UI** — Clean, responsive dark-themed chat interface

## Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_API_KEY` | Your OpenAI API key | (required) |
| `OPENAI_MODEL` | GPT model to use | `gpt-4o-mini` |
| `SECRET_KEY` | Flask session secret | (auto-generated) |
| `PORT` | Server port | `5000` |

## Customization

Edit the system prompts in `config.py` to customize the chatbot's personality, talking points, and training curriculum to match your specific sales organization.
