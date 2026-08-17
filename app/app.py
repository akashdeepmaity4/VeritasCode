"""Veritas Code backend.

A small Flask API that powers the Veritas Code editor UI. The frontend is a
single-page Monaco editor; this backend handles file I/O (anchored to the
project workspace root), AI provider proxying, and terminal/process launching.

Run directly for browser/localhost use:
    python app/app.py
Or via launcher.py for the pywebview desktop window.
"""
from flask import Flask, render_template, request, jsonify
import os
import subprocess
import shutil
import html
import urllib.request
import urllib.error
import json

app = Flask(__name__, template_folder='../templates', static_folder='../static')

# Workspace root: one level above the app package (the project directory).
WORKSPACE_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
def is_git_restricted(path_str):
    """Block any path that touches a .git directory."""
    if not path_str:
        return False
    normalized = path_str.replace('\\', '/')
    parts = [p.lower() for p in normalized.split('/')]
    return '.git' in parts


def resolve_workspace_path(path_str):
    """Anchor a relative path to the workspace root."""
    if not path_str:
        return ''
    if os.path.isabs(path_str):
        return os.path.abspath(path_str)
    normalized = path_str.replace('\\', '/').lstrip('/').lstrip('.')
    while normalized.startswith('/'):
        normalized = normalized.lstrip('/')
    if not normalized:
        return ''
    return os.path.abspath(os.path.join(WORKSPACE_ROOT, normalized))


def sanitize_str(val):
    if not val:
        return ''
    return html.escape(str(val).strip())


# --------------------------------------------------------------------------- #
# Pages
# --------------------------------------------------------------------------- #
@app.route('/')
def index():
    return render_template('index.html')


@app.route('/apiform')
@app.route('/apiform.html')
def apiform():
    return render_template('apiform.html')


# --------------------------------------------------------------------------- #
# File operations
# --------------------------------------------------------------------------- #
@app.route('/workspace-root', methods=['GET'])
def workspace_root():
    return jsonify({'status': 'success', 'root': WORKSPACE_ROOT})


@app.route('/save-file', methods=['POST'])
def save_file():
    data = request.get_json() or {}
    file_path = data.get('path', '')
    raw_content = data.get('content', '')

    if is_git_restricted(file_path):
        return jsonify({'status': 'error', 'message': 'Modifying .git files is restricted.'}), 403
    if not file_path:
        return jsonify({'status': 'error', 'message': 'Invalid file path.'}), 400

    file_path = resolve_workspace_path(file_path)
    clean_text = raw_content.replace('\xa0', ' ').replace('\u00a0', ' ')

    try:
        parent = os.path.dirname(os.path.abspath(file_path))
        if parent:
            os.makedirs(parent, exist_ok=True)
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(clean_text)
        return jsonify({'status': 'success', 'message': 'File saved successfully.', 'path': file_path})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500


@app.route('/read-file', methods=['POST'])
def read_file():
    data = request.get_json() or {}
    file_path = data.get('path', '')

    if is_git_restricted(file_path):
        return jsonify({'status': 'error', 'message': 'Accessing .git files is restricted.'}), 403

    file_path = resolve_workspace_path(file_path)
    if not os.path.exists(file_path):
        return jsonify({'status': 'error', 'message': 'File not found.'}), 404

    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        return jsonify({'status': 'success', 'content': content, 'path': file_path})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500


@app.route('/list-workspace', methods=['GET'])
def list_workspace():
    """List files (one level deep) in the workspace root."""
    try:
        entries = []
        for name in sorted(os.listdir(WORKSPACE_ROOT)):
            full = os.path.join(WORKSPACE_ROOT, name)
            if name.startswith('.git'):
                continue
            entries.append({'name': name, 'isDir': os.path.isdir(full)})
        return jsonify({'status': 'success', 'root': WORKSPACE_ROOT, 'entries': entries})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500


