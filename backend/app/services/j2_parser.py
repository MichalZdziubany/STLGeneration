import re
from typing import List, Dict, Any, Tuple


def extract_parameters_from_js(template_content: str) -> List[Dict[str, Any]]:
    """
    Extract parameters from Jinja2 template file (.scad.j2).
    
    Looks for parameter declarations in the format:
    {# @param paramName {type} description #}
    {% set paramName = defaultValue %}
    
    Or inline format:
    {% set paramName = defaultValue %} {# description #}
    
    Returns list of parameter objects with name, type, description, and default value.
    """
    parameters: List[Dict[str, Any]] = []
    lines = template_content.split('\n')
    
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        
        # Look for Jinja2 comment lines with @param
        # Pattern: {# @param paramName {type} description #}
        param_comment_pattern = r'\{#\s*@param\s+(\w+)\s*(?:\{(\w+)\})?\s*(.*?)\s*#\}'
        comment_match = re.search(param_comment_pattern, line)
        
        if comment_match:
            param_name = comment_match.group(1)
            param_type = comment_match.group(2) or "number"
            param_description = comment_match.group(3) or ""
            
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
        
        # Also look for standalone {% set %} statements with inline comments
        # Pattern: {% set paramName = value %} {# description #}
        set_pattern = r'\{%\s*set\s+(\w+)\s*=\s*([^%]+)\s*%\}'
        set_match = re.search(set_pattern, line)
        
        if set_match:
            param_name = set_match.group(1)
            default_value_str = set_match.group(2).strip()
            
            # Check if we already have this parameter
            if not any(p['name'] == param_name for p in parameters):
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
