import OpenAI from 'openai';
import { config } from '../config.js';
import FormData from 'form-data';
import { toFile } from 'openai';
import fs from 'fs';
import path from 'path';
import os from 'os';

const openai = new OpenAI({
    apiKey: config.openaiApiKey,
});

export async function transcribeAudio(audioBuffer: Buffer, filename = 'voice.ogg'): Promise<string> {
    // OpenAI requires a file-like object with a name.
    // We can write the buffer to a temporary file, transcribe it, and delete it.
    const tempFilePath = path.join(os.tmpdir(), `gravity_claw_${Date.now()}_${filename}`);

    try {
        fs.writeFileSync(tempFilePath, audioBuffer);

        const response = await openai.audio.transcriptions.create({
            file: fs.createReadStream(tempFilePath),
            model: 'whisper-1',
        });

        return response.text;
    } finally {
        // Always clean up temp file
        if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
        }
    }
}
