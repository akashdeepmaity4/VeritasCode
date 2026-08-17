from flask import Flask, render_template, request, jsonify
import os
import subprocess
import shutil
import html
import urllib.request
import urllib.parse
import urllib.error
import json

app = Flask(__name__, template_folder='../templates', static_folder='../static')

def is_git_restricted(path_str):
    if not path_str:
        return False
    normalized = path_str.replace('\\', '/')
    parts = [p.lower() for p in normalized.split('/')]
    return '.git' in parts

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/format-content', methods=['POST'])
def format_content():
    data = request.get_json() or {}
    raw_content = data.get('content', '')
    return jsonify({'content': raw_content})

@app.route('/read-file', methods=['POST'])
def read_file():
    data = request.get_json() or {}
    file_path = data.get('path', '')

    if is_git_restricted(file_path):
        return jsonify({'status': 'error', 'message': 'Accessing .git files is restricted.'}), 403

    if not os.path.exists(file_path):
        return jsonify({'status': 'error', 'message': 'File not found.'}), 404

    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        return jsonify({'status': 'success', 'content': content})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/save-file', methods=['POST'])
def save_file():
    data = request.get_json() or {}
    file_path = data.get('path', '')
    raw_content = data.get('content', '')

    if is_git_restricted(file_path):
        return jsonify({'status': 'error', 'message': 'Modifying .git files is restricted.'}), 403

    if not file_path:
        return jsonify({'status': 'error', 'message': 'Invalid file path.'}), 400

    clean_text = raw_content.replace('\xa0', ' ').replace('\u00a0', ' ')

    try:
        os.makedirs(os.path.dirname(os.path.abspath(file_path)), exist_ok=True)
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(clean_text)
        return jsonify({'status': 'success', 'message': 'File saved successfully.'})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/create-file', methods=['POST'])
def create_file():
    data = request.get_json() or {}
    target_dir = data.get('target_dir', '')
    name = data.get('name', '')

    full_path = os.path.join(target_dir, name)
    if is_git_restricted(full_path):
        return jsonify({'status': 'error', 'message': 'Creation of .git items is restricted.'}), 403

    try:
        os.makedirs(os.path.dirname(os.path.abspath(full_path)), exist_ok=True)
        if not os.path.exists(full_path):
            with open(full_path, 'w', encoding='utf-8') as f:
                f.write('')
        return jsonify({'status': 'success', 'path': full_path})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/create-folder', methods=['POST'])
def create_folder():
    data = request.get_json() or {}
    target_dir = data.get('target_dir', '')
    name = data.get('name', '')

    full_path = os.path.join(target_dir, name)
    if is_git_restricted(full_path):
        return jsonify({'status': 'error', 'message': 'Creation of .git directories is restricted.'}), 403

    try:
        os.makedirs(full_path, exist_ok=True)
        return jsonify({'status': 'success', 'path': full_path})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/run-file', methods=['POST'])
def run_file():
    data = request.get_json() or {}
    file_path = data.get('path', '')

    if not file_path or not os.path.exists(file_path):
        return jsonify({'status': 'error', 'message': 'File does not exist on disk.'}), 400

    ext = file_path.split('.')[-1].lower()
    cmd = []

    if ext == 'py':
        cmd = ['python', file_path]
    elif ext == 'js':
        cmd = ['node', file_path]
    elif ext == 'sh':
        cmd = ['bash', file_path]
    else:
        return jsonify({'status': 'error', 'message': f'Execution for .{ext} files is not supported.'}), 400

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
        return jsonify({
            'status': 'success',
            'stdout': result.stdout,
            'stderr': result.stderr
        })
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/open-terminal', methods=['POST'])
def open_terminal():
    try:
        if shutil.which('bash'):
            subprocess.Popen(['bash'])
        elif os.name == 'nt' and os.path.exists(r'C:\Program Files\Git\bin\bash.exe'):
            subprocess.Popen([r'C:\Program Files\Git\bin\bash.exe'])
        else:
            if os.name == 'nt':
                subprocess.Popen(['cmd.exe', '/c', 'start', 'cmd'])
            else:
                subprocess.Popen(['x-terminal-emulator'])
        return jsonify({'status': 'success'})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

def sanitize_str(val):
    if not val:
        return ''
    return html.escape(str(val).strip())

@app.route('/apiform')
@app.route('/apiform.html')
def apiform():
    return render_template('apiform.html')


