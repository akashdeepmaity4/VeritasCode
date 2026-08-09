import os
import sys
import webview

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    from app.app import app
    print("Successfully imported app from app.app")
except ImportError as e:
    print(f"Import error: {e}")
    print("Files in current directory:", os.listdir('.'))
    sys.exit(1)

if __name__ == '__main__':
    webview.create_window('Veritas Code', app)
    webview.start()