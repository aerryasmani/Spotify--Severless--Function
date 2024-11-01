const axios = require('axios');

exports.handler = async (event) => {
    // Add CORS headers to allow requests from your GitHub Pages domain
    const headers = {
        'Access-Control-Allow-Origin': 'https://aerryasmani.github.io', // Modified to be less restrictive
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
    };

    // Handle preflight requests - fixed to use event.httpMethod
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 204,
            headers
        };
    }

    // Verify environment variables
    const requiredEnvVars = [
        'SPOTIFY_REFRESH_TOKEN',
        'SPOTIFY_CLIENT_ID',
        'SPOTIFY_CLIENT_SECRET'
    ];

    for (const envVar of requiredEnvVars) {
        if (!process.env[envVar]) {
            console.error(`Missing required environment variable: ${envVar}`);
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ 
                    error: 'Server configuration error',
                    details: `Missing ${envVar}`
                })
            };
        }
    }

    try {
        // Get access token
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

        const accessToken = tokenResponse.data.access_token;
        
        if (!accessToken) {
            throw new Error('Failed to obtain access token');
        }

        // Get now playing
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

        // Verify song data structure
        if (!song || !song.item) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    isPlaying: false,
                    error: 'No song data available',
                    timestamp: new Date().toISOString()
                })
            };
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                isPlaying: song.is_playing,
                title: song.item.name,
                artist: song.item.artists.map(artist => artist.name).join(', '),
                album: song.item.album.name,
                albumImageUrl: song.item.album.images[0].url,
                songUrl: song.item.external_urls.spotify,
                timestamp: new Date().toISOString()
            })
        };
    } catch (error) {
        console.error('Error details:', {
            message: error.message,
            response: error.response ? {
                status: error.response.status,
                data: error.response.data
            } : null
        });

        return {
            statusCode: error.response?.status || 500,
            headers,
            body: JSON.stringify({ 
                error: 'Failed to fetch Spotify data',
                details: error.message,
                timestamp: new Date().toISOString()
            })
        };
    }
};