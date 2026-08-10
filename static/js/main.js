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

  // Line Numbers Sidebar Container Setup
  const gridContainer = document.querySelector('.editor-grid-container');
  let lineNumbersContainer = document.querySelector('.line-numbers');

  if (gridContainer && !lineNumbersContainer) {
    lineNumbersContainer = document.createElement('div');
    lineNumbersContainer.className = 'line-numbers hidden';
    lineNumbersContainer.contentEditable = 'false';
    lineNumbersContainer.setAttribute('aria-hidden', 'true');
    gridContainer.insertBefore(lineNumbersContainer, textCanvas);
  }

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

  let ctrlKPressed = false;
  let ctrlKTimeout = null;

  // --- Sidebar Mechanics ---
  if (notesToggleBtn) {
    notesToggleBtn.addEventListener('click', () => sidebar.classList.toggle('collapsed'));
  }
  if (logoBtn) {
    logoBtn.addEventListener('click', () => sidebar.classList.remove('collapsed'));
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

  // Prevent dropdown closing when clicking inside font settings subpanel controls
  if (fontSettingsPanel) {
    fontSettingsPanel.addEventListener('click', (e) => e.stopPropagation());
  }

  // Toggle Font Settings Sub-Panel
  if (fontSettingsToggle && fontSettingsPanel) {
    fontSettingsToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      fontSettingsPanel.classList.toggle('hidden');
    });
  }

  // Apply Font Size
  if (applyFontSizeBtn && fontSizeInput && textCanvas) {
    applyFontSizeBtn.addEventListener('click', () => {
      const size = fontSizeInput.value;
      if (size && size >= 8 && size <= 72) {
        textCanvas.style.fontSize = `${size}px`;
      }
    });
  }

  // Toggle Bold
  if (boldToggle && textCanvas) {
    boldToggle.addEventListener('change', (e) => {
      textCanvas.style.fontWeight = e.target.checked ? 'bold' : 'normal';
    });
  }

  // Toggle Italic
  if (italicToggle && textCanvas) {
    italicToggle.addEventListener('change', (e) => {
      textCanvas.style.fontStyle = e.target.checked ? 'italic' : 'normal';
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
          if (window.pywebview) {
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

      if (textCanvas) textCanvas.focus();

      switch (action) {
        case 'undo':
          document.execCommand('undo');
          break;
        case 'redo':
          document.execCommand('redo');
          break;
        case 'cut':
          document.execCommand('cut');
          break;
        case 'copy':
          document.execCommand('copy');
          break;
        case 'paste':
          try {
            const text = await navigator.clipboard.readText();
            const formatted = text
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;')
              .replace(/  /g, '&nbsp;&nbsp;')
              .replace(/\n/g, '<br>');
            document.execCommand('insertHTML', false, formatted);
          } catch (err) {
            document.execCommand('paste');
          }
          break;
        case 'select-all':
          document.execCommand('selectAll');
          break;
      }
    });
  }

  // --- Line Numbers Generator ---
  function updateLineNumbers() {
    if (!lineNumbersContainer || lineNumbersContainer.classList.contains('hidden')) return;
    if (!textCanvas) return;

    const lines = textCanvas.innerHTML.split(/<div>|<br>|<p>/gi);
    const lineCount = Math.max(1, lines.length);

    let numsHtml = '';
    for (let i = 1; i <= lineCount; i++) {
      numsHtml += `<span>${i}</span>`;
    }
    lineNumbersContainer.innerHTML = numsHtml;
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
          break;
        case 'toggle-line-numbers':
          if (lineNumbersContainer) {
            const isVisible = lineNumbersContainer.classList.toggle('hidden');
            const shown = !isVisible;
            if (shown) updateLineNumbers();
            if (linesStatusText) {
              linesStatusText.textContent = shown ? 'Hide Line Numbers' : 'Show Line Numbers';
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

      if (file.name.startsWith('.git') || file.name.includes('/.git/')) {
        alert('Accessing .git files is restricted.');
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const rawContent = event.target.result;
        currentFileExt = file.name.split('.').pop().toLowerCase();

        fetch('/format-content', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: rawContent, extension: currentFileExt })
        })
          .then(res => res.json())
          .then(data => {
            if (activeFileName) activeFileName.textContent = file.name;
            if (textCanvas) textCanvas.innerHTML = data.content || rawContent;
            currentFilePath = file.path || null;
            updateLineNumbers();
          });
      };
      reader.readAsText(file);
    });
  }

  function triggerSaveAsFile() {
    const customPath = prompt("Enter full path to Save As:", currentFilePath || "");
    if (!customPath) return;

    fetch('/save-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: customPath,
        content: textCanvas ? textCanvas.innerHTML : ''
      })
    })
      .then(res => res.json())
      .then(data => {
        if (data.status === 'success') {
          currentFilePath = customPath;
          const fileName = customPath.split(/[/\\]/).pop();
          if (activeFileName) activeFileName.textContent = fileName;
          alert('File saved successfully!');
        } else {
          alert(`Save Failed: ${data.message}`);
        }
      })
      .catch(err => console.error('Error in save as:', err));
  }

  function triggerSaveCopyAsFile() {
    const copyPath = prompt("Enter path to Save Copy As (current file session will remain open):", currentFilePath || "");
    if (!copyPath) return;

    fetch('/save-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: copyPath,
        content: textCanvas ? textCanvas.innerHTML : ''
      })
    })
      .then(res => res.json())
      .then(data => {
        if (data.status === 'success') {
          alert('Copy saved successfully! Original file remains active.');
        } else {
          alert(`Save Copy Failed: ${data.message}`);
        }
      })
      .catch(err => console.error('Error in save copy as:', err));
  }

  function resetEditorState() {
    currentFilePath = null;
    currentFileExt = 'py';
    if (activeFileName) activeFileName.textContent = 'No file open';
    if (textCanvas) textCanvas.innerHTML = '';
    updateLineNumbers();
  }

  // --- Canvas Behavior ---
  if (textCanvas) {
    textCanvas.addEventListener('input', () => updateLineNumbers());

    textCanvas.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const sel = window.getSelection();
        if (!sel.rangeCount) return;

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
    });

    textCanvas.addEventListener('paste', (e) => {
      e.preventDefault();
      const text = (e.clipboardData || window.clipboardData).getData('text/plain');

      const formatted = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;')
        .replace(/  /g, '&nbsp;&nbsp;')
        .replace(/\n/g, '<br>');

      document.execCommand('insertHTML', false, formatted);
      updateLineNumbers();
    });
  }

  // --- Keyboard Shortcuts Listener ---
  document.addEventListener('keydown', (e) => {
    const isCtrl = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();

    // Alt + Shift + S: Save Copy As
    if (e.altKey && e.shiftKey && key === 's') {
      e.preventDefault();
      triggerSaveCopyAsFile();
      return;
    }

    // Ctrl + P: Print Window
    if (isCtrl && key === 'p') {
      e.preventDefault();
      window.print();
      return;
    }

    // Ctrl + Shift + S: Save As
    if (isCtrl && e.shiftKey && key === 's') {
      e.preventDefault();
      triggerSaveAsFile();
      return;
    }

    // Ctrl + N: New File
    if (isCtrl && !e.shiftKey && key === 'n') {
      e.preventDefault();
      if (actionNewFile) actionNewFile.click();
      else createNewFilePrompt();
      return;
    }

    // Ctrl + Shift + N: Reset Editor Canvas
    if (isCtrl && e.shiftKey && key === 'n') {
      e.preventDefault();
      resetEditorState();
      return;
    }

    // Ctrl + ` : Launch Terminal
    if (isCtrl && (e.key === '`' || e.code === 'Backquote')) {
      e.preventDefault();
      fetch('/open-terminal', { method: 'POST' })
        .then(res => res.json())
        .then(data => {
          if (data.status !== 'success') alert(`Terminal Error: ${data.message}`);
        })
        .catch(err => console.error('Terminal execution error:', err));
      return;
    }

    // Ctrl + S: Save File
    if (isCtrl && !e.shiftKey && key === 's') {
      e.preventDefault();
      saveCurrentFile();
      return;
    }

    // Editor Text Controls
    if (document.activeElement === textCanvas || (textCanvas && textCanvas.contains(document.activeElement))) {
      if (isCtrl && !e.shiftKey && key === 'z') {
        e.preventDefault();
        document.execCommand('undo');
        updateLineNumbers();
        return;
      }
      if (isCtrl && key === 'y') {
        e.preventDefault();
        document.execCommand('redo');
        updateLineNumbers();
        return;
      }
      if (isCtrl && key === 'x') {
        e.preventDefault();
        document.execCommand('cut');
        updateLineNumbers();
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

    // Ctrl + K Chaining
    if (isCtrl && key === 'k') {
      e.preventDefault();
      ctrlKPressed = true;
      clearTimeout(ctrlKTimeout);
      ctrlKTimeout = setTimeout(() => { ctrlKPressed = false; }, 1200);
      return;
    }

    // Open Pickers
    if (key === 'o') {
      if (ctrlKPressed) {
        e.preventDefault();
        ctrlKPressed = false;
        if (folderPicker) folderPicker.click();
      } else if (isCtrl) {
        e.preventDefault();
        if (nativeFilePicker) nativeFilePicker.click();
        else if (filePicker) filePicker.click();
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
          .then(res => res.json())
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

      if (file.name.startsWith('.git') || file.name.includes('/.git/')) {
        alert('Accessing .git files is restricted.');
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const rawContent = event.target.result;
        currentFileExt = file.name.split('.').pop().toLowerCase();

        fetch('/format-content', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: rawContent, extension: currentFileExt })
        })
          .then(res => res.json())
          .then(data => {
            if (activeFileName) activeFileName.textContent = file.name;
            if (textCanvas) textCanvas.innerHTML = data.content || rawContent;
            currentFilePath = file.path || null;
            updateLineNumbers();
          });
      };
      reader.readAsText(file);
    });
  }

  if (folderPicker) {
    folderPicker.addEventListener('change', (e) => {
      const files = Array.from(e.target.files);
      if (files.length === 0) return;

      const rootName = files[0].webkitRelativePath.split('/')[0];
      currentRootDir = rootName;
      const treeData = {};

      files.forEach(file => {
        const relativePath = file.webkitRelativePath;

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
    });
  }

  function createNewFilePrompt() {
    const fileName = prompt('Enter new file name:');
    if (!fileName) return;

    if (fileName === '.git' || fileName.startsWith('.git/')) {
      alert('Cannot create .git files.');
      return;
    }

    const target = selectedTargetDir || currentRootDir;
    if (!target) {
      alert('Select or open a folder target first.');
      return;
    }

    fetch('/create-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_dir: target, name: fileName })
    })
      .then(res => res.json())
      .then(data => {
        if (data.status !== 'success') alert(data.message);
      });
  }

  if (actionNewFile) actionNewFile.addEventListener('click', createNewFilePrompt);

  if (actionNewFolder) {
    actionNewFolder.addEventListener('click', () => {
      const folderName = prompt('Enter new folder name:');
      if (!folderName) return;

      if (folderName === '.git') {
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
        .then(res => res.json())
        .then(data => {
          if (data.status !== 'success') alert(data.message);
        });
    });
  }

  function renderNativeTreeUI(rootDirName, treeData) {
    if (!treeContainer) return;
    treeContainer.innerHTML = '';

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

            fetch('/format-content', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ content: rawContent, extension: currentFileExt })
            })
              .then(res => res.json())
              .then(data => {
                if (activeFileName) activeFileName.textContent = key;
                if (textCanvas) textCanvas.innerHTML = data.content || rawContent;
                currentFilePath = node.fileObj.path || null;
                updateLineNumbers();
              });
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

  function saveCurrentFile() {
    if (!currentFilePath) {
      alert('Cannot save: No physical file path linked to workspace.');
      return;
    }

    fetch('/save-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: currentFilePath,
        content: textCanvas ? textCanvas.innerHTML : ''
      })
    })
      .then(res => res.json())
      .then(data => {
        if (data.status === 'success') {
          alert('File saved successfully!');
        } else {
          alert(`Save Failed: ${data.message}`);
        }
      })
      .catch(err => console.error('Error saving file:', err));
  }
});