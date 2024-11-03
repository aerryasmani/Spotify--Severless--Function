// netlify/functions/spotify-now-playing.js
const axios = require('axios');

// Define allowed origins
// netlify/functions/spotify-now-playing.js

const allowedOrigins = {
    production: 'https://heiyoaerry.one',
    development: 'https://aerryasmani.github.io',
    local: 'http://127.0.0.1:5500/index.html',
    netlify: 'https://spotify-player-server.netlify.app' // Add this line
};

exports.handler = async (event) => {
    // Get origin from request
    const origin = event.headers.origin;
    console.log('Request origin:', origin);
    
    // Check if origin is allowed
    const isAllowedOrigin = Object.values(allowedOrigins).includes(origin);
    console.log('Is origin allowed:', isAllowedOrigin);
    
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
        // Log environment variables (remove sensitive info in production)
        console.log('Environment check:', {
            hasClientId: !!process.env.SPOTIFY_CLIENT_ID,
            hasClientSecret: !!process.env.SPOTIFY_CLIENT_SECRET,
            hasRefreshToken: !!process.env.SPOTIFY_REFRESH_TOKEN
        });

        if (!process.env.SPOTIFY_REFRESH_TOKEN || !process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
            throw new Error('Missing required Spotify credentials in environment variables');
        }

        // Get access token
        console.log('Requesting access token...');
        const tokenResponse = await axios.post('https://accounts.spotify.com/api/token', 
            new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: process.env.SPOTIFY_REFRESH_TOKEN
            }), {
                headers: {
                    'Authorization': `Basic ${Buffer.from(
                        `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
                    ).toString('base64')}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );

        console.log('Token response received');
        const accessToken = tokenResponse.data.access_token;

        // Get now playing
        console.log('Requesting currently playing...');
        const response = await axios.get('https://api.spotify.com/v1/me/player/currently-playing', {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        console.log('Spotify API response status:', response.status);

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
        console.log('Song data received:', {
            isPlaying: song.is_playing,
            songName: song.item?.name
        });

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
        console.error('Detailed error information:', {
            message: error.message,
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data,
            stack: error.stack
        });

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
                message: error.message,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            })
        };
    }
};