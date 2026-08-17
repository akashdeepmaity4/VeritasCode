# Flask Web Application Boilerplate

## Introduction

Flask is a lightweight Python microframework designed for building web applications and REST APIs. It provides essential routing and template rendering without imposing rigid project architecture, making it ideal for rapid prototyping and microservices.

## QUICK START

1. Clone the repository (recommended) or manually download the part of the codebase needed.
1. copy the 'write_contents.sh' script to a folder which you want to create the application in.
1. This folder will now act as the root directory for your projects.
1. Now, run the write_contents.sh script via bash or any other shell script interpreter.
1. This will create the appropiate files and folders in the root directory.


---

## Boilerplate Structure

```
└──FlaskWebApp                                      # Flask webapp boilerplate 
│   └── readme.md                                   # Brief introduction to flask as well as project details      
    └── write_contents.sh                           # Bash script to write the contents of the files in the project
```

## End product Structure

```text
FlaskWebApp/
├── write_contents.sh      # Automated setup script
├── app.py                 # Application entry point
├── requirements.txt       # Python dependency tracking
├── .gitignore             # Pre-configured Git ignore rules
├── templates/
│   └── index.html         # Jinja2 base HTML template
└── static/
    ├── css/
    │   └── style.css      # Base CSS styles
    └── js/
        └── main.js        # Entry JavaScript file
```
