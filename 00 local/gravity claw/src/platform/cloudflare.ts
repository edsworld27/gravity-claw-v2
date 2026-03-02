/**
 * Cloudflare Workers Entry Point (Feature 51)
 * This allows Gravity Claw to run on the edge (subset of features).
 */
export default {
    async fetch(request: Request, env: any, ctx: any) {
        const url = new URL(request.url);

        if (url.pathname === '/api/webhook') {
            // Forward to main instance or process directly if minimal
            return new Response(JSON.stringify({ status: 'Edge node active', note: 'Full agent requires Node.js runtime.' }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        return new Response('Gravity Claw Edge Worker', { status: 200 });
    }
};