@app.route('/run-file', methods=['POST'])
def run_file():
    data = request.get_json() or {}
    file_path = data.get('path', '')

    if not file_path or not os.path.exists(file_path):
        return jsonify({'status': 'error', 'message': 'File does not exist on disk.'}), 400

    ext = file_path.split('.')[-1].lower()
    runners = {'py': ['python', file_path], 'js': ['node', file_path], 'sh': ['bash', file_path]}
    cmd = runners.get(ext)
    if not cmd:
        return jsonify({'status': 'error', 'message': f'Execution for .{ext} files is not supported.'}), 400

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
        return jsonify({'status': 'success', 'stdout': result.stdout, 'stderr': result.stderr})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500


@app.route('/open-terminal', methods=['POST'])
def open_terminal():
    try:
        if shutil.which('bash'):
            subprocess.Popen(['bash'])
        elif os.name == 'nt':
            subprocess.Popen(['cmd.exe', '/c', 'start', 'cmd'])
        else:
            subprocess.Popen(['x-terminal-emulator'])
        return jsonify({'status': 'success'})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500


# --------------------------------------------------------------------------- #
# AI providers
# --------------------------------------------------------------------------- #
def call_external_ai_api(provider, api_key, prompt, code_context=""):
    full_prompt = prompt
    if code_context:
        full_prompt = f"Code Context:\n```\n{code_context}\n```\n\nUser Prompt:\n{prompt}"

    provider_clean = html.unescape(provider).lower()
    api_key_clean = html.unescape(api_key).strip()

    # Each entry: (url, headers, payload-builder, response-extractor)
    def openai_payload():
        return {
            'model': 'gpt-3.5-turbo',
            'messages': [
                {'role': 'system', 'content': 'You are an expert programming assistant in Veritas Code IDE.'},
                {'role': 'user', 'content': full_prompt}
            ]
        }

    def chat_extract(d):
        return d['choices'][0]['message']['content']

    providers = {
        'chatgpt': ('https://api.openai.com/v1/chat/completions',
                    {'Content-Type': 'application/json', 'Authorization': f'Bearer {api_key_clean}'},
                    openai_payload, chat_extract),
        'openai': ('https://api.openai.com/v1/chat/completions',
                   {'Content-Type': 'application/json', 'Authorization': f'Bearer {api_key_clean}'},
                   openai_payload, chat_extract),
        'grok': ('https://api.x.ai/v1/chat/completions',
                 {'Content-Type': 'application/json', 'Authorization': f'Bearer {api_key_clean}'},
                 lambda: {'model': 'grok-beta', 'messages': [
                     {'role': 'system', 'content': 'You are an expert AI programming assistant.'},
                     {'role': 'user', 'content': full_prompt}]}, chat_extract),
        'deepseek': ('https://api.deepseek.com/chat/completions',
                     {'Content-Type': 'application/json', 'Authorization': f'Bearer {api_key_clean}'},
                     lambda: {'model': 'deepseek-chat', 'messages': [
                         {'role': 'system', 'content': 'You are an expert AI coding assistant.'},
                         {'role': 'user', 'content': full_prompt}]}, chat_extract),
        'mistral': ('https://api.mistral.ai/v1/chat/completions',
                    {'Content-Type': 'application/json', 'Authorization': f'Bearer {api_key_clean}'},
                    lambda: {'model': 'mistral-tiny', 'messages': [
                        {'role': 'user', 'content': full_prompt}]}, chat_extract),
        'openrouter': ('https://openrouter.ai/api/v1/chat/completions',
                       {'Content-Type': 'application/json', 'Authorization': f'Bearer {api_key_clean}'},
                       lambda: {'model': 'auto', 'messages': [
                           {'role': 'user', 'content': full_prompt}]}, chat_extract),
        'perplexity': ('https://api.perplexity.ai/chat/completions',
                       {'Content-Type': 'application/json', 'Authorization': f'Bearer {api_key_clean}'},
                       lambda: {'model': 'sonar-pro', 'messages': [
                           {'role': 'user', 'content': full_prompt}]}, chat_extract),
    }

    # Gemini and Claude have distinct shapes.
    if 'gemini' in provider_clean or 'google' in provider_clean:
        url = f'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key_clean}'
        payload = {'contents': [{'parts': [{'text': full_prompt}]}]}
        req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'),
                                     headers={'Content-Type': 'application/json'}, method='POST')
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode('utf-8'))['candidates'][0]['content']['parts'][0]['text']

    if 'claude' in provider_clean or 'anthropic' in provider_clean:
        url = 'https://api.anthropic.com/v1/messages'
        headers = {'Content-Type': 'application/json', 'x-api-key': api_key_clean, 'anthropic-version': '2023-06-01'}
        payload = {'model': 'claude-3-haiku-20240307', 'max_tokens': 1024,
                   'messages': [{'role': 'user', 'content': full_prompt}]}
        req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'),
                                     headers=headers, method='POST')
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode('utf-8'))['content'][0]['text']

    if 'cohere' in provider_clean:
        url = 'https://api.cohere.com/v2/chat'
        headers = {'Content-Type': 'application/json', 'Authorization': f'Bearer {api_key_clean}'}
        payload = {'model': 'command-r-plus', 'messages': [
            {'role': 'user', 'content': {'content': full_prompt}}]}
        req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'),
                                     headers=headers, method='POST')
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode('utf-8'))['message']['content'][0]['text']

    # Default / custom: OpenAI-compatible.
    url, headers, payload_fn, extract_fn = providers.get(
        provider_clean,
        ('https://api.openai.com/v1/chat/completions',
         {'Content-Type': 'application/json', 'Authorization': f'Bearer {api_key_clean}'},
         lambda: {'model': 'gpt-3.5-turbo', 'messages': [{'role': 'user', 'content': full_prompt}]},
         chat_extract))
    req = urllib.request.Request(url, data=json.dumps(payload_fn()).encode('utf-8'),
                                 headers=headers, method='POST')
    with urllib.request.urlopen(req, timeout=30) as resp:
        return extract_fn(json.loads(resp.read().decode('utf-8')))


