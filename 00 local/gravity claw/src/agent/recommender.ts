import { toolRegistry } from '../tools/index.js';

export class RecommendationEngine {
    /**
     * Analyzes recent message text and suggests relevant tools/skills.
     * Feature 40
     */
    public static suggest(text: string): string[] {
        const query = text.toLowerCase();
        const suggestions: string[] = [];
        const allTools = toolRegistry.getToolDefinitions();

        // Simple keyword mapping for suggestions
        const keywordMap: Record<string, string[]> = {
            'music': ['spotify_search_play', 'spotify_current_track'],
            'song': ['spotify_search_play'],
            'calendar': ['calendar_list', 'calendar_create'],
            'schedule': ['calendar_list'],
            'meeting': ['calendar_create'],
            'weather': ['weather_get'],
            'news': ['news_search'],
            'research': ['deep_research'],
            'code': ['code_sandbox_execute'],
            'bash': ['shell_execute'],
            'habit': ['habit_create', 'habit_status']
        };

        for (const [kw, tools] of Object.entries(keywordMap)) {
            if (query.includes(kw)) {
                suggestions.push(...tools);
            }
        }

        // Filter out unique suggestions and limit to 3
        return Array.from(new Set(suggestions)).slice(0, 3);
    }
}
