import { NextRequest, NextResponse } from 'next/server';

export interface ExecuteTemplateRequest {
  jsCode: string;
  params: Record<string, any>;
}

export interface ExecuteTemplateResponse {
  success: boolean;
  scadCode?: string;
  error?: string;
}

/**
 * Safely execute a JavaScript template and return generated SCAD code
 * 
 * The template should define a function that generates SCAD code:
 * 
 * Example template.js:
 * var SIZE = 50;
 * var THICKNESS = 2;
 * 
 * function generateSCAD() {
 *   return `
 *     difference() {
 *       cube([${SIZE}, ${SIZE}, ${SIZE}], center=true);
 *       cube([${SIZE - THICKNESS*2}, ${SIZE - THICKNESS*2}, ${SIZE - THICKNESS*2}], center=true);
 *     }
 *   `;
 * }
 */
export async function POST(request: NextRequest): Promise<NextResponse<ExecuteTemplateResponse>> {
  try {
    const body = await request.json() as ExecuteTemplateRequest;
    const { jsCode, params } = body;

    if (!jsCode) {
      return NextResponse.json(
        { success: false, error: 'jsCode is required' },
        { status: 400 }
      );
    }

    if (!params) {
      return NextResponse.json(
        { success: false, error: 'params is required' },
        { status: 400 }
      );
    }

    // Execute the template in a safe context
    const scadCode = executeTemplate(jsCode, params);

    return NextResponse.json({
      success: true,
      scadCode,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Template execution error:', errorMessage);

    return NextResponse.json(
      {
        success: false,
        error: `Template execution failed: ${errorMessage}`,
      },
      { status: 400 }
    );
  }
}

/**
 * Execute JavaScript template with given parameters
 * 
 * The template code should:
 * 1. Use parameters as global variables
 * 2. Define a generateSCAD() function
 * 3. Return valid OpenSCAD code
 */
function executeTemplate(jsCode: string, params: Record<string, any>): string {
  // Validate code for obvious security issues
  validateTemplateCode(jsCode);

  // Create parameter declarations
  const paramDeclarations = Object.entries(params)
    .map(([key, value]) => `const ${key} = ${formatJSValue(value)};`)
    .join('\n');

  // Combine declarations with user code
  const fullCode = `
${paramDeclarations}

${jsCode}

// Call the generation function if it exists
if (typeof generateSCAD === 'function') {
  generateSCAD();
} else if (typeof generate === 'function') {
  generate();
} else {
  throw new Error('Template must export a generateSCAD() or generate() function');
}
`;

  // Create a sandbox to execute the code
  try {
    // Using Function constructor is safer than eval
    // We can't truly sandbox in Node/browser, but we can limit what gets executed
    const executionContext: Record<string, any> = {};
    
    // Create a function that returns the result of the template execution
    const sandboxedFn = new Function(...Object.keys(executionContext), fullCode);
    
    // Capture console output and function result
    let generatedSCAD = '';
    const originalLog = console.log;
    
    // Redirect console.log to capture output
    console.log = (...args: any[]) => {
      generatedSCAD += args.map(arg => String(arg)).join(' ') + '\n';
    };

    try {
      // Execute the function with the context
      sandboxedFn(...Object.values(executionContext));
    } finally {
      // Restore console.log
      console.log = originalLog;
    }

    // If nothing was logged, try direct execution with return value
    if (!generatedSCAD.trim()) {
      // Execute and get the return value
      const fn = new Function(...Object.keys(params), `
        ${jsCode}
        
        if (typeof generateSCAD === 'function') {
          return generateSCAD();
        } else if (typeof generate === 'function') {
          return generate();
        } else {
          throw new Error('Template must export a generateSCAD() or generate() function');
        }
      `);

      generatedSCAD = fn(...Object.values(params));
    }

    if (!generatedSCAD || typeof generatedSCAD !== 'string') {
      throw new Error('Template function did not return SCAD code');
    }

    return generatedSCAD;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to execute template: ${msg}`);
  }
}

/**
 * Validate that the template code doesn't contain obviously dangerous patterns
 */
function validateTemplateCode(jsCode: string): void {
  const dangerousPatterns = [
    /fetch\s*\(/gi,                    // No network requests
    /XMLHttpRequest/gi,                // No HTTP requests
    /localStorage|sessionStorage/gi,   // No storage access
    /document\s*\./gi,                 // No DOM access
    /window\s*\./gi,                   // No window access
    /eval\s*\(/gi,                     // No eval
    /Function\s*\(/gi,                 // No Function constructor
    /process\s*\./gi,                  // No process access
    /require\s*\(/gi,                  // No require
    /import\s+/gi,                     // No imports
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(jsCode)) {
      throw new Error(
        `Template contains dangerous pattern: ${pattern.toString()}. Templates can only use parameters and generate SCAD code.`
      );
    }
  }
}

/**
 * Format a JavaScript value as a literal
 */
function formatJSValue(value: any): string {
  if (value === null) {
    return 'null';
  }
  if (value === undefined) {
    return 'undefined';
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  if (typeof value === 'number') {
    return String(value);
  }
  if (typeof value === 'string') {
    // Escape special characters
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(v => formatJSValue(v)).join(', ')}]`;
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, any>)
      .map(([k, v]) => `${k}: ${formatJSValue(v)}`)
      .join(', ');
    return `{${entries}}`;
  }
  return String(value);
}
