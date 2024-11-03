const axios = require('axios');

// Define allowed origins
const allowedOrigins = {
    production: 'https://heiyoaerry.one',
    development: 'https://aerryasmani.github.io',
    local: 'http://127.0.0.1:5500/index.html',
    netlify: 'https://spotify-player-server.netlify.app'
};

// Function to get a new access token using the refresh token
const getNewAccessToken = async () => {
    const url = "https://accounts.spotify.com/api/token";

    const response = await axios.post(
        url,
        new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: process.env.SPOTIFY_REFRESH_TOKEN // Use the environment variable for the refresh token
        }),
        {
            headers: {
                'Authorization': `Basic ${Buffer.from(
                    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
                ).toString('base64')}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        }
    );

    return response.data.access_token;
};

exports.handler = async (event) => {
    const origin = event.headers.origin;
    const isAllowedOrigin = Object.values(allowedOrigins).includes(origin);
    const headers = {
        'Access-Control-Allow-Origin': isAllowedOrigin ? origin : allowedOrigins.production,
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 204,
            headers
        };
    }

    try {
        // Ensure environment variables are available
        if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET || !process.env.SPOTIFY_REFRESH_TOKEN) {
            throw new Error('Missing Spotify credentials in environment variables');
        }

        // Get a new access token using the refresh token
        const accessToken = await getNewAccessToken();

        // Request current playback information from Spotify
        const response = await axios.get('https://api.spotify.com/v1/me/player/currently-playing', {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        if (response.status === 204 || response.status === 404) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    isPlaying: false,
                    timestamp: new Date().toISOString()
                })
            };
        }

        const song = response.data;
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                isPlaying: song.is_playing,
                title: song.item.name,
                artist: song.item.artists.map(artist => artist.name).join(', '),
                album: song.item.album.name,
                albumImageUrl: song.item.album.images[0]?.url,
                songUrl: song.item.external_urls.spotify,
                timestamp: new Date().toISOString()
            })
        };
    } catch (error) {
        console.error('Error fetching data from Spotify API:', error.message);

        if (error.response) {
            return {
                statusCode: error.response.status,
                headers,
                body: JSON.stringify({
                    error: 'Spotify API Error',
                    message: error.response.data?.error?.message || error.message,
                    status: error.response.status,
                    details: error.response.data
                })
            };
        }

        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: 'Failed to fetch Spotify data',
                message: error.message
            })
        };
    }
};
