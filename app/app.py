from flask import Flask, render_template, request, jsonify
import os
import subprocess
import shutil

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
    
    # Basic HTML escaping for safe canvas rendering
    escaped = (
        raw_content
        .replace('&', '&amp;')
        .replace('<', '&lt;')
        .replace('>', '&gt;')
        .replace('\t', '&nbsp;&nbsp;&nbsp;&nbsp;')
        .replace('  ', '&nbsp;&nbsp;')
        .replace('\n', '<br>')
    )
    return jsonify({'content': escaped})

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
    raw_html = data.get('content', '')

    if is_git_restricted(file_path):
        return jsonify({'status': 'error', 'message': 'Modifying .git files is restricted.'}), 403

    if not file_path:
        return jsonify({'status': 'error', 'message': 'Invalid file path.'}), 400

    # Sanitize innerHTML back to plain text
    clean_text = (
        raw_html
        .replace('<div>', '\n')
        .replace('</div>', '')
        .replace('<p>', '\n')
        .replace('</p>', '')
        .replace('<br>', '\n')
        .replace('&nbsp;&nbsp;&nbsp;&nbsp;', '\t')
        .replace('&nbsp;&nbsp;', '  ')
        .replace('&nbsp;', ' ')
        .replace('&lt;', '<')
        .replace('&gt;', '>')
        .replace('&amp;', '&')
    )

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

if __name__ == '__main__':
    app.run(port=5000, debug=True)