import subprocess
import yt_dlp
import os

def play_youtube_audio(url):
    # Extract audio URL
    ydl_opts = {
        'format': 'bestaudio/best',
        'quiet': True,
        'extract_flat': False,
        'noplaylist': True
    }
    
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=False)
        audio_url = info['url']
    
    # Play audio using ffplay
    subprocess.run(["ffplay", "-nodisp", "-autoexit", audio_url], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

# Example Usage
youtube_url = "https://youtu.be/DkgNWHeo5ZI?si=lLokyfuhS51xAXiz"  # Replace with any YouTube song URL
play_youtube_audio(youtube_url)
