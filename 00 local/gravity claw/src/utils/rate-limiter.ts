/**
 * Simple rate limiter for API calls
 */

import { config } from '../config.js';

class RateLimiter {
    private lastApiCall: number = 0;
    private lastSearch: number = 0;
    private searchCount: number = 0;
    private searchBatchStart: number = 0;

    async waitForApi(): Promise<void> {
        const now = Date.now();
        const elapsed = now - this.lastApiCall;
        const delay = config.rateLimits.apiCallDelayMs;

        if (elapsed < delay) {
            await this.sleep(delay - elapsed);
        }
        this.lastApiCall = Date.now();
    }

    async waitForSearch(): Promise<void> {
        const now = Date.now();

        // Check if we need a batch pause
        if (this.searchCount >= config.rateLimits.maxSearchesPerBatch) {
            const batchElapsed = now - this.searchBatchStart;
            if (batchElapsed < config.rateLimits.batchPauseMs) {
                console.log('[RateLimiter] Batch limit reached, pausing...');
                await this.sleep(config.rateLimits.batchPauseMs - batchElapsed);
            }
            this.searchCount = 0;
            this.searchBatchStart = Date.now();
        }

        // Regular search delay
        const elapsed = now - this.lastSearch;
        const delay = config.rateLimits.searchDelayMs;

        if (elapsed < delay) {
            await this.sleep(delay - elapsed);
        }

        this.lastSearch = Date.now();
        this.searchCount++;

        if (this.searchCount === 1) {
            this.searchBatchStart = Date.now();
        }
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    resetSearchBatch(): void {
        this.searchCount = 0;
    }
}

export const rateLimiter = new RateLimiter();
