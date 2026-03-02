/**
 * Talk Mode manages the state of continuous voice interaction.
 * When active, the bot may prioritize audio responses and 
 * perform more frequent proactive checks.
 */
export class TalkModeManager {
    private static instance: TalkModeManager;
    private activeSessions: Set<string> = new Set();

    private constructor() { }

    public static getInstance(): TalkModeManager {
        if (!TalkModeManager.instance) {
            TalkModeManager.instance = new TalkModeManager();
        }
        return TalkModeManager.instance;
    }

    public toggleTalkMode(sessionId: string): boolean {
        if (this.activeSessions.has(sessionId)) {
            this.activeSessions.delete(sessionId);
            return false;
        } else {
            this.activeSessions.add(sessionId);
            return true;
        }
    }

    public isTalkModeActive(sessionId: string): boolean {
        return this.activeSessions.has(sessionId);
    }
}

export const talkMode = TalkModeManager.getInstance();
