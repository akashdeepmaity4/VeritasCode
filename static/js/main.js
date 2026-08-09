document.addEventListener('DOMContentLoaded', () => {
  const sidebar = document.getElementById('sidebar');
  const notesToggleBtn = document.getElementById('notesToggleBtn');
  const logoBtn = document.getElementById('logoBtn');
  const textCanvas = document.getElementById('textCanvas');
  const treeContainer = document.querySelector('.tree-view');
  const saveFileBtn = document.getElementById('saveFileBtn');
  const activeFileName = document.getElementById('activeFileName');

  const filePicker = document.getElementById('filePicker');
  const folderPicker = document.getElementById('folderPicker');

  const actionButtons = document.querySelectorAll('.action-btn');
  let actionNewFile = null;
  let actionNewFolder = null;

  actionButtons.forEach(btn => {
    if (btn.textContent.includes('➕') || btn.textContent.includes('+')) actionNewFile = btn;
    if (btn.textContent.includes('📁')) actionNewFolder = btn;
  });

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

  // --- Canvas Behavior & Formatting ---
  if (textCanvas) {
    textCanvas.addEventListener('keydown', (e) => {
      // Tab key indentation
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
      }
    });

    // Plain text paste handler
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
    });
  }

  // --- Global Keyboard Shortcuts ---
  document.addEventListener('keydown', (e) => {
    const isCtrl = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();

    // Ctrl + N: Create new file in root directory (Triggers existing '+' action)
    if (isCtrl && !e.shiftKey && key === 'n') {
      e.preventDefault();
      if (actionNewFile) {
        actionNewFile.click();
      } else {
        createNewFilePrompt();
      }
      return;
    }

    // Ctrl + Shift + N: Reset canvas to a fresh 'No file open' state
    if (isCtrl && e.shiftKey && key === 'n') {
      e.preventDefault();
      currentFilePath = null;
      currentFileExt = 'py';
      if (activeFileName) activeFileName.textContent = 'No file open';
      if (textCanvas) textCanvas.innerHTML = '';
      return;
    }

    // Ctrl + ` : Launch default shell (Bash / CMD)
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

    // Ctrl + S: Save file
    if (isCtrl && key === 's') {
      e.preventDefault();
      saveCurrentFile();
      return;
    }

    // Ctrl + Z: Undo inside editor
    if (isCtrl && !e.shiftKey && key === 'z') {
      if (document.activeElement === textCanvas) {
        e.preventDefault();
        document.execCommand('undo');
      }
      return;
    }

    // Ctrl + Y: Redo inside editor
    if (isCtrl && key === 'y') {
      if (document.activeElement === textCanvas) {
        e.preventDefault();
        document.execCommand('redo');
      }
      return;
    }

    // Ctrl + X: Cut selected text
    if (isCtrl && key === 'x') {
      if (document.activeElement === textCanvas) {
        e.preventDefault();
        document.execCommand('cut');
      }
      return;
    }

    // Ctrl + C: Copy selected text
    if (isCtrl && key === 'c') {
      if (document.activeElement === textCanvas) {
        e.preventDefault();
        document.execCommand('copy');
      }
      return;
    }

    // Ctrl + V: Paste text
    if (isCtrl && key === 'v') {
      if (document.activeElement === textCanvas) {
        // Handled natively or by element paste listener
        return;
      }
    }

    // Ctrl + K sequence handler (Ctrl+K -> Ctrl+O to open folder)
    if (isCtrl && key === 'k') {
      e.preventDefault();
      ctrlKPressed = true;
      clearTimeout(ctrlKTimeout);
      ctrlKTimeout = setTimeout(() => { ctrlKPressed = false; }, 1200);
      return;
    }

    // File/Folder Picker Shortcuts
    if (key === 'o') {
      if (ctrlKPressed) {
        e.preventDefault();
        ctrlKPressed = false;
        if (folderPicker) folderPicker.click();
      } else if (isCtrl) {
        e.preventDefault();
        if (filePicker) filePicker.click();
      }
    }
  });

  // --- Header Execution Button ---
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

  // --- Pickers & Tree Generation ---
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

  // --- Directory Actions ---
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
        content: textCanvas.innerHTML
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