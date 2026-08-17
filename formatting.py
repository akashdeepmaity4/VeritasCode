import html
import re

TEXT_EXTENSIONS = {
    'txt', 
    'md', 
    'js', 
    'ts', 
    'html', 
    'css', 
    'json', 
    'yaml', 
    'yml', 
    'py', 
    'c', 
    'cpp', 
    'java', 
    'sh'
}

INDENT_RULES = {
    
    'html': 2,
    'htm': 2,
    'css': 2, 
    'json': 2, 
    'yaml': 2, 
    'yml': 2, 
    'js': 2, 
    'ts': 2,
    'py': 4, 
    'c': 4, 
    'cpp': 4, 
    'java': 4, 
    'sh': 4, 
    'txt': 4, 
    'md': 4

}

def format_code(content: str, extension: str) -> str:
    ext = extension.lower().lstrip('.')
    if ext not in TEXT_EXTENSIONS:
        return content

    indent_size = INDENT_RULES.get(ext, 4)

    # Normalize line breaks
    content = content.replace('\r\n', '\n').replace('\r', '\n')

    # Convert tabs to extension-specific space counts
    content = content.replace('\t', ' ' * indent_size)

    # Escape HTML entities safely first
    escaped_content = html.escape(content)
    lines = escaped_content.split('\n')
    formatted_lines = []

    for line in lines:
        # Convert ALL leading spaces to non-breaking spaces for proper indentation
        match = re.match(r'^( +)', line)
        if match:
            num_spaces = len(match.group(1))
            line = ('&nbsp;' * num_spaces) + line[num_spaces:]
        
        # Also preserve double-space alignment inside the code lines
        line = line.replace('  ', '&nbsp;&nbsp;')
        formatted_lines.append(line)

    return '<br>'.join(formatted_lines)

def clean_html_to_raw_text(html_content: str) -> str:
    if not html_content:
        return ""

    text = html_content

    # Normalize browser-inserted <div><br></div> empty lines to a single newline
    text = re.sub(r'<div>\s*<br\s*/?>\s*</div>', '\n', text, flags=re.IGNORECASE)

    # Convert remaining block tags and explicit <br> breaks to newlines
    text = re.sub(r'<br\s*/?>', '\n', text, flags=re.IGNORECASE)
    text = re.sub(r'<div>', '\n', text, flags=re.IGNORECASE)
    text = re.sub(r'</div>', '', text, flags=re.IGNORECASE)
    text = re.sub(r'<p[^>]*>', '\n', text, flags=re.IGNORECASE)
    text = re.sub(r'</p>', '', text, flags=re.IGNORECASE)

    # Strip any remaining unhandled HTML markup
    text = re.sub(r'<[^>]+>', '', text)

    # Revert non-breaking spaces back to standard spaces
    text = text.replace('&nbsp;', ' ')

    # Unescape HTML entities (&lt; -> <, &gt; -> >, &amp; -> &)
    text = html.unescape(text)

    # Normalize line endings and strip top padding
    text = text.replace('\r\n', '\n').replace('\r', '\n')
    text = re.sub(r'^\n+', '', text)

    return text