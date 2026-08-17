import os
import sys
import webview

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    from app.app import app, DesktopApi
except ImportError:
    from app.app import app
    DesktopApi = None

if __name__ == "__main__":
    api = DesktopApi() if DesktopApi else None
    window = webview.create_window(
        title="Veritas Code",
        url=app,
        js_api=api,
        width=1200,
        height=800,
        resizable=True,
    )
    if api and hasattr(api, 'set_window'):
        api.set_window(window)
    webview.start()