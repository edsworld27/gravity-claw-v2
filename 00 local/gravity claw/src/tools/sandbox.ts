import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const sandboxTools = [
    {
        name: 'code_sandbox_execute',
        description: 'Execute Python or Node.js code securely inside a temporary Docker container.',
        parameters: {
            type: 'object',
            properties: {
                language: { type: 'string', enum: ['python', 'node'], description: 'The programming language.' },
                code: { type: 'string', description: 'The code to execute.' }
            },
            required: ['language', 'code']
        },
        execute: async ({ language, code }: any) => {
            console.log(`[Sandbox] Executing ${language} code...`);

            try {
                let command = '';
                const base64Code = Buffer.from(code).toString('base64');

                if (language === 'python') {
                    command = `docker run --rm python:3.10-slim python -c "import base64; exec(base64.b64decode('${base64Code}').decode('utf-8'))"`;
                } else if (language === 'node') {
                    command = `docker run --rm node:18-slim node -e "eval(Buffer.from('${base64Code}', 'base64').toString('utf-8'))"`;
                }

                const { stdout, stderr } = await execAsync(command, { timeout: 30000 });

                if (stderr) return `Output:\n${stdout}\n\nErrors:\n${stderr}`;
                return stdout || "Code executed successfully with no output.";
            } catch (error: any) {
                return `Execution failed: ${error.message}`;
            }
        }
    }
];
