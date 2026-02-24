import re
from typing import List, Dict, Any, Tuple


def extract_parameters_from_js(template_content: str) -> List[Dict[str, Any]]:
    """
    Extract parameters from Jinja2 template file (.scad.j2).
    
    Supports multiple formats:
    1. Explicit @param comments:
       {# @param paramName {type} description #}
       {% set paramName = defaultValue %}
    
    2. Jinja2 variable placeholders:
       variableName = {{PARAMETER_NAME}};
    
    3. {% set %} statements:
       {% set paramName = defaultValue %}
    
    Returns list of parameter objects with name, type, description, and default value.
    """
    parameters: List[Dict[str, Any]] = []
    param_names_seen = set()
    lines = template_content.split('\n')
    
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        
        # Pattern 1: Look for Jinja2 comment lines with @param
        # {# @param paramName {type} description #}
        param_comment_pattern = r'\{#\s*@param\s+(\w+)\s*(?:\{(\w+)\})?\s*(.*?)\s*#\}'
        comment_match = re.search(param_comment_pattern, line)
        
        if comment_match:
            param_name = comment_match.group(1)
            param_type = comment_match.group(2) or "number"
            param_description = comment_match.group(3) or ""
            
            if param_name not in param_names_seen:
                # Look for {% set %} statement in next few lines
                default_value = None
                j = i
                while j < len(lines) and j < i + 5:
                    next_line = lines[j].strip()
                    set_pattern = r'\{%\s*set\s+' + re.escape(param_name) + r'\s*=\s*([^%]+)\s*%\}'
                    set_match = re.search(set_pattern, next_line)
                    if set_match:
                        default_value_str = set_match.group(1).strip()
                        default_value = parse_default_value(default_value_str)
                        break
                    j += 1
                
                # If no default found, use type-appropriate default
                if default_value is None:
                    default_value = get_default_for_type(param_type)
                
                parameters.append({
                    "name": param_name,
                    "type": param_type,
                    "description": param_description.strip(),
                    "default": default_value
                })
                param_names_seen.add(param_name)
        
        # Pattern 2: Look for variable assignments with Jinja2 placeholders
        # variableName = {{PARAMETER_NAME}};
        jinja_var_pattern = r'(\w+)\s*=\s*\{\{(\w+)\}\}\s*;'
        jinja_match = re.search(jinja_var_pattern, line)
        
        if jinja_match:
            local_var = jinja_match.group(1)  # e.g., "height"
            param_name = jinja_match.group(2)  # e.g., "HEIGHT"
            
            if param_name not in param_names_seen:
                # Look for comment before or on same line
                description = ""
                comment_pattern = r'//\s*(.*?)$'
                comment_match = re.search(comment_pattern, line)
                if comment_match:
                    description = comment_match.group(1).strip()
                else:
                    # Check previous line for comment
                    if i > 0:
                        prev_line = lines[i - 1].strip()
                        if prev_line.startswith('//'):
                            description = prev_line[2:].strip()
                
                parameters.append({
                    "name": param_name,
                    "type": "number",  # Default type for Jinja2 placeholders
                    "description": description or f"{local_var} parameter",
                    "default": 10  # Default value
                })
                param_names_seen.add(param_name)
        
        # Pattern 3: Standalone {% set %} statements with inline comments
        # {% set paramName = value %} {# description #}
        set_pattern = r'\{%\s*set\s+(\w+)\s*=\s*([^%]+)\s*%\}'
        set_match = re.search(set_pattern, line)
        
        if set_match:
            param_name = set_match.group(1)
            default_value_str = set_match.group(2).strip()
            
            if param_name not in param_names_seen:
                # Look for inline comment
                inline_comment_pattern = r'\{#\s*(.*?)\s*#\}'
                comment_match = re.search(inline_comment_pattern, line)
                description = comment_match.group(1) if comment_match else ""
                
                default_value = parse_default_value(default_value_str)
                
                # Only add if it looks like a parameter (not internal variable)
                if is_likely_parameter(param_name):
                    parameters.append({
                        "name": param_name,
                        "type": infer_type(default_value),
                        "description": description.strip(),
                        "default": default_value
                    })
                    param_names_seen.add(param_name)
        
        i += 1
    
    return parameters


def parse_default_value(value_str: str) -> Any:
    """Parse a Jinja2/Python value string into Python value."""
    value_str = value_str.strip()
    
    # Boolean
    if value_str.lower() in ('true', 'false'):
        return value_str.lower() == 'true'
    
    # Number
    try:
        if '.' in value_str:
            return float(value_str)
        return int(value_str)
    except ValueError:
        pass
    
    # String (remove quotes)
    if (value_str.startswith('"') and value_str.endswith('"')) or \
       (value_str.startswith("'") and value_str.endswith("'")):
        return value_str[1:-1]
    
    # Default to string
    return value_str


def get_default_for_type(param_type: str) -> Any:
    """Get appropriate default value for a parameter type."""
    type_defaults = {
        "number": 0,
        "integer": 0,
        "int": 0,
        "float": 0.0,
        "string": "",
        "str": "",
        "boolean": False,
        "bool": False,
    }
    return type_defaults.get(param_type.lower(), 0)


def infer_type(value: Any) -> str:
    """Infer parameter type from default value."""
    if isinstance(value, bool):
        return "boolean"
    if isinstance(value, int):
        return "integer"
    if isinstance(value, float):
        return "float"
    return "string"


def is_likely_parameter(name: str) -> bool:
    """Check if variable name looks like a parameter (uppercase or descriptive)."""
    # Parameters are typically UPPERCASE or camelCase with descriptive names
    has_uppercase = any(c.isupper() for c in name)
    has_meaningful_chars = len(name) > 2
    return has_uppercase and has_meaningful_chars
