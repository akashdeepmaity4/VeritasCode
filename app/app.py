import os
import sys
import shutil
import platform
import subprocess
from flask import Flask, render_template, request, jsonify

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))

if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from formatting import format_code, clean_html_to_raw_text, TEXT_EXTENSIONS

app = Flask(
    __name__,
    template_folder=os.path.join(BASE_DIR, 'templates'),
    static_folder=os.path.join(BASE_DIR, 'static')
)


def is_git_path(path: str) -> bool:
    if not path:
        return False
    normalized = os.path.normpath(path).replace('/', os.sep)
    parts = normalized.split(os.sep)
    return '.git' in parts or any(p.startswith('.git') for p in parts)


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/format-content', methods=['POST'])
def format_content():
    """Formats raw text for front-end rendering while preserving indentation."""
    data = request.json or {}
    raw_content = data.get('content', '')
    extension = data.get('extension', '')

    formatted_html = format_code(raw_content, extension)
    return jsonify({
        'status': 'success',
        'content': formatted_html
    })


@app.route('/read-file', methods=['POST'])
def read_file():
    """Reads a file from absolute path on disk and returns formatted HTML."""
    data = request.json or {}
    file_path = data.get('path')

    if is_git_path(file_path):
        return jsonify({'status': 'error', 'message': 'Access to .git files is strictly restricted.'}), 403

    if not file_path or not os.path.isfile(file_path):
        return jsonify({'status': 'error', 'message': 'File not found on disk'}), 400

    ext = file_path.split('.')[-1] if '.' in file_path else ''

    try:
        with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
            raw_content = f.read()

        formatted_html = format_code(raw_content, ext)
        return jsonify({
            'status': 'success',
            'content': formatted_html,
            'is_text_file': ext.lower() in TEXT_EXTENSIONS
        })
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500


@app.route('/save-file', methods=['POST'])
def save_file():
    """Converts HTML content back to raw text with intact indentation and saves to disk."""
    data = request.json or {}
    file_path = data.get('path')
    html_content = data.get('content', '')

    if is_git_path(file_path):
        return jsonify({'status': 'error', 'message': 'Saving to .git files is strictly restricted.'}), 403

    if not file_path:
        return jsonify({'status': 'error', 'message': 'No file path specified'}), 400

    try:
        raw_text = clean_html_to_raw_text(html_content)
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(raw_text)

        return jsonify({'status': 'success'})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500


@app.route('/create-file', methods=['POST'])
def create_file():
    data = request.json or {}
    target_dir = data.get('target_dir', '')
    name = data.get('name', '')

    full_path = os.path.join(target_dir, name)

    if is_git_path(full_path) or name == '.git':
        return jsonify({'status': 'error', 'message': 'Cannot create files inside .git directory.'}), 403

    if not target_dir or not name:
        return jsonify({'status': 'error', 'message': 'Missing directory or filename'}), 400

    try:
        if os.path.exists(full_path):
            return jsonify({'status': 'error', 'message': 'File already exists'}), 400

        with open(full_path, 'w', encoding='utf-8') as f:
            f.write('')

        return jsonify({'status': 'success', 'path': full_path})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500


@app.route('/open-terminal', methods=['POST'])
def open_terminal():
    data = request.json or {}
    target_dir = data.get('dir') or os.path.expanduser('~')

    if not os.path.exists(target_dir):
        target_dir = os.path.expanduser('~')

    try:
        system = platform.system().lower()

        if system == 'windows':
            git_bash = shutil.which('bash') or r"C:\Program Files\Git\git-bash.exe"
            if os.path.exists(git_bash):
                subprocess.Popen([git_bash], cwd=target_dir)
                return jsonify({'status': 'success', 'launched': 'git-bash'})

            subprocess.Popen('start cmd', shell=True, cwd=target_dir)
            return jsonify({'status': 'success', 'launched': 'cmd'})

        elif system == 'darwin':
            subprocess.Popen(['open', '-a', 'Terminal', target_dir])
            return jsonify({'status': 'success', 'launched': 'macOS Terminal'})

        else:
            if shutil.which('gnome-terminal'):
                subprocess.Popen(['gnome-terminal', f'--working-directory={target_dir}'])
            elif shutil.which('x-terminal-emulator'):
                subprocess.Popen(['x-terminal-emulator'], cwd=target_dir)
            elif shutil.which('xterm'):
                subprocess.Popen(['xterm'], cwd=target_dir)
            else:
                return jsonify({'status': 'error', 'message': 'No supported terminal found'}), 404

            return jsonify({'status': 'success', 'launched': 'linux-terminal'})

    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/create-folder', methods=['POST'])
def create_folder():
    """Creates a new directory inside target directory."""
    data = request.json or {}
    target_dir = data.get('target_dir', '')
    name = data.get('name', '')

    full_path = os.path.join(target_dir, name)

    if is_git_path(full_path) or name == '.git':
        return jsonify({'status': 'error', 'message': 'Cannot create .git folders.'}), 403

    if not target_dir or not name:
        return jsonify({'status': 'error', 'message': 'Missing directory or folder name'}), 400

    try:
        os.makedirs(full_path, exist_ok=True)
        return jsonify({'status': 'success', 'path': full_path})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500


@app.route('/run-file', methods=['POST'])
def run_file():
    data = request.json or {}
    file_path = data.get('path')

    if is_git_path(file_path):
        return jsonify({'status': 'error', 'message': 'Execution of files inside .git is prohibited.'}), 403

    if not file_path or not os.path.isfile(file_path):
        return jsonify({'status': 'error', 'message': 'File not found'}), 400

    ext = file_path.split('.')[-1].lower() if '.' in file_path else ''

    cmd_map = {
        'py': ['python', file_path],
        'js': ['node', file_path],
        'sh': ['bash', file_path]
    }

    if ext not in cmd_map:
        return jsonify({'status': 'error', 'message': f'Execution not configured for .{ext} files'}), 400

    try:
        result = subprocess.run(cmd_map[ext], capture_output=True, text=True, timeout=10)
        return jsonify({
            'status': 'success',
            'stdout': result.stdout,
            'stderr': result.stderr
        })
    except subprocess.TimeoutExpired:
        return jsonify({'status': 'error', 'message': 'Execution timed out (10s threshold)'}), 500
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500


if __name__ == '__main__':
    app.run(debug=True, port=5000)