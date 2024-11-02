// package.json
{
    "name": "spotify-now-playing",
    "version": "1.0.0",
    "description": "Spotify Now Playing Function",
    "main": "index.js",
    "scripts": {
      "test": "echo \"Error: no test specified\" && exit 1"
    },
    "keywords": [],
    "author": "",
    "license": "ISC",
    "dependencies": {
      "axios": "^1.6.2"
    }
  }
  
  // netlify.toml
  [build]
    functions = "netlify/functions"
  
  [[headers]]
    for = "/*"
      [headers.values]
      Access-Control-Allow-Origin = "*"
      Access-Control-Allow-Methods = "GET, OPTIONS"
      Access-Control-Allow-Headers = "Content-Type"
  
  // netlify/functions/spotify-now-playing.js
  const axios = require('axios');
  
  exports.handler = async (event) => {
      // CORS Headers
      const headers = {
          'Access-Control-Allow-Origin': 'https://aerryasmani.github.io/ProjectJun24/', // Update this to your GitHub Pages URL in production
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'GET, OPTIONS'
      };
  
      // Handle preflight requests
      if (event.httpMethod === 'OPTIONS') {
          return {
              statusCode: 204,
              headers
          };
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
                      isPlaying: false
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
                  albumImageUrl: song.item.album.images[0].url,
                  songUrl: song.item.external_urls.spotify
              })
          };
      } catch (error) {
          console.error('Error:', error);
          return {
              statusCode: 500,
              headers,
              body: JSON.stringify({ 
                  error: 'Failed to fetch Spotify data',
                  details: error.message 
              })
          };
      }
  };