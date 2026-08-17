document.addEventListener('DOMContentLoaded', () => {
  // UI Elements
  const sidebar = document.getElementById('sidebar');
  const notesToggleBtn = document.getElementById('notesToggleBtn');
  const logoBtn = document.getElementById('logoBtn');
  const textCanvas = document.getElementById('textCanvas');
  const treeContainer = document.querySelector('.tree-view');
  const saveFileBtn = document.getElementById('saveFileBtn');
  const activeFileName = document.getElementById('activeFileName');

  // File Pickers
  const filePicker = document.getElementById('filePicker');
  const folderPicker = document.getElementById('folderPicker');
  const nativeFilePicker = document.getElementById('native-file-picker');

  // Hidden Fallback File Picker for Save As (Browser Context)
  let saveAsFallbackPicker = document.getElementById('saveAsFallbackPicker');
  if (!saveAsFallbackPicker) {
    saveAsFallbackPicker = document.createElement('input');
    saveAsFallbackPicker.type = 'file';
    saveAsFallbackPicker.id = 'saveAsFallbackPicker';
    saveAsFallbackPicker.style.display = 'none';
    saveAsFallbackPicker.setAttribute('nwsaveas', '');
    document.body.appendChild(saveAsFallbackPicker);
  }

  // Header Dropdown Elements
  const fileMenuBtn = document.getElementById('file-menu-btn');
  const fileDropdown = document.getElementById('file-dropdown');
  const editMenuBtn = document.getElementById('edit-menu-btn');
  const editDropdown = document.getElementById('edit-dropdown');
  const viewMenuBtn = document.getElementById('view-menu-btn');
  const viewDropdown = document.getElementById('view-dropdown');
  const settingsMenuBtn = document.getElementById('settings-menu-btn');
  const settingsDropdown = document.getElementById('settings-dropdown');
  const helpMenuBtn = document.getElementById('help-menu-btn');
  const helpDropdown = document.getElementById('help-dropdown');

  const themeStatusText = document.getElementById('theme-status-text');
  const linesStatusText = document.getElementById('lines-status-text');

  // Settings Sub-Panel Elements
  const fontSettingsToggle = document.getElementById('font-settings-toggle');
  const fontSettingsPanel = document.getElementById('font-settings-panel');
  const fontSizeInput = document.getElementById('fontSizeInput');
  const applyFontSizeBtn = document.getElementById('applyFontSizeBtn');
  const boldToggle = document.getElementById('boldToggle');
  const italicToggle = document.getElementById('italicToggle');

  // Base GitHub Repository URL
  const GITHUB_REPO_URL = 'https://github.com/akashdeepmaity4/VeritasCode/blob/main';

  const gridContainer = document.querySelector('.editor-grid-container');

  // Set Default View Menu Labels
  if (themeStatusText) themeStatusText.textContent = 'Enable Light Mode';
  if (linesStatusText) linesStatusText.textContent = 'Show Line Numbers';

  // Sidebar Action Buttons
  const actionButtons = document.querySelectorAll('.action-btn');
  let actionNewFile = null;
  let actionNewFolder = null;

  actionButtons.forEach(btn => {
    if (btn.textContent.includes('➕') || btn.textContent.includes('+')) actionNewFile = btn;
    if (btn.textContent.includes('📁')) actionNewFolder = btn;
  });

  // State Variables
  let currentRootDir = null;
  let selectedTargetDir = null;
  let currentFilePath = null;
  let currentFileExt = 'py';
  let fileHandle = null;

  let ctrlKPressed = false;
  let ctrlKTimeout = null;

  let monacoEditor = null;
  let isMonacoReady = false;
  let pendingContent = null;
  let pendingFileName = null;

  // --- Monaco Language Mapping ---
  function getMonacoLanguage(ext) {
    if (!ext) return 'plaintext';
    const cleanExt = ext.toLowerCase().replace(/^\./, '');
    const map = {
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'py': 'python',
      'pyw': 'python',
      'html': 'html',
      'htm': 'html',
      'css': 'css',
      'scss': 'scss',
      'less': 'less',
      'json': 'json',
      'md': 'markdown',
      'markdown': 'markdown',
      'c': 'c',
      'h': 'c',
      'cpp': 'cpp',
      'hpp': 'cpp',
      'cc': 'cpp',
      'java': 'java',
      'sh': 'shell',
      'bash': 'shell',
      'zsh': 'shell',
      'yml': 'yaml',
      'yaml': 'yaml',
      'xml': 'xml',
      'sql': 'sql',
      'php': 'php',
      'rb': 'ruby',
      'go': 'go',
      'rs': 'rust',
      'cs': 'csharp',
      'bat': 'bat',
      'ps1': 'powershell',
      'ini': 'ini',
      'dockerfile': 'dockerfile',
      'txt': 'plaintext'
    };
    return map[cleanExt] || 'plaintext';
  }

  // --- Initialize Monaco Editor ---
  function initMonacoEditor() {
    if (typeof require !== 'undefined' && require.config) {
      require.config({
        paths: {
          vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs'
        }
      });

      require(['vs/editor/editor.main'], function () {
        const container = document.getElementById('textCanvas');
        if (!container) return;

        const isLight = document.body.classList.contains('root-light');

        monacoEditor = monaco.editor.create(container, {
          value: pendingContent !== null ? pendingContent : '',
          language: pendingFileName ? getMonacoLanguage(pendingFileName) : 'python',
          theme: isLight ? 'vs' : 'vs-dark',
          automaticLayout: true,
          wordWrap: 'on',
          wrappingStrategy: 'advanced',
          wrappingIndent: 'same',
          fontSize: 14,
          minimap: { enabled: true },
          scrollBeyondLastLine: false,
          renderWhitespace: 'selection',
          lineNumbers: 'on',
          tabSize: 4,
          insertSpaces: true,
          fontFamily: "'Consolas', 'Courier New', monospace"
        });

        isMonacoReady = true;

        if (container) {
          container.removeAttribute('contenteditable');
        }

        if (pendingContent !== null) {
          setEditorContent(pendingContent, pendingFileName);
          pendingContent = null;
          pendingFileName = null;
        } else {
          monacoEditor.setScrollTop(0);
          monacoEditor.revealLine(1);
          monacoEditor.setPosition({ lineNumber: 1, column: 1 });
        }

        monacoEditor.onDidChangeModelContent(() => {
          triggerAutoSave();
        });

        monacoEditor.focus();

        if (window.ResizeObserver) {
          const ro = new ResizeObserver(() => {
            if (monacoEditor) {
              monacoEditor.layout();
            }
          });
          ro.observe(container);
        }
      });
    }
  }

  initMonacoEditor();

  // --- Utility Functions ---

  async function handleJsonResponse(res) {
    const contentType = res ? res.headers.get('content-type') || '' : '';
    if (contentType.includes('application/json')) {
      try {
        return await res.json();
      } catch (e) {
        return { status: 'error', message: 'Invalid JSON response from server.' };
      }
    }
    const text = res ? await res.text() : '';
    console.warn('Non-JSON response received:', text);
    return {
      status: 'error',
      message: `Server returned non-JSON response (HTTP ${res ? res.status : 'unknown'})`
    };
  }

  function normalizePath(pathStr) {
    return pathStr ? pathStr.replace(/\\/g, '/') : null;
  }

  function setEditorContent(content, fileNameOrPath) {
    const text = content || '';
    let ext = 'py';
    if (fileNameOrPath) {
      ext = fileNameOrPath.includes('.') ? fileNameOrPath.split('.').pop() : fileNameOrPath;
    }
    const lang = getMonacoLanguage(ext);

    if (monacoEditor && isMonacoReady) {
      monacoEditor.setValue(text);
      const model = monacoEditor.getModel();
      if (model) {
        monaco.editor.setModelLanguage(model, lang);
      }
      monacoEditor.setScrollTop(0);
      monacoEditor.revealLine(1);
      monacoEditor.setPosition({ lineNumber: 1, column: 1 });
      monacoEditor.focus();
    } else {
      pendingContent = text;
      pendingFileName = fileNameOrPath || 'py';
      if (textCanvas && !monacoEditor) {
        textCanvas.contentEditable = 'true';
        textCanvas.textContent = text;
      }
    }
  }

  function getPlainTextFromCanvas() {
    if (monacoEditor && isMonacoReady) {
      return monacoEditor.getValue();
    }
    if (pendingContent !== null) {
      return pendingContent;
    }
    if (textCanvas) {
      return textCanvas.innerText || textCanvas.textContent || '';
    }
    return '';
  }

  // --- Sidebar Mechanics ---
  if (notesToggleBtn) {
    notesToggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      sidebar.classList.add('collapsed');
      setTimeout(() => {
        if (monacoEditor && isMonacoReady) {
          monacoEditor.layout();
        }
      }, 220);
    });
  }

  if (logoBtn) {
    logoBtn.style.cursor = 'pointer';
    logoBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      sidebar.classList.remove('collapsed');
      setTimeout(() => {
        if (monacoEditor && isMonacoReady) {
          monacoEditor.layout();
        }
      }, 220);
    });
  }

  // --- Save Button Binding ---
  if (saveFileBtn) {
    saveFileBtn.addEventListener('click', () => saveCurrentFile());
  }

  // --- Dropdown Navigation ---
  function bindMenuToggle(btn, dropdown) {
    if (!btn || !dropdown) return;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const container = btn.closest('.menu-dropdown-container');
      const isHidden = dropdown.classList.contains('hidden');
      closeAllDropdowns();
      if (isHidden) {
        dropdown.classList.remove('hidden');
        if (container) container.classList.add('active');
      }
    });
  }

  bindMenuToggle(fileMenuBtn, fileDropdown);
  bindMenuToggle(editMenuBtn, editDropdown);
  bindMenuToggle(viewMenuBtn, viewDropdown);
  bindMenuToggle(settingsMenuBtn, settingsDropdown);
  bindMenuToggle(helpMenuBtn, helpDropdown);

  document.addEventListener('click', () => closeAllDropdowns());

  function closeAllDropdowns() {
    document.querySelectorAll('.app-dropdown-menu').forEach(menu => menu.classList.add('hidden'));
    document.querySelectorAll('.menu-dropdown-container').forEach(c => c.classList.remove('active'));
    if (fontSettingsPanel) fontSettingsPanel.classList.add('hidden');
  }

  if (fontSettingsPanel) {
    fontSettingsPanel.addEventListener('click', (e) => e.stopPropagation());
  }

  if (fontSettingsToggle && fontSettingsPanel) {
    fontSettingsToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      fontSettingsPanel.classList.toggle('hidden');
    });
  }

  if (applyFontSizeBtn && fontSizeInput) {
    applyFontSizeBtn.addEventListener('click', () => {
      const size = parseInt(fontSizeInput.value, 10);
      if (size && size >= 8 && size <= 72) {
        if (monacoEditor && isMonacoReady) {
          monacoEditor.updateOptions({ fontSize: size });
        }
      }
    });
  }

  if (boldToggle) {
    boldToggle.addEventListener('change', (e) => {
      if (monacoEditor && isMonacoReady) {
        monacoEditor.updateOptions({ fontWeight: e.target.checked ? 'bold' : 'normal' });
      }
    });
  }

  if (italicToggle) {
    italicToggle.addEventListener('change', (e) => {
      // Monaco handles font styling dynamically
    });
  }

  // --- File Dropdown Router ---
  if (fileDropdown) {
    fileDropdown.addEventListener('click', (e) => {
      const item = e.target.closest('.dropdown-item');
      if (!item || item.classList.contains('disabled')) return;

      const action = item.dataset.action;
      closeAllDropdowns();

      switch (action) {
        case 'new-file':
          if (actionNewFile) actionNewFile.click();
          else createNewFilePrompt();
          break;
        case 'open-file':
          if (nativeFilePicker) nativeFilePicker.click();
          else if (filePicker) filePicker.click();
          break;
        case 'save':
          saveCurrentFile();
          break;
        case 'save-as':
          triggerSaveAsFile();
          break;
        case 'save-copy-as':
          triggerSaveCopyAsFile();
          break;
        case 'print-window':
          window.print();
          break;
        case 'close-window':
          resetEditorState();
          break;
        case 'exit-app':
          if (window.pywebview && window.pywebview.api && window.pywebview.api.close) {
            window.pywebview.api.close();
          } else {
            window.close();
          }
          break;
      }
    });
  }

  // --- Edit Dropdown Router ---
  if (editDropdown) {
    editDropdown.addEventListener('click', async (e) => {
      const item = e.target.closest('.dropdown-item');
      if (!item || item.classList.contains('disabled')) return;

      const action = item.dataset.action;
      closeAllDropdowns();

      if (monacoEditor && isMonacoReady) {
        monacoEditor.focus();
      }

      switch (action) {
        case 'undo':
          if (monacoEditor && isMonacoReady) monacoEditor.trigger('menu', 'undo', null);
          else document.execCommand('undo');
          break;
        case 'redo':
          if (monacoEditor && isMonacoReady) monacoEditor.trigger('menu', 'redo', null);
          else document.execCommand('redo');
          break;
        case 'cut':
          if (monacoEditor && isMonacoReady) {
            monacoEditor.focus();
            document.execCommand('cut');
          } else {
            document.execCommand('cut');
          }
          break;
        case 'copy':
          if (monacoEditor && isMonacoReady) {
            monacoEditor.focus();
            document.execCommand('copy');
          } else {
            document.execCommand('copy');
          }
          break;
        case 'paste':
          try {
            if (navigator.clipboard && navigator.clipboard.readText) {
              const text = await navigator.clipboard.readText();
              if (monacoEditor && isMonacoReady) {
                monacoEditor.focus();
                const selection = monacoEditor.getSelection();
                monacoEditor.executeEdits('paste', [{
                  range: selection,
                  text: text,
                  forceMoveMarkers: true
                }]);
              } else {
                document.execCommand('insertText', false, text);
              }
            } else {
              document.execCommand('paste');
            }
          } catch (err) {
            document.execCommand('paste');
          }
          break;
        case 'select-all':
          if (monacoEditor && isMonacoReady) {
            monacoEditor.focus();
            const model = monacoEditor.getModel();
            if (model) monacoEditor.setSelection(model.getFullModelRange());
          } else {
            document.execCommand('selectAll');
          }
          break;
      }
    });
  }

  // --- Line Numbers Generator (Legacy fallback) ---
  function updateLineNumbers() {
    // Monaco editor manages line numbers internally
  }

  // --- View Dropdown Router ---
  if (viewDropdown) {
    viewDropdown.addEventListener('click', (e) => {
      const item = e.target.closest('.dropdown-item');
      if (!item || item.classList.contains('disabled')) return;

      const action = item.dataset.action;
      closeAllDropdowns();

      switch (action) {
        case 'toggle-theme':
          const isLight = document.body.classList.toggle('root-light');
          if (themeStatusText) {
            themeStatusText.textContent = isLight ? 'Enable Dark Mode' : 'Enable Light Mode';
          }
          if (monacoEditor && isMonacoReady) {
            monaco.editor.setTheme(isLight ? 'vs' : 'vs-dark');
          }
          break;
        case 'toggle-line-numbers':
          if (monacoEditor && isMonacoReady) {
            const opt = monacoEditor.getOption(monaco.editor.EditorOption.lineNumbers);
            const isOff = opt.renderType === 0;
            const newSetting = isOff ? 'on' : 'off';
            monacoEditor.updateOptions({ lineNumbers: newSetting });
            if (linesStatusText) {
              linesStatusText.textContent = newSetting === 'on' ? 'Hide Line Numbers' : 'Show Line Numbers';
            }
          }
          break;
      }
    });
  }

  // --- Help Dropdown Router ---
  if (helpDropdown) {
    helpDropdown.addEventListener('click', (e) => {
      const item = e.target.closest('.dropdown-item');
      if (!item || item.classList.contains('disabled')) return;

      const action = item.dataset.action;
      closeAllDropdowns();

      let targetUrl = '';

      switch (action) {
        case 'setup-usage':
          targetUrl = `${GITHUB_REPO_URL}/setupandusage.md`;
          break;
        case 'license':
          targetUrl = `${GITHUB_REPO_URL}/LICENSE.md`;
          break;
        case 'faqs':
          targetUrl = `${GITHUB_REPO_URL}/FAQs.md`;
          break;
      }

      if (targetUrl) {
        if (window.pywebview && window.pywebview.api && window.pywebview.api.open_external_url) {
          window.pywebview.api.open_external_url(targetUrl);
        } else {
          window.open(targetUrl, '_blank', 'noopener,noreferrer');
        }
      }
    });
  }

  // Native File Picker Listener
  if (nativeFilePicker) {
    nativeFilePicker.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const normalizedFileName = normalizePath(file.name);
      if (normalizedFileName.startsWith('.git') || normalizedFileName.includes('/.git/')) {
        alert('Accessing .git files is restricted.');
        nativeFilePicker.value = '';
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const rawContent = event.target.result;
        currentFileExt = file.name.split('.').pop().toLowerCase();
        if (activeFileName) activeFileName.textContent = file.name;
        currentFilePath = file.path
          ? normalizePath(file.path)
          : normalizePath(`${currentRootDir || '.'}/${file.name}`);
        fileHandle = null;
        setEditorContent(rawContent, file.name);
      };

      reader.readAsText(file);
      nativeFilePicker.value = '';
    });
  }

  function showSaveIndicator() {
    if (!saveFileBtn) return;
    const originalBg = saveFileBtn.style.backgroundColor;
    saveFileBtn.style.backgroundColor = '#28a745';
    setTimeout(() => {
      saveFileBtn.style.backgroundColor = originalBg;
    }, 600);
  }

  function getCurrentFileDirAndName() {
    let dir = currentRootDir || '.';
    let name = activeFileName && activeFileName.textContent !== 'No file open'
      ? activeFileName.textContent
      : `untitled.${currentFileExt}`;

    if (currentFilePath) {
      const normalized = normalizePath(currentFilePath);
      const lastSlash = normalized.lastIndexOf('/');
      if (lastSlash !== -1) {
        dir = normalized.substring(0, lastSlash);
        name = normalized.substring(lastSlash + 1);
      } else {
        name = normalized;
      }
    }

    return { dir, name };
  }

  // --- Save / Save As / Save Copy Helpers ---
  async function saveCurrentFile(isAutoSave = false) {
    const plainContent = getPlainTextFromCanvas();

    // 1. Direct Save via File System Access API (Browser Mode)
    if (fileHandle) {
      try {
        const writable = await fileHandle.createWritable();
        await writable.write(plainContent);
        await writable.close();
        if (!isAutoSave) showSaveIndicator();
        return;
      } catch (err) {
        console.error('Error saving via File Handle:', err);
      }
    }

    let targetPath = currentFilePath;
    if (!targetPath && activeFileName && activeFileName.textContent && activeFileName.textContent !== 'No file open') {
      const fileName = activeFileName.textContent;
      const targetDir = currentRootDir || '.';
      targetPath = normalizePath(`${targetDir}/${fileName}`);
      currentFilePath = targetPath;
    }

    // 2. Direct Save via Backend / File Path (Overwrites directly in place without prompting)
    if (targetPath) {
      fetch('/save-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: targetPath,
          content: plainContent
        })
      })
        .then(handleJsonResponse)
        .then(data => {
          if (data.status === 'success') {
            currentFilePath = targetPath;
            if (!isAutoSave) showSaveIndicator();
          } else {
            if (!isAutoSave) alert(`Save Failed: ${data.message}`);
          }
        })
        .catch(err => {
          console.error('Error saving file:', err);
          if (!isAutoSave) alert(`Save Failed: ${err}`);
        });
      return;
    }

    // 3. Fallback: If no current file path and no active file, prompt Save As
    if (!isAutoSave) {
      triggerSaveAsFile();
    }
  }

  async function triggerSaveAsFile() {
    const plainContent = getPlainTextFromCanvas();
    const { dir, name: currentName } = getCurrentFileDirAndName();

    // Option A: pywebview Native Dialog (stay in same directory)
    if (window.pywebview && window.pywebview.api && window.pywebview.api.save_file_dialog) {
      let targetPath = await window.pywebview.api.save_file_dialog(dir, currentName);
      if (!targetPath) return;
      targetPath = normalizePath(targetPath);

      fetch('/save-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: targetPath,
          content: plainContent
        })
      })
        .then(handleJsonResponse)
        .then(data => {
          if (data.status === 'success') {
            currentFilePath = targetPath;
            fileHandle = null;
            const fileName = targetPath.split('/').pop();
            if (activeFileName) activeFileName.textContent = fileName;
            showSaveIndicator();
          } else {
            alert(`Save Failed: ${data.message}`);
          }
        })
        .catch(err => console.error('Error in save as:', err));
      return;
    }

    // Option B: Standard Browser Mode (File System Access API)
    if ('showSaveFilePicker' in window) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: currentName
        });
        const writable = await handle.createWritable();
        await writable.write(plainContent);
        await writable.close();
        fileHandle = handle;
        currentFilePath = null;
        if (activeFileName) activeFileName.textContent = handle.name;
        showSaveIndicator();
        return;
      } catch (err) {
        if (err.name === 'AbortError') return;
        console.error('File System Access API Save As failed:', err);
      }
    }

    // Option C: Fallback Prompt to save in the SAME directory
    const newFileName = prompt('Save file as (will stay in same directory):', currentName);
    if (!newFileName) return;

    const targetPathStr = normalizePath(`${dir}/${newFileName}`);

    fetch('/save-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: targetPathStr,
        content: plainContent
      })
    })
      .then(handleJsonResponse)
      .then(data => {
        if (data.status === 'success') {
          currentFilePath = targetPathStr;
          fileHandle = null;
          if (activeFileName) activeFileName.textContent = newFileName;
          showSaveIndicator();
        } else {
          const blob = new Blob([plainContent], { type: 'text/plain;charset=utf-8' });
          const downloadLink = document.createElement('a');
          downloadLink.download = newFileName;
          downloadLink.href = URL.createObjectURL(blob);
          downloadLink.click();
          URL.revokeObjectURL(downloadLink.href);
        }
      })
      .catch(err => console.error('Error in save fallback:', err));
  }

  async function triggerSaveCopyAsFile() {
    let copyPath = null;
    const plainContent = getPlainTextFromCanvas();

    if (window.pywebview && window.pywebview.api && window.pywebview.api.save_file_dialog) {
      copyPath = await window.pywebview.api.save_file_dialog();
      if (!copyPath) return;
      copyPath = normalizePath(copyPath);

      fetch('/save-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: copyPath,
          content: plainContent
        })
      })
        .then(handleJsonResponse)
        .then(data => {
          if (data.status !== 'success') {
            alert(`Save Copy Failed: ${data.message}`);
          }
        })
        .catch(err => console.error('Error in save copy as:', err));
      return;
    }

    // Browser Context
    const blob = new Blob([plainContent], { type: 'text/plain;charset=utf-8' });
    const downloadLink = document.createElement('a');
    const defaultName = activeFileName ? activeFileName.textContent : `copy.${currentFileExt}`;

    downloadLink.download = `copy_${defaultName !== 'No file open' ? defaultName : `untitled.${currentFileExt}`}`;
    downloadLink.href = URL.createObjectURL(blob);
    downloadLink.click();
    URL.revokeObjectURL(downloadLink.href);
  }

  function resetEditorState() {
    currentFilePath = null;
    fileHandle = null;
    currentFileExt = 'py';
    if (activeFileName) activeFileName.textContent = 'No file open';
    setEditorContent('', 'py');
  }

  let autoSaveTimeout = null;
  function triggerAutoSave() {
    if (autoSaveTimeout) clearTimeout(autoSaveTimeout);
    autoSaveTimeout = setTimeout(() => {
      if (currentFilePath || fileHandle) {
        saveCurrentFile(true);
      }
    }, 1000);
  }

  // --- Canvas Behavior ---
  if (textCanvas) {
    textCanvas.addEventListener('input', () => {
      updateLineNumbers();
      triggerAutoSave();
    });

    textCanvas.addEventListener('keydown', (e) => {
      if (!isMonacoReady || !monacoEditor) {
        if (e.key === 'Tab') {
          e.preventDefault();
          const sel = window.getSelection();
          if (!sel || !sel.rangeCount) return;

          const twoSpaceExts = ['html', 'htm', 'css', 'json', 'yaml', 'yml', 'js', 'ts'];
          const spaceCount = twoSpaceExts.includes(currentFileExt) ? 2 : 4;
          const indentSpaces = '\u00a0'.repeat(spaceCount);

          const range = sel.getRangeAt(0);
          const tabNode = document.createTextNode(indentSpaces);
          range.insertNode(tabNode);

          range.setStartAfter(tabNode);
          range.setEndAfter(tabNode);
          sel.removeAllRanges();
          sel.addRange(range);
          updateLineNumbers();
        }
      }
    });

    textCanvas.addEventListener('paste', (e) => {
      if (!isMonacoReady || !monacoEditor) {
        e.preventDefault();
        const clipboardData = e.clipboardData || window.clipboardData;
        if (!clipboardData) return;

        const text = clipboardData.getData('text/plain');
        const formatted = sanitizeHTML(text);

        document.execCommand('insertHTML', false, formatted);
        updateLineNumbers();
      }
    });
  }

  if (gridContainer) {
    gridContainer.addEventListener('click', (e) => {
      const isInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'BUTTON';
      if (!isInput && monacoEditor && isMonacoReady) {
        monacoEditor.focus();
      }
    });
  }

  function isTextInput(el) {
    if (!el) return false;
    const tag = el.tagName ? el.tagName.toUpperCase() : '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable) {
      if (el.classList && el.classList.contains('inputarea')) {
        return false;
      }
      return true;
    }
    return false;
  }

  // --- Keyboard Shortcuts Listener ---
  document.addEventListener('keydown', (e) => {
    const isCtrl = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();
    const activeEl = document.activeElement;

    if (isTextInput(activeEl)) {
      return;
    }

    // Explicit Arrow and Navigation Keys Handler for Monaco Editor
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'home', 'end', 'pageup', 'pagedown'].includes(key)) {
      if (monacoEditor && isMonacoReady) {
        e.preventDefault();
        monacoEditor.focus();

        let action = '';
        if (key === 'arrowup') {
          action = e.shiftKey ? 'cursorUpSelect' : 'cursorUp';
        } else if (key === 'arrowdown') {
          action = e.shiftKey ? 'cursorDownSelect' : 'cursorDown';
        } else if (key === 'arrowleft') {
          if (isCtrl && e.shiftKey) action = 'cursorWordLeftSelect';
          else if (isCtrl) action = 'cursorWordLeft';
          else if (e.shiftKey) action = 'cursorLeftSelect';
          else action = 'cursorLeft';
        } else if (key === 'arrowright') {
          if (isCtrl && e.shiftKey) action = 'cursorWordRightSelect';
          else if (isCtrl) action = 'cursorWordRight';
          else if (e.shiftKey) action = 'cursorRightSelect';
          else action = 'cursorRight';
        } else if (key === 'home') {
          action = e.shiftKey ? 'cursorHomeSelect' : 'cursorHome';
        } else if (key === 'end') {
          action = e.shiftKey ? 'cursorEndSelect' : 'cursorEnd';
        } else if (key === 'pageup') {
          action = e.shiftKey ? 'cursorPageUpSelect' : 'cursorPageUp';
        } else if (key === 'pagedown') {
          action = e.shiftKey ? 'cursorPageDownSelect' : 'cursorPageDown';
        }

        if (action) {
          monacoEditor.trigger('keyboard', action, null);
        }
        return;
      }
    }

    const isInsideMonaco = monacoEditor && isMonacoReady && textCanvas && textCanvas.contains(activeEl);

    if (!isInsideMonaco && monacoEditor && isMonacoReady && !e.altKey) {
      if (!isCtrl || ['s', 'o', 'n', 'p', 'q', 'k', '`'].includes(key)) {
        monacoEditor.focus();
      }
    }

    // Alt + Shift + S: Save Copy As
    if (e.altKey && e.shiftKey && key === 's') {
      e.preventDefault();
      triggerSaveCopyAsFile();
      return;
    }

    // Ctrl + Shift + S: Save As
    if (isCtrl && e.shiftKey && key === 's') {
      e.preventDefault();
      triggerSaveAsFile();
      return;
    }

    // Ctrl + S: Save File Directly
    if (isCtrl && !e.shiftKey && key === 's') {
      e.preventDefault();
      saveCurrentFile();
      return;
    }

    // Ctrl + Shift + N: Reset Editor Canvas
    if (isCtrl && e.shiftKey && key === 'n') {
      e.preventDefault();
      resetEditorState();
      return;
    }

    // Ctrl + N: New File
    if (isCtrl && !e.shiftKey && key === 'n') {
      e.preventDefault();
      if (actionNewFile) actionNewFile.click();
      else createNewFilePrompt();
      return;
    }

    // Ctrl + P: Print Window
    if (isCtrl && key === 'p') {
      e.preventDefault();
      window.print();
      return;
    }

    // Ctrl + ` : Launch Terminal
    if (isCtrl && (e.key === '`' || e.code === 'Backquote')) {
      e.preventDefault();
      fetch('/open-terminal', { method: 'POST' })
        .then(handleJsonResponse)
        .then(data => {
          if (data.status !== 'success') alert(`Terminal Error: ${data.message}`);
        })
        .catch(err => console.error('Terminal execution error:', err));
      return;
    }

    // Ctrl + K Chaining
    if (isCtrl && key === 'k') {
      e.preventDefault();
      ctrlKPressed = true;
      clearTimeout(ctrlKTimeout);
      ctrlKTimeout = setTimeout(() => { ctrlKPressed = false; }, 2000);
      return;
    }

    // Ctrl + K -> O: Open Directory
    if (ctrlKPressed && key === 'o') {
      e.preventDefault();
      ctrlKPressed = false;
      clearTimeout(ctrlKTimeout);
      if (folderPicker) folderPicker.click();
      else if (folderPickerLocal) folderPickerLocal.click();
      return;
    }

    // Ctrl + O: Open File
    if (isCtrl && !ctrlKPressed && key === 'o') {
      e.preventDefault();
      if (nativeFilePicker) nativeFilePicker.click();
      else if (filePicker) filePicker.click();
      return;
    }

    // If Monaco is active and focused, let Monaco handle text editing keys natively!
    if (isInsideMonaco) {
      return;
    }

    // Fallback Text Canvas Controls (Only when Monaco is NOT ready)
    if (!isMonacoReady && (activeEl === textCanvas || (textCanvas && textCanvas.contains(activeEl)))) {
      if (isCtrl && !e.shiftKey && key === 'z') {
        e.preventDefault();
        document.execCommand('undo');
        return;
      }
      if (isCtrl && key === 'y') {
        e.preventDefault();
        document.execCommand('redo');
        return;
      }
      if (isCtrl && key === 'x') {
        e.preventDefault();
        document.execCommand('cut');
        return;
      }
      if (isCtrl && key === 'c') {
        e.preventDefault();
        document.execCommand('copy');
        return;
      }
      if (isCtrl && key === 'a') {
        e.preventDefault();
        document.execCommand('selectAll');
        return;
      }
    }
  });

  // --- Execution Icon Handler ---
  const toolIcons = document.querySelectorAll('.tool-icon');
  toolIcons.forEach(btn => {
    if (btn.textContent.includes('▶')) {
      btn.addEventListener('click', () => {
        if (!currentFilePath) {
          alert('No saved disk file active to run.');
          return;
        }

        fetch('/run-file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: currentFilePath })
        })
          .then(handleJsonResponse)
          .then(data => {
            if (data.status === 'error') {
              alert(`Execution Error: ${data.message}`);
            } else {
              alert(data.stdout || data.stderr || 'Execution completed with no output.');
            }
          })
          .catch(err => console.error('Error running script:', err));
      });
    }
  });

  // --- Directory Actions & Tree ---
  if (filePicker) {
    filePicker.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const normalizedFileName = normalizePath(file.name);
      if (normalizedFileName.startsWith('.git') || normalizedFileName.includes('/.git/')) {
        alert('Accessing .git files is restricted.');
        filePicker.value = '';
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const rawContent = event.target.result;
        currentFileExt = file.name.split('.').pop().toLowerCase();
        if (activeFileName) activeFileName.textContent = file.name;
        currentFilePath = file.path
          ? normalizePath(file.path)
          : normalizePath(`${currentRootDir || '.'}/${file.name}`);
        fileHandle = null;
        setEditorContent(rawContent, file.name);
      };

      reader.readAsText(file);
      filePicker.value = '';
    });
  }

  if (folderPicker) {
    folderPicker.addEventListener('change', (e) => {
      const files = Array.from(e.target.files);
      if (files.length === 0) return;

      const rootName = normalizePath(files[0].webkitRelativePath).split('/')[0];
      currentRootDir = rootName;
      const treeData = {};

      files.forEach(file => {
        const relativePath = normalizePath(file.webkitRelativePath);

        if (relativePath.includes('/.git/') || relativePath.startsWith('.git/')) {
          return;
        }

        const parts = relativePath.split('/');
        parts.shift();

        let current = treeData;
        parts.forEach((part, index) => {
          if (index === parts.length - 1) {
            current[part] = { __type__: 'file', fileObj: file };
          } else {
            if (!current[part]) {
              current[part] = { __type__: 'dir', children: {} };
            }
            current = current[part].children;
          }
        });
      });

      renderNativeTreeUI(rootName, treeData);
      folderPicker.value = '';
    });
  }

  function createNewFilePrompt() {
    const fileName = prompt('Enter new file name:');
    if (!fileName) return;

    const normalizedName = normalizePath(fileName);
    if (normalizedName === '.git' || normalizedName.startsWith('.git/')) {
      alert('Cannot create .git files.');
      return;
    }

    const target = selectedTargetDir || currentRootDir;
    if (!target) {
      triggerSaveAsFile();
      return;
    }

    fetch('/create-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_dir: target, name: fileName })
    })
      .then(handleJsonResponse)
      .then(data => {
        if (data.status === 'success') {
          currentFilePath = normalizePath(`${target}/${fileName}`);
          fileHandle = null;
          currentFileExt = fileName.split('.').pop().toLowerCase();
          if (activeFileName) activeFileName.textContent = fileName;
          setEditorContent('', fileName);
        } else {
          alert(data.message);
        }
      });
  }

  if (actionNewFile) actionNewFile.addEventListener('click', createNewFilePrompt);

  if (actionNewFolder) {
    actionNewFolder.addEventListener('click', () => {
      const folderName = prompt('Enter new folder name:');
      if (!folderName) return;

      const normalizedFolder = normalizePath(folderName);
      if (normalizedFolder === '.git') {
        alert('Cannot create .git folder.');
        return;
      }

      const target = selectedTargetDir || currentRootDir;
      if (!target) {
        alert('Select or open a folder target first.');
        return;
      }

      fetch('/create-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_dir: target, name: folderName })
      })
        .then(handleJsonResponse)
        .then(data => {
          if (data.status !== 'success') alert(data.message);
        });
    });
  }

  function renderNativeTreeUI(rootDirName, treeData) {
    if (!treeContainer) return;
    treeContainer.replaceChildren();

    const rootHeader = document.createElement('button');
    rootHeader.className = 'tree-folder';
    rootHeader.style.cssText = 'display:block; width:100%; text-align:left; background:none; border:none; cursor:pointer; color:inherit; padding:4px 12px; font-weight:bold;';
    rootHeader.textContent = `^ ${rootDirName}`;

    treeContainer.appendChild(rootHeader);
    const treeList = createNativeTreeNodes(treeData);
    treeContainer.appendChild(treeList);
  }

  function clearTreeSelections() {
    if (!treeContainer) return;
    const allButtons = treeContainer.querySelectorAll('button');
    allButtons.forEach(btn => btn.style.backgroundColor = 'transparent');
  }

  function createNativeTreeNodes(nodeObj) {
    const container = document.createElement('div');

    Object.keys(nodeObj).forEach(key => {
      const node = nodeObj[key];

      if (node.__type__ === 'file') {
        const fileBtn = document.createElement('button');
        fileBtn.className = 'tree-file';
        fileBtn.style.cssText = 'display:block; width:100%; text-align:left; background:none; border:none; cursor:pointer; color:inherit; padding:4px 12px 4px 28px;';
        fileBtn.textContent = `📄 ${key}`;

        fileBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          clearTreeSelections();
          fileBtn.style.backgroundColor = 'var(--bg-active, #2a2d32)';

          const reader = new FileReader();
          reader.onload = (event) => {
            const rawContent = event.target.result;
            currentFileExt = key.split('.').pop().toLowerCase();

            if (activeFileName) activeFileName.textContent = key;
            const pathVal = node.fileObj ? (node.fileObj.path || node.fileObj.webkitRelativePath) : null;
            currentFilePath = pathVal
              ? normalizePath(pathVal)
              : normalizePath(`${currentRootDir || '.'}/${key}`);
            fileHandle = null;
            setEditorContent(rawContent, key);
          };
          reader.readAsText(node.fileObj);
        });

        container.appendChild(fileBtn);
      } else if (node.__type__ === 'dir') {
        const folderBtn = document.createElement('button');
        folderBtn.className = 'tree-folder';
        folderBtn.style.cssText = 'display:block; width:100%; text-align:left; background:none; border:none; cursor:pointer; color:inherit; padding:4px 12px; font-weight:600;';
        folderBtn.textContent = `^ ${key}`;

        const childGroup = createNativeTreeNodes(node.children);
        childGroup.style.display = 'block';

        folderBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          clearTreeSelections();
          folderBtn.style.backgroundColor = 'var(--bg-active, #2a2d32)';

          const isHidden = childGroup.style.display === 'none';
          childGroup.style.display = isHidden ? 'block' : 'none';
          folderBtn.textContent = `${isHidden ? '^' : 'v'} ${key}`;
        });

        container.appendChild(folderBtn);
        container.appendChild(childGroup);
      }
    });

    return container;
  }

  // --- AI Model & API Hub (apiform.html) & Floating Popup Logic ---
  const aiModalBtn = document.getElementById('aiModalBtn');
  const apiformOverlay = document.getElementById('apiformOverlay');
  const apiFormCloseBtn = document.getElementById('apiFormCloseBtn');

  const btnExternalApi = document.getElementById('btnExternalApi');
  const btnLocalModel = document.getElementById('btnLocalModel');
  const sectionExternalApi = document.getElementById('sectionExternalApi');
  const sectionLocalModel = document.getElementById('sectionLocalModel');

  const apiProviderSelect = document.getElementById('apiProviderSelect');
  const apiKeyInput = document.getElementById('apiKeyInput');
  const toggleApiKeyVisBtn = document.getElementById('toggleApiKeyVisBtn');
  const btnConnectApi = document.getElementById('btnConnectApi');

  const localModelPathInput = document.getElementById('localModelPathInput');
  const btnBrowseLocalModel = document.getElementById('btnBrowseLocalModel');
  const btnLoadLocalModel = document.getElementById('btnLoadLocalModel');

  const btnEnlightenMe = document.getElementById('btnEnlightenMe');
  const folderPickerLocal = document.getElementById('folderPickerLocal');
  const enlightenResultsArea = document.getElementById('enlightenResultsArea');
  const foundModelsSelect = document.getElementById('foundModelsSelect');
  const btnUseFoundModel = document.getElementById('btnUseFoundModel');

  const apiFormStatus = document.getElementById('apiFormStatus');

  // Floating Popup Elements
  const aiFloatingPopup = document.getElementById('aiFloatingPopup');
  const aiPopupHeader = document.getElementById('aiPopupHeader');
  const aiPopupTitle = document.getElementById('aiPopupTitle');
  const aiPopupCloseBtn = document.getElementById('aiPopupCloseBtn');
  const aiPopupConfigBtn = document.getElementById('aiPopupConfigBtn');
  const aiPopupBody = document.getElementById('aiPopupBody');
  const aiPopupInput = document.getElementById('aiPopupInput');
  const aiPopupSendBtn = document.getElementById('aiPopupSendBtn');

  let isAiConfigured = false;
  let activeAiProvider = 'AI Assistant';
  let activeAiKey = '';
  let activeModelPath = '';

  function sanitizeInput(text) {
    if (typeof text !== 'string') return '';
    return text
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/`/g, '&#x60;')
      .trim();
  }

  // Reactively open AI Hub or Floating Assistant on clicking '✦' button
  if (aiModalBtn) {
    aiModalBtn.addEventListener('click', (e) => {
      if (e.shiftKey) {
        if (apiformOverlay) apiformOverlay.classList.remove('hidden');
        return;
      }

      if (isAiConfigured && aiFloatingPopup) {
        if (aiFloatingPopup.classList.contains('hidden')) {
          aiFloatingPopup.classList.remove('hidden');
        } else {
          if (apiformOverlay) apiformOverlay.classList.remove('hidden');
        }
      } else {
        if (apiformOverlay) apiformOverlay.classList.remove('hidden');
      }
    });
  }

  if (apiFormCloseBtn && apiformOverlay) {
    apiFormCloseBtn.addEventListener('click', () => {
      apiformOverlay.classList.add('hidden');
    });
  }

  if (aiPopupConfigBtn && apiformOverlay) {
    aiPopupConfigBtn.addEventListener('click', () => {
      apiformOverlay.classList.remove('hidden');
    });
  }

  if (btnExternalApi && btnLocalModel) {
    btnExternalApi.addEventListener('click', () => {
      btnExternalApi.classList.add('active');
      btnLocalModel.classList.remove('active');
      if (sectionExternalApi) sectionExternalApi.classList.remove('hidden');
      if (sectionLocalModel) sectionLocalModel.classList.add('hidden');
    });

    btnLocalModel.addEventListener('click', () => {
      btnLocalModel.classList.add('active');
      btnExternalApi.classList.remove('active');
      if (sectionLocalModel) sectionLocalModel.classList.remove('hidden');
      if (sectionExternalApi) sectionExternalApi.classList.add('hidden');
    });
  }

  if (toggleApiKeyVisBtn && apiKeyInput) {
    toggleApiKeyVisBtn.addEventListener('click', () => {
      if (apiKeyInput.type === 'password') {
        apiKeyInput.type = 'text';
        toggleApiKeyVisBtn.textContent = 'Hide';
      } else {
        apiKeyInput.type = 'password';
        toggleApiKeyVisBtn.textContent = 'Show';
      }
    });
  }

  if (btnConnectApi) {
    btnConnectApi.addEventListener('click', () => {
      const provider = sanitizeInput(apiProviderSelect ? apiProviderSelect.value : '');
      const apiKey = sanitizeInput(apiKeyInput ? apiKeyInput.value : '');

      if (!provider || !apiKey) {
        if (apiFormStatus) {
          apiFormStatus.className = 'apiform-status error';
          apiFormStatus.textContent = 'Please select a provider and enter your API key.';
        }
        return;
      }

      fetch('/api/verify-external-api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, apiKey })
      })
        .then(handleJsonResponse)
        .then(data => {
          if (data.status === 'success') {
            isAiConfigured = true;
            activeAiProvider = provider;
            activeAiKey = apiKey;
            if (apiFormStatus) {
              apiFormStatus.className = 'apiform-status success';
              apiFormStatus.textContent = data.message;
            }
            setTimeout(() => {
              if (apiformOverlay) apiformOverlay.classList.add('hidden');
              openAiFloatingPopup(`🤖 AI Assistant (${provider})`, `Connected to ${provider} API successfully!`);
            }, 400);
          } else {
            if (apiFormStatus) {
              apiFormStatus.className = 'apiform-status error';
              apiFormStatus.textContent = data.message || 'API connection failed.';
            }
          }
        })
        .catch(err => {
          if (apiFormStatus) {
            apiFormStatus.className = 'apiform-status error';
            apiFormStatus.textContent = 'Connection error: ' + err;
          }
        });
    });
  }

  if (btnBrowseLocalModel && localModelPathInput) {
    btnBrowseLocalModel.addEventListener('click', () => {
      const pathPrompt = prompt('Enter or paste local model file path:');
      if (pathPrompt) {
        localModelPathInput.value = sanitizeInput(pathPrompt);
      }
    });
  }

  if (btnLoadLocalModel) {
    btnLoadLocalModel.addEventListener('click', () => {
      const modelPath = sanitizeInput(localModelPathInput ? localModelPathInput.value : '');

      if (!modelPath) {
        if (apiFormStatus) {
          apiFormStatus.className = 'apiform-status error';
          apiFormStatus.textContent = 'Please enter a local model file path.';
        }
        return;
      }

      fetch('/api/verify-local-model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelPath })
      })
        .then(handleJsonResponse)
        .then(data => {
          if (data.status === 'success' || data.status === 'warning') {
            isAiConfigured = true;
            activeAiProvider = `Local (${data.modelName})`;
            activeModelPath = data.modelPath;
            if (apiFormStatus) {
              apiFormStatus.className = 'apiform-status success';
              apiFormStatus.textContent = data.message;
            }
            setTimeout(() => {
              if (apiformOverlay) apiformOverlay.classList.add('hidden');
              openAiFloatingPopup(`🤖 Local Model (${data.modelName})`, `Loaded local model: ${data.modelPath}`);
            }, 400);
          } else {
            if (apiFormStatus) {
              apiFormStatus.className = 'apiform-status error';
              apiFormStatus.textContent = data.message || 'Model loading failed.';
            }
          }
        })
        .catch(err => {
          if (apiFormStatus) {
            apiFormStatus.className = 'apiform-status error';
            apiFormStatus.textContent = 'Model verification error: ' + err;
          }
        });
    });
  }

  if (btnEnlightenMe && folderPickerLocal) {
    btnEnlightenMe.addEventListener('click', () => {
      alert('Enlighten Me: Please select folder(s) to search for local AI model files (.gguf, .bin, .safetensors, .onnx, .pth, .pt).');
      folderPickerLocal.click();
    });

    folderPickerLocal.addEventListener('change', (e) => {
      const files = Array.from(e.target.files);
      if (files.length === 0) return;

      const filePaths = files.map(f => f.webkitRelativePath || f.name);

      fetch('/api/search-local-models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: filePaths })
      })
        .then(handleJsonResponse)
        .then(data => {
          if (data.status === 'success' && data.models && data.models.length > 0) {
            if (foundModelsSelect) {
              foundModelsSelect.innerHTML = '';
              data.models.forEach(m => {
                const opt = document.createElement('option');
                opt.value = m;
                opt.textContent = m;
                foundModelsSelect.appendChild(opt);
              });
            }
            if (enlightenResultsArea) enlightenResultsArea.classList.remove('hidden');
            if (apiFormStatus) {
              apiFormStatus.className = 'apiform-status success';
              apiFormStatus.textContent = `Found ${data.models.length} model file(s)!`;
            }
          } else {
            alert('No local AI model files (.gguf, .bin, .safetensors, .onnx, .pth, .pt) were found in the selected folders.');
            if (apiFormStatus) {
              apiFormStatus.className = 'apiform-status error';
              apiFormStatus.textContent = 'No local model files found in selected folders.';
            }
          }
        });
    });
  }

  if (btnUseFoundModel && foundModelsSelect && localModelPathInput) {
    btnUseFoundModel.addEventListener('click', () => {
      const selectedModel = foundModelsSelect.value;
      if (selectedModel) {
        localModelPathInput.value = sanitizeInput(selectedModel);
        if (btnLoadLocalModel) btnLoadLocalModel.click();
      }
    });
  }

  function openAiFloatingPopup(title, sysMsg) {
    if (!aiFloatingPopup) return;

    if (aiPopupTitle) aiPopupTitle.textContent = title;
    if (aiPopupBody) {
      aiPopupBody.innerHTML = `<div class="ai-popup-msg system">${sanitizeInput(sysMsg)}</div>`;
    }
    aiFloatingPopup.classList.remove('hidden');
  }

  if (aiPopupCloseBtn && aiFloatingPopup) {
    aiPopupCloseBtn.addEventListener('click', () => {
      aiFloatingPopup.classList.add('hidden');
    });
  }

  if (aiPopupHeader && aiFloatingPopup) {
    let isDragging = false;
    let offsetX = 0;
    let offsetY = 0;

    aiPopupHeader.addEventListener('mousedown', (e) => {
      isDragging = true;
      offsetX = e.clientX - aiFloatingPopup.offsetLeft;
      offsetY = e.clientY - aiFloatingPopup.offsetTop;
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      aiFloatingPopup.style.left = `${e.clientX - offsetX}px`;
      aiFloatingPopup.style.top = `${e.clientY - offsetY}px`;
      aiFloatingPopup.style.bottom = 'auto';
      aiFloatingPopup.style.right = 'auto';
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
    });
  }

  function sendAiPrompt() {
    if (!aiPopupInput) return;
    const rawPrompt = aiPopupInput.value;
    const cleanPrompt = sanitizeInput(rawPrompt);

    if (!cleanPrompt) return;

    aiPopupInput.value = '';

    if (aiPopupBody) {
      const userMsg = document.createElement('div');
      userMsg.className = 'ai-popup-msg user';
      userMsg.textContent = cleanPrompt;
      aiPopupBody.appendChild(userMsg);
      aiPopupBody.scrollTop = aiPopupBody.scrollHeight;
    }

    const codeCtx = getPlainTextFromCanvas ? getPlainTextFromCanvas() : '';

    fetch('/api/ai-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: cleanPrompt,
        provider: activeAiProvider,
        apiKey: activeAiKey,
        modelPath: activeModelPath,
        codeContext: codeCtx
      })
    })
      .then(handleJsonResponse)
      .then(data => {
        if (aiPopupBody) {
          const assistantMsg = document.createElement('div');
          assistantMsg.className = 'ai-popup-msg assistant';
          assistantMsg.textContent = data.reply || 'Request completed.';
          aiPopupBody.appendChild(assistantMsg);
          aiPopupBody.scrollTop = aiPopupBody.scrollHeight;
        }
      })
      .catch(err => {
        if (aiPopupBody) {
          const errMsg = document.createElement('div');
          errMsg.className = 'ai-popup-msg system';
          errMsg.textContent = 'Error: ' + err;
          aiPopupBody.appendChild(errMsg);
          aiPopupBody.scrollTop = aiPopupBody.scrollHeight;
        }
      });
  }

  if (aiPopupSendBtn) {
    aiPopupSendBtn.addEventListener('click', sendAiPrompt);
  }

  if (aiPopupInput) {
    aiPopupInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        sendAiPrompt();
      }
    });
  }

});