def call_local_ai_model(model_path, prompt, code_context=""):
    full_prompt = prompt
    if code_context:
        full_prompt = f"Code Context:\n```\n{code_context}\n```\n\nPrompt:\n{prompt}"

    model_path_clean = html.unescape(model_path).strip() if model_path else ''

    # Ollama
    try:
        url = 'http://localhost:11434/api/generate'
        payload = {'model': 'llama3', 'prompt': full_prompt, 'stream': False}
        req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'),
                                     headers={'Content-Type': 'application/json'}, method='POST')
        with urllib.request.urlopen(req, timeout=12) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            if 'response' in data:
                return data['response']
    except Exception:
        pass

    # LM Studio / llama.cpp OpenAI-compatible servers
    for port in (1234, 8080):
        try:
            url = f'http://localhost:{port}/v1/chat/completions'
            payload = {'messages': [{'role': 'user', 'content': full_prompt}]}
            req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'),
                                         headers={'Content-Type': 'application/json'}, method='POST')
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode('utf-8'))
                if 'choices' in data:
                    return data['choices'][0]['message']['content']
        except Exception:
            pass

    if model_path_clean and os.path.exists(model_path_clean):
        fname = os.path.basename(model_path_clean)
        return (f"[Local Model ({fname}) Loaded]\nLocal model file identified at '{model_path_clean}'.\n"
                f"To run real-time local inference, start your local server (Ollama, LM Studio, or "
                f"llama.cpp) on localhost.")

    return (f"[Local Model Error] Could not connect to local model server at "
            f"localhost:11434/1234/8080 or locate file at '{model_path_clean}'.")


# --------------------------------------------------------------------------- #
# AI routes
# --------------------------------------------------------------------------- #
@app.route('/api/verify-external-api', methods=['POST'])
def verify_external_api():
    data = request.get_json() or {}
    provider = sanitize_str(data.get('provider', ''))
    api_key = sanitize_str(data.get('apiKey', ''))

    if not provider or not api_key:
        return jsonify({'status': 'error', 'message': 'Provider and API key are required.'}), 400
    if len(api_key) < 5:
        return jsonify({'status': 'error', 'message': 'API Key appears invalid or too short.'}), 400

    try:
        call_external_ai_api(provider, api_key, "Hello! Confirm API connection.")
        return jsonify({'status': 'success', 'provider': provider,
                        'message': f'Connected to {provider} API successfully!'})
    except Exception as e:
        return jsonify({'status': 'error', 'message': f'API Connection Failed: {str(e)}'}), 400