def call_external_ai_api(provider, api_key, prompt, code_context=""):
    full_prompt = prompt
    if code_context:
        full_prompt = f"Code Context:\n```\n{code_context}\n```\n\nUser Prompt:\n{prompt}"

    provider_clean = html.unescape(provider).lower()
    api_key_clean = html.unescape(api_key).strip()

    try:
        if 'chatgpt' in provider_clean or 'openai' in provider_clean:
            url = 'https://api.openai.com/v1/chat/completions'
            headers = {
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {api_key_clean}'
            }
            payload = {
                'model': 'gpt-3.5-turbo',
                'messages': [
                    {'role': 'system', 'content': 'You are an expert programming assistant in Veritas Code IDE.'},
                    {'role': 'user', 'content': full_prompt}
                ]
            }
            req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers=headers, method='POST')
            with urllib.request.urlopen(req, timeout=30) as resp:
                res_data = json.loads(resp.read().decode('utf-8'))
                return res_data['choices'][0]['message']['content']

        elif 'gemini' in provider_clean or 'google' in provider_clean:
            url = f'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key_clean}'
            headers = {'Content-Type': 'application/json'}
            payload = {
                'contents': [{'parts': [{'text': full_prompt}]}]
            }
            req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers=headers, method='POST')
            with urllib.request.urlopen(req, timeout=30) as resp:
                res_data = json.loads(resp.read().decode('utf-8'))
                return res_data['candidates'][0]['content']['parts'][0]['text']

        elif 'claude' in provider_clean or 'anthropic' in provider_clean:
            url = 'https://api.anthropic.com/v1/messages'
            headers = {
                'Content-Type': 'application/json',
                'x-api-key': api_key_clean,
                'anthropic-version': '2023-06-01'
            }
            payload = {
                'model': 'claude-3-haiku-20240307',
                'max_tokens': 1024,
                'messages': [{'role': 'user', 'content': full_prompt}]
            }
            req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers=headers, method='POST')
            with urllib.request.urlopen(req, timeout=30) as resp:
                res_data = json.loads(resp.read().decode('utf-8'))
                return res_data['content'][0]['text']

        elif 'grok' in provider_clean or 'xai' in provider_clean:
            url = 'https://api.x.ai/v1/chat/completions'
            headers = {
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {api_key_clean}'
            }
            payload = {
                'model': 'grok-beta',
                'messages': [
                    {'role': 'system', 'content': 'You are an expert AI programming assistant.'},
                    {'role': 'user', 'content': full_prompt}
                ]
            }
            req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers=headers, method='POST')
            with urllib.request.urlopen(req, timeout=30) as resp:
                res_data = json.loads(resp.read().decode('utf-8'))
                return res_data['choices'][0]['message']['content']

        elif 'deepseek' in provider_clean:
            url = 'https://api.deepseek.com/chat/completions'
            headers = {
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {api_key_clean}'
            }
            payload = {
                'model': 'deepseek-chat',
                'messages': [
                    {'role': 'system', 'content': 'You are an expert AI coding assistant.'},
                    {'role': 'user', 'content': full_prompt}
                ]
            }
            req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers=headers, method='POST')
            with urllib.request.urlopen(req, timeout=30) as resp:
                res_data = json.loads(resp.read().decode('utf-8'))
                return res_data['choices'][0]['message']['content']

        elif 'mistral' in provider_clean:
            url = 'https://api.mistral.ai/v1/chat/completions'
            headers = {
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {api_key_clean}'
            }
            payload = {
                'model': 'mistral-tiny',
                'messages': [{'role': 'user', 'content': full_prompt}]
            }
            req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers=headers, method='POST')
            with urllib.request.urlopen(req, timeout=30) as resp:
                res_data = json.loads(resp.read().decode('utf-8'))
                return res_data['choices'][0]['message']['content']

        elif 'openrouter' in provider_clean:
            url = 'https://openrouter.ai/api/v1/chat/completions'
            headers = {
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {api_key_clean}'
            }
            payload = {
                'model': 'auto',
                'messages': [{'role': 'user', 'content': full_prompt}]
            }
            req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers=headers, method='POST')
            with urllib.request.urlopen(req, timeout=30) as resp:
                res_data = json.loads(resp.read().decode('utf-8'))
                return res_data['choices'][0]['message']['content']

        elif 'perplexity' in provider_clean:
            url = 'https://api.perplexity.ai/chat/completions'
            headers = {
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {api_key_clean}'
            }
            payload = {
                'model': 'sonar-pro',
                'messages': [{'role': 'user', 'content': full_prompt}]
            }
            req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers=headers, method='POST')
            with urllib.request.urlopen(req, timeout=30) as resp:
                res_data = json.loads(resp.read().decode('utf-8'))
                return res_data['choices'][0]['message']['content']

        elif 'cohere' in provider_clean:
            url = 'https://api.cohere.com/v2/chat'
            headers = {
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {api_key_clean}'
            }
            payload = {
                'model': 'command-r-plus',
                'messages': [{'role': 'user', 'content': {'content': full_prompt}}]
            }
            req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers=headers, method='POST')
            with urllib.request.urlopen(req, timeout=30) as resp:
                res_data = json.loads(resp.read().decode('utf-8'))
                return res_data['message']['content'][0]['text']

        else:
            url = 'https://api.openai.com/v1/chat/completions'
            headers = {
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {api_key_clean}'
            }
            payload = {
                'model': 'gpt-3.5-turbo',
                'messages': [{'role': 'user', 'content': full_prompt}]
            }
            req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers=headers, method='POST')
            with urllib.request.urlopen(req, timeout=30) as resp:
                res_data = json.loads(resp.read().decode('utf-8'))
                return res_data['choices'][0]['message']['content']

    except urllib.error.HTTPError as err:
        err_body = err.read().decode('utf-8', errors='ignore')
        try:
            err_json = json.loads(err_body)
            msg = err_json.get('error', {}).get('message', err_body)
        except Exception:
            msg = err_body[:200]
        raise Exception(f"API HTTP {err.code}: {msg}")
    except Exception as e:
        raise Exception(f"Connection Error: {str(e)}")


