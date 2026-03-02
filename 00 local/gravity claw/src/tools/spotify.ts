import SpotifyWebApi from 'spotify-web-api-node';
import { config } from '../config.js';
import fs from 'fs';
import path from 'path';

const TOKEN_PATH = path.join(process.cwd(), 'data', 'spotify_token.json');

const spotifyApi = new SpotifyWebApi({
    clientId: config.spotifyClientId,
    clientSecret: config.spotifyClientSecret,
    redirectUri: 'http://localhost:3000/callback'
});

async function ensureAuth() {
    if (!config.spotifyClientId || !config.spotifyClientSecret) {
        throw new Error("Spotify credentials not configured in .env");
    }

    if (fs.existsSync(TOKEN_PATH)) {
        const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
        spotifyApi.setAccessToken(tokens.accessToken);
        spotifyApi.setRefreshToken(tokens.refreshToken);

        // Check if token is expired (roughly)
        try {
            await spotifyApi.getMe();
        } catch (err) {
            const data = await spotifyApi.refreshAccessToken();
            spotifyApi.setAccessToken(data.body['access_token']);
            fs.writeFileSync(TOKEN_PATH, JSON.stringify({
                accessToken: data.body['access_token'],
                refreshToken: tokens.refreshToken
            }));
        }
    } else {
        const authorizeURL = spotifyApi.createAuthorizeURL(['user-read-playback-state', 'user-modify-playback-state', 'user-read-currently-playing'], 'state');
        throw new Error(`Spotify not authorized. Please visit: ${authorizeURL}\nAfter auth, save the code or token to data/spotify_token.json`);
    }
}

export const spotifyTools = [
    {
        name: 'spotify_search_play',
        description: 'Search for a track or artist on Spotify and play it.',
        parameters: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'Track name or artist' }
            },
            required: ['query']
        },
        execute: async ({ query }: any) => {
            await ensureAuth();
            const searchResults = await spotifyApi.searchTracks(query);
            const track = searchResults.body.tracks?.items[0];
            if (!track) return `No tracks found for "${query}"`;

            await spotifyApi.play({ uris: [track.uri] });
            return `Now playing: ${track.name} by ${track.artists[0].name}`;
        }
    },
    {
        name: 'spotify_pause',
        description: 'Pause Spotify playback.',
        parameters: { type: 'object', properties: {} },
        execute: async () => {
            await ensureAuth();
            await spotifyApi.pause();
            return 'Paused Spotify playback.';
        }
    },
    {
        name: 'spotify_current_track',
        description: 'Get information about the currently playing track.',
        parameters: { type: 'object', properties: {} },
        execute: async () => {
            await ensureAuth();
            const data = await spotifyApi.getMyCurrentPlayingTrack();
            if (!data.body || !data.body.item) return 'Nothing is currently playing.';
            const item = data.body.item as any;
            return `Currently playing: ${item.name} by ${item.artists[0].name}`;
        }
    }
];