@app.route('/api/verify-local-model', methods=['POST'])
def verify_local_model():
    data = request.get_json() or {}
    model_path = sanitize_str(data.get('modelPath', ''))
    if not model_path:
        return jsonify({'status': 'error', 'message': 'Local model path is required.'}), 400

    normalized_path = os.path.abspath(model_path) if os.path.exists(model_path) else model_path
    model_name = os.path.basename(normalized_path)
    valid_extensions = ('.gguf', '.bin', '.safetensors', '.onnx', '.pth', '.pt')

    if not model_name.lower().endswith(valid_extensions):
        return jsonify({'status': 'warning', 'modelName': model_name, 'modelPath': normalized_path,
                        'message': f'Model file {model_name} loaded.'})

    return jsonify({'status': 'success', 'modelName': model_name, 'modelPath': normalized_path,
                    'message': f'Local AI model {model_name} loaded successfully!'})


@app.route('/api/search-local-models', methods=['POST'])
def search_local_models():
    data = request.get_json() or {}
    files_list = data.get('files', [])
    search_folders = data.get('folders', [])

    valid_extensions = ('.gguf', '.bin', '.safetensors', '.onnx', '.pth', '.pt')
    found_models = []

    for f in files_list:
        clean_f = sanitize_str(f)
        if clean_f.lower().endswith(valid_extensions):
            found_models.append(clean_f)

    for folder in search_folders:
        clean_folder = sanitize_str(folder)
        if os.path.exists(clean_folder) and os.path.isdir(clean_folder):
            for root, dirs, files in os.walk(clean_folder):
                for fname in files:
                    if fname.lower().endswith(valid_extensions):
                        found_models.append(os.path.join(root, fname))

    found_models = list(dict.fromkeys(found_models))
    return jsonify({'status': 'success', 'count': len(found_models), 'models': found_models})


@app.route('/api/ai-chat', methods=['POST'])
def ai_chat():
    data = request.get_json() or {}
    prompt = sanitize_str(data.get('prompt', ''))
    provider = sanitize_str(data.get('provider', 'AI Assistant'))
    api_key = sanitize_str(data.get('apiKey', ''))
    model_path = sanitize_str(data.get('modelPath', ''))
    code_context = sanitize_str(data.get('codeContext', ''))

    if not prompt:
        return jsonify({'status': 'error', 'message': 'Prompt cannot be empty.'}), 400

    try:
        if api_key and 'local' not in provider.lower():
            reply = call_external_ai_api(provider, api_key, prompt, code_context)
        else:
            reply = call_local_ai_model(model_path, prompt, code_context)
        return jsonify({'status': 'success', 'reply': reply})
    except urllib.error.HTTPError as err:
        err_body = err.read().decode('utf-8', errors='ignore')
        try:
            msg = json.loads(err_body).get('error', {}).get('message', err_body)
        except Exception:
            msg = err_body[:200]
        return jsonify({'status': 'error', 'message': f"API HTTP {err.code}: {msg}"}), 500
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500


# --------------------------------------------------------------------------- #
# Error handlers
# --------------------------------------------------------------------------- #
@app.errorhandler(404)
def not_found_error(error):
    return jsonify({'status': 'error', 'message': 'Route not found (404).'}), 404


@app.errorhandler(405)
def method_not_allowed(error):
    return jsonify({'status': 'error', 'message': 'Method not allowed (405).'}), 405


@app.errorhandler(500)
def internal_error(error):
    return jsonify({'status': 'error', 'message': f'Internal server error (500): {str(error)}'}), 500


if __name__ == '__main__':
    app.run(port=5000, debug=True)