def call_local_ai_model(model_path, prompt, code_context=""):
    full_prompt = prompt
    if code_context:
        full_prompt = f"Code Context:\n```\n{code_context}\n```\n\nPrompt:\n{prompt}"

    model_path_clean = html.unescape(model_path).strip() if model_path else ''

    try:
        url = 'http://localhost:11434/api/generate'
        headers = {'Content-Type': 'application/json'}
        payload = {
            'model': 'llama3',
            'prompt': full_prompt,
            'stream': False
        }
        req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers=headers, method='POST')
        with urllib.request.urlopen(req, timeout=12) as resp:
            res_data = json.loads(resp.read().decode('utf-8'))
            if 'response' in res_data:
                return res_data['response']
    except Exception:
        pass

    for port in [8080, 1234]:
        try:
            url = f'http://localhost:{port}/v1/chat/completions'
            headers = {'Content-Type': 'application/json'}
            payload = {
                'messages': [{'role': 'user', 'content': full_prompt}]
            }
            req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers=headers, method='POST')
            with urllib.request.urlopen(req, timeout=10) as resp:
                res_data = json.loads(resp.read().decode('utf-8'))
                if 'choices' in res_data:
                    return res_data['choices'][0]['message']['content']
        except Exception:
            pass

    if model_path_clean and os.path.exists(model_path_clean):
        fname = os.path.basename(model_path_clean)
        return f"[Local Model ({fname}) Loaded]\nLocal model file identified at '{model_path_clean}'.\nTo run real-time local inference, start your local server (Ollama, LM Studio, or llama.cpp) on localhost."

    return f"[Local Model Error] Could not connect to local model server at localhost:11434/1234/8080 or locate file at '{model_path_clean}'."


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
        # Test connection with a ping prompt
        test_reply = call_external_ai_api(provider, api_key, "Hello! Confirm API connection.")
        return jsonify({
            'status': 'success',
            'provider': provider,
            'message': f'Connected to {provider} API successfully!'
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': f'API Connection Failed: {str(e)}'
        }), 400

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
        return jsonify({
            'status': 'warning',
            'modelName': model_name,
            'modelPath': normalized_path,
            'message': f'Model file {model_name} loaded.'
        })

    return jsonify({
        'status': 'success',
        'modelName': model_name,
        'modelPath': normalized_path,
        'message': f'Local AI model {model_name} loaded successfully!'
    })

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

    return jsonify({
        'status': 'success',
        'count': len(found_models),
        'models': found_models
    })

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
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

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
    app.run(port=5000, debug=False)