from flask import Flask, render_template, request, jsonify
import os
import random
from dotenv import load_dotenv
from openai import OpenAI
from config import RECRUITING_PROMPT, TRAINING_PROMPT, CUSTOMIZE_PROMPT, PRACTICE_PROMPT_TEMPLATE, PRACTICE_PERSONAS
from database import (
    init_db, create_conversation, add_message, get_conversations,
    get_conversation, delete_conversation, update_conversation_title,
    get_custom_prompt, save_custom_prompt,
)

load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", os.urandom(24).hex())

MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

init_db()


def get_system_prompt(mode):
    if mode == "training":
        return TRAINING_PROMPT
    if mode == "customize":
        return CUSTOMIZE_PROMPT
    if mode == "practice":
        persona = random.choice(PRACTICE_PERSONAS)
        return PRACTICE_PROMPT_TEMPLATE.format(
            persona=persona["persona"],
            situation=persona["situation"],
        )
    # For recruiting, check if there's a custom prompt saved
    custom = get_custom_prompt("recruiting")
    if custom:
        return custom
    return RECRUITING_PROMPT


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/chat", methods=["POST"])
def chat():
    data = request.get_json()
    user_message = data.get("message", "").strip()
    mode = data.get("mode", "recruiting")
    history = data.get("history", [])
    conversation_id = data.get("conversation_id")
    persona_index = data.get("persona_index")

    if not user_message:
        return jsonify({"error": "Message is required"}), 400

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return jsonify({"error": "OpenAI API key not configured. Add OPENAI_API_KEY to your .env file."}), 500

    if not conversation_id:
        title = user_message[:50] + ("..." if len(user_message) > 50 else "")
        conversation_id = create_conversation(title, mode)

    add_message(conversation_id, "user", user_message)

    # Get the right system prompt
    if mode == "practice" and persona_index is not None:
        persona = PRACTICE_PERSONAS[int(persona_index) % len(PRACTICE_PERSONAS)]
        system_prompt = PRACTICE_PROMPT_TEMPLATE.format(
            persona=persona["persona"],
            situation=persona["situation"],
        )
    else:
        system_prompt = get_system_prompt(mode)

    messages = [{"role": "system", "content": system_prompt}]
    for msg in history:
        messages.append({"role": msg["role"], "content": msg["content"]})
    messages.append({"role": "user", "content": user_message})

    try:
        client = OpenAI(api_key=api_key)
        response = client.chat.completions.create(
            model=MODEL,
            messages=messages,
            temperature=0.7,
            max_tokens=1500,
        )
        reply = response.choices[0].message.content

        # Check if customize mode generated a prompt
        prompt_saved = False
        if mode == "customize" and "---PROMPT_READY---" in reply:
            prompt_start = reply.index("---PROMPT_READY---") + len("---PROMPT_READY---")
            prompt_end = reply.index("---END_PROMPT---")
            new_prompt = reply[prompt_start:prompt_end].strip()
            save_custom_prompt("recruiting", new_prompt)
            prompt_saved = True

        # Check if practice mode found learned techniques
        learned = None
        if mode == "practice" and "---LEARNED---" in reply:
            learn_start = reply.index("---LEARNED---") + len("---LEARNED---")
            learn_end = reply.index("---END_LEARNED---")
            learned = reply[learn_start:learn_end].strip()
            # Append learned techniques to the custom recruiting prompt
            current_prompt = get_custom_prompt("recruiting")
            if current_prompt and learned:
                updated = current_prompt + "\n\nTechniques learned from practice sessions:\n" + learned
                save_custom_prompt("recruiting", updated)

        add_message(conversation_id, "assistant", reply)

        result = {"reply": reply, "conversation_id": conversation_id}
        if prompt_saved:
            result["prompt_saved"] = True
        if learned:
            result["techniques_learned"] = True
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/conversations", methods=["GET"])
def list_conversations():
    conversations = get_conversations()
    return jsonify({"conversations": conversations})


@app.route("/api/conversations/<int:conv_id>", methods=["GET"])
def get_single_conversation(conv_id):
    conv = get_conversation(conv_id)
    if not conv:
        return jsonify({"error": "Conversation not found"}), 404
    return jsonify({"conversation": conv})


@app.route("/api/conversations/<int:conv_id>", methods=["DELETE"])
def delete_single_conversation(conv_id):
    delete_conversation(conv_id)
    return jsonify({"success": True})


@app.route("/api/conversations/<int:conv_id>/title", methods=["PATCH"])
def update_title(conv_id):
    data = request.get_json()
    title = data.get("title", "").strip()
    if not title:
        return jsonify({"error": "Title is required"}), 400
    update_conversation_title(conv_id, title)
    return jsonify({"success": True})


@app.route("/api/personas", methods=["GET"])
def get_personas():
    return jsonify({
        "personas": [
            {"index": i, "name": p["name"], "description": p["situation"]}
            for i, p in enumerate(PRACTICE_PERSONAS)
        ]
    })


@app.route("/api/custom-prompt", methods=["GET"])
def get_prompt():
    prompt = get_custom_prompt("recruiting")
    return jsonify({"has_custom": prompt is not None})


if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    debug = os.getenv("FLASK_DEBUG", "true").lower() == "true"
    app.run(debug=debug, port=port)
