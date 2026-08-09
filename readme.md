# Veritas Code

An ultra lightweight, zero-lag, and locally run code editor for windows with minimal RAM footprint. It is fast, snappy and reliable. This can be used as a replacement for VSCode, Atom, Sublime Text if you don't need extensions. (Extension Marketplace will be added soon in v3.0)

## FEATURES

1. Native Dark Mode throughout the app
1. Sidebar and toolbar similar to popular IDEs 
1. Very small size and RAM footprint
1. Custom indentation for each Language

## HIGHLIGHTS

1. Can be run on all devices, from old legacy devices to modern powerhorses
1. Can be used on Localhost, natively as a Webapp, or a full-pledged windows app
1. Data stays on your Drive (Your WIFI company may still get the metadata during localhost use)

## SHORTCUTS

| Shortcut|Description|
|:---:|:---:|
| Ctrl + N| New File|
| Ctrl + shift + N | New Window|
| Ctrl + O | Open File |
| Ctrl + K + O | Open Folder |
| Ctrl + X | Cut Text |
| Ctrl + C | Copy Text |
| Ctrl + V | Paste Text |
| Ctrl + F | Undo edit |
| Ctrl + Y | Redo edit |
| Ctrl + ` | Open Bash / cmd|

## DEPENDENCIES

- Python 3.8+ (3.13+ recommended)
- Flask (Non-Negotiable)
- Pywebview (For PWA)
- Pyinstaller (For Windows Application)
- Bash (required for Linux / Mac, highly recommended for Windows)


## INSTALL DEPENDENCIES

```
pip install -r requirements.txt
```


## HOW TO USE

### 1. Windows Application (recommended for all windows users)

1. Download the latest release from [here](https://github.com/VeritasSoftware/veritas-code/releases)

(comming soon...)

### 2. Progressive Webapp (recommended for Linux / Mac users)

1. Download the codebase.
1. Run Bash or Cmd in root directory of the codebase.
1. install the dependencies [refer to line 36]
1. run 'launcher.py' to launch the PWA (entire codebase should be downloaded to prevent any errors)

```
cd path/to/root/directory
python launcher.py
```

### 3. Locally Run Webapp (recommended for old devices or cloud users)

1. Download the codebase. 
1. Open Bash or Cmd. Go to the root directory of the downloaded codebase.
1. Run 'app.py' via Python. 

```
cd path/to/root/directory
python app.py
```
4. Open the browser and go to http://localhost:5000.